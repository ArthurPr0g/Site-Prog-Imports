// O atendente: lê a conversa, chama o Claude com as ferramentas de venda e
// manda a resposta pelo WhatsApp. Só no servidor (webhook e tick).
//
// Proteções: teto de gasto do mês (passou, a IA para e chama o Arthur), modo
// "humano" (o Arthur assumiu: a IA fica calada), janela de 24 h do WhatsApp
// (fora dela não manda) e no máximo RODADAS chamadas ao Claude por resposta.

import Anthropic from '@anthropic-ai/sdk';
import { dbDoAtendente, type DbDoAtendente } from '@/lib/atendente/db';
import { enviarTexto, baixarMidia, JANELA_MS } from '@/lib/atendente/whatsapp-api';
import { enviarEmail } from '@/lib/atendente/email';
import { siteAbreAgora } from '@/lib/atendente/site-agora';
import { instrucoesFixas, contextoDaConversa } from '@/lib/atendente/prompt';
import { calcularProposta, custoDaChamada, modeloDoMomento, type ConfigDoAtendente, type ModeloDaIA } from '@/lib/atendente/regras';
import { tabelaBRL, TABELA_USD } from '@/lib/precos-captacao';
import { situacaoDoSite, LEAD_STATUS_LABEL, type LeadStatus } from '@/lib/captacao';
import { limparRespostas, CHECKLIST, type RespostasDoChecklist } from '@/lib/checklist-descoberta';
import { SITE_URL } from '@/lib/seo';
import type { Json } from '@/lib/supabase/database.types';

const RODADAS = 6;
const HISTORICO = 40;

/* ------------------------------------------------------------ configuração */

export async function lerConfig(db: DbDoAtendente = dbDoAtendente()): Promise<ConfigDoAtendente> {
  const { data } = await db.from('ia_config').select('*').eq('id', true).maybeSingle();
  return {
    personaName: data?.persona_name ?? 'Lia',
    active: data?.active ?? false,
    model: (data?.model ?? 'claude-opus-5-5') as ModeloDaIA,
    autoModel: data?.auto_model ?? true,
    monthlyBudgetUsd: Number(data?.monthly_budget_usd ?? 30),
    extraDiscountMax: Number(data?.extra_discount_max ?? 10),
    discountWaitMinutes: data?.discount_wait_minutes ?? 6,
    dailyEmailCap: data?.daily_email_cap ?? 15,
    ownerEmail: data?.owner_email ?? null,
  };
}

const inicioDoMes = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};

export async function gastoDoMes(db: DbDoAtendente): Promise<number> {
  const { data } = await db.from('ia_usage').select('cost_usd').gte('created_at', inicioDoMes());
  return (data ?? []).reduce((s, u) => s + Number(u.cost_usd), 0);
}

/* ------------------------------------------------------------ avisos ao Arthur */

export async function chamarArthur(
  db: DbDoAtendente,
  cfg: ConfigDoAtendente,
  conversaId: string,
  motivo: string,
  titulo: string
): Promise<void> {
  await db.from('ia_conversations').update({ needs_human: true, needs_human_reason: motivo }).eq('id', conversaId);
  await registrar(db, conversaId, 'sistema', `Arthur chamado: ${motivo}`);
  if (cfg.ownerEmail) {
    await enviarEmail({
      para: cfg.ownerEmail,
      assunto: `[Atendente] ${titulo}`,
      texto: `${motivo}\n\nAbrir a conversa: ${SITE_URL}/admin/captacao?aba=atendimento&conversa=${conversaId}`,
      nomeDoRemetente: `${cfg.personaName} (atendente)`,
    });
  }
}

async function registrar(
  db: DbDoAtendente,
  conversaId: string,
  author: 'ia' | 'sistema',
  body: string,
  extra: { external_id?: string; status?: string; error?: string } = {}
) {
  await db.from('ia_messages').insert({
    conversation_id: conversaId,
    direction: 'out',
    author,
    body,
    ...extra,
  });
}

/* ------------------------------------------------------------ ferramentas */

const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: 'calcular_preco',
    description:
      'Calcula o preço oficial (mesmo simulador do vendedor) de um pacote: trabalho, desconto de combo, mensalidade, prazo em dias úteis e formas de pagamento. Devolve o bloco da proposta já formatado para o WhatsApp. Use SEMPRE antes de falar qualquer valor ou prazo. Já aplica o desconto extra se ele foi aprovado nesta conversa.',
    input_schema: {
      type: 'object',
      properties: {
        produto: { type: 'string', enum: ['site', 'loja', 'erp'], description: 'site, loja (loja virtual) ou erp (sistema de gestão sozinho)' },
        nivel: { type: 'integer', enum: [0, 1, 2], description: '0 Essencial/Básico, 1 Profissional/Intermediário, 2 Premium/Avançado' },
        com_gestao: { type: 'boolean', description: 'Combo com sistema de gestão (só para site ou loja)' },
        nivel_gestao: { type: 'integer', enum: [0, 1, 2], description: 'Nível do sistema no combo' },
        marca: {
          type: 'integer',
          enum: [0, 1, 2, 3],
          description: '0 já tem marca; 1 Logo Essencial; 2 Identidade a partir do logo; 3 Identidade visual completa',
        },
      },
      required: ['produto', 'nivel', 'com_gestao', 'nivel_gestao', 'marca'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'registrar_descoberta',
    description:
      'Grava no painel o que você descobriu do negócio (checklist de descoberta). Mande só as chaves que souber; as outras ficam como estão. Listas para perguntas de várias opções.',
    input_schema: {
      type: 'object',
      properties: Object.fromEntries(
        CHECKLIST.map((c) => [
          c.chave,
          c.tipo === 'varias'
            ? { type: 'array', items: { type: 'string', enum: c.opcoes }, description: c.pergunta }
            : c.tipo === 'uma'
              ? { type: 'string', enum: c.opcoes, description: c.pergunta }
              : { type: 'string', description: c.pergunta },
        ])
      ),
      additionalProperties: false,
    },
  },
  {
    name: 'mudar_etapa',
    description:
      'Move o lead no funil do painel. reuniao: reunião combinada. proposta: preço apresentado. fechado: cliente confirmou que quer contratar. perdido: sem interesse. nao_contatar: pediu para não receber mais mensagens.',
    input_schema: {
      type: 'object',
      properties: {
        etapa: { type: 'string', enum: ['reuniao', 'proposta', 'fechado', 'perdido', 'nao_contatar'] },
        motivo: { type: 'string', description: 'Uma frase com o porquê (vai para as anotações do lead).' },
        responsavel: {
          type: 'string',
          description:
            'Só no fechado: nome completo do responsável que vai assinar o contrato (dá nome à pasta do cliente). Nas outras etapas, mande "".',
        },
      },
      required: ['etapa', 'motivo', 'responsavel'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'pedir_desconto_extra',
    description:
      'Pede ao superior um desconto extra além do combo. Só quando o cliente pediu desconto ou travou no preço e você julga necessário para fechar. Depois diga ao cliente que vai ver com seu superior e volta em alguns minutos.',
    input_schema: {
      type: 'object',
      properties: {
        percentual: { type: 'number', description: 'Menor percentual que resolve.' },
        motivo: { type: 'string', description: 'Por que o desconto é necessário (o que o cliente disse).' },
      },
      required: ['percentual', 'motivo'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'chamar_arthur',
    description:
      'Avisa o Arthur (dono) por e-mail e no painel. Use para negócio fechado, reunião combinada, pergunta fora do guia, pedido fora do catálogo, cliente irritado ou que quer falar com uma pessoa.',
    input_schema: {
      type: 'object',
      properties: {
        motivo: { type: 'string', description: 'O que o Arthur precisa saber ou fazer, em uma ou duas frases.' },
      },
      required: ['motivo'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'atualizar_resumo',
    description:
      'Atualiza o resumo da conversa que aparece para o Arthur no painel (3 linhas: quem é, o que quer, próximo passo). Chame ao fim de cada resposta em que algo importante mudou.',
    input_schema: {
      type: 'object',
      properties: { resumo: { type: 'string' } },
      required: ['resumo'],
      additionalProperties: false,
    },
    strict: true,
  },
];

type Estado = {
  db: DbDoAtendente;
  cfg: ConfigDoAtendente;
  conversaId: string;
  leadId: string | null;
  leadStatus: LeadStatus | null;
  tabela: ReturnType<typeof tabelaBRL>;
  /** Prazo em dias úteis de cada serviço do catálogo (nome em português). */
  prazos: Map<string, number>;
  descontoAprovado: number;
  descontoPendente: boolean;
  descontoNegado: boolean;
};

const ORDEM: LeadStatus[] = ['novo', 'contatado', 'respondeu', 'reuniao', 'proposta', 'fechado'];

async function executar(e: Estado, nome: string, entrada: Record<string, unknown>): Promise<string> {
  const { db, cfg, conversaId, leadId } = e;
  switch (nome) {
    case 'calcular_preco': {
      const p = calcularProposta(
        {
          produto: entrada.produto as 'site' | 'loja' | 'erp',
          nivel: Number(entrada.nivel) as 0 | 1 | 2,
          comGestao: !!entrada.com_gestao,
          nivelGestao: Number(entrada.nivel_gestao) as 0 | 1 | 2,
          marca: Number(entrada.marca) as 0 | 1 | 2 | 3,
        },
        e.tabela,
        e.descontoAprovado,
        e.prazos
      );
      if (p.total <= 0) return 'Pacote sem preço no catálogo. Não passe valor: use chamar_arthur.';
      // Guarda a última proposta passada: vira o valor negociado quando o lead fechar
      // (a meta só usa closed_* com o lead em "fechado"; antes disso, a estimativa).
      if (leadId) {
        await db
          .from('leads')
          .update({ closed_value: p.totalComExtra, closed_monthly: p.mensal, closed_currency: e.tabela.moeda })
          .eq('id', leadId);
      }
      return p.texto;
    }
    case 'registrar_descoberta': {
      if (!leadId) return 'Sem lead identificado: guardei só no resumo. Continue a conversa.';
      const { data: l } = await db.from('leads').select('discovery').eq('id', leadId).maybeSingle();
      const atual = (l?.discovery ?? {}) as RespostasDoChecklist;
      const novas = limparRespostas({ ...atual, ...(entrada as RespostasDoChecklist) });
      await db
        .from('leads')
        .update({ discovery: novas as Json, discovery_by: cfg.personaName, discovery_at: new Date().toISOString() })
        .eq('id', leadId);
      return 'Registrado.';
    }
    case 'mudar_etapa': {
      if (!leadId) return 'Sem lead identificado no painel: avise o Arthur se for importante.';
      const etapa = String(entrada.etapa) as LeadStatus;
      const motivo = String(entrada.motivo ?? '').slice(0, 300);
      // Não volta etapa no funil, a não ser para perdido / não contatar.
      if (
        e.leadStatus &&
        ORDEM.includes(etapa) &&
        ORDEM.includes(e.leadStatus) &&
        ORDEM.indexOf(etapa) < ORDEM.indexOf(e.leadStatus)
      )
        return `O lead já está em ${LEAD_STATUS_LABEL[e.leadStatus]}; nada mudou.`;
      const { data: l } = await db.from('leads').select('notes, closed_at').eq('id', leadId).maybeSingle();
      const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const agora = new Date().toISOString();
      await db
        .from('leads')
        .update({
          status: etapa,
          notes: [l?.notes, `[${cfg.personaName} ${hoje}] ${LEAD_STATUS_LABEL[etapa]}: ${motivo}`].filter(Boolean).join('\n'),
          closed_at: etapa === 'fechado' ? (l?.closed_at ?? agora) : l?.closed_at ?? null,
          // Nome do responsável: dá nome à pasta do cliente no OneDrive ("Empresa - Responsável").
          ...(etapa === 'fechado' && String(entrada.responsavel ?? '').trim()
            ? { responsible_name: String(entrada.responsavel).trim().slice(0, 120) }
            : {}),
          next_contact: null,
          updated_at: agora,
        })
        .eq('id', leadId);
      e.leadStatus = etapa;
      if (etapa === 'fechado') await chamarArthur(db, cfg, conversaId, `Negócio fechado: ${motivo}`, 'Venda fechada! Mandar contrato e sinal');
      return `Etapa: ${LEAD_STATUS_LABEL[etapa]}.`;
    }
    case 'pedir_desconto_extra': {
      if (e.descontoAprovado) return `Já há ${e.descontoAprovado}% aprovado; calcular_preco já aplica.`;
      if (e.descontoPendente) return 'Já há um pedido aguardando o superior. Diga que ainda está vendo.';
      if (e.descontoNegado) return 'O superior já negou nesta conversa. Ofereça outra saída (parcelamento, nível abaixo).';
      const pct = Math.round(Math.min(Math.max(Number(entrada.percentual) || 0, 1), cfg.extraDiscountMax) * 10) / 10;
      const libera = new Date(Date.now() + cfg.discountWaitMinutes * 60_000).toISOString();
      const { error } = await db.from('ia_discount_requests').insert({
        conversation_id: conversaId,
        lead_id: leadId,
        percent: pct,
        reason: String(entrada.motivo ?? '').slice(0, 500),
        release_at: libera,
      });
      if (error) return 'Não consegui registrar o pedido agora. Diga que vai confirmar com o responsável.';
      e.descontoPendente = true;
      if (cfg.ownerEmail) {
        await enviarEmail({
          para: cfg.ownerEmail,
          assunto: `[Atendente] Pedido de ${pct}% de desconto extra`,
          texto: `Motivo: ${entrada.motivo}\n\nSe você não negar em ${cfg.discountWaitMinutes} minutos, a ${cfg.personaName} libera sozinha.\nNegar ou liberar agora: ${SITE_URL}/admin/captacao?aba=atendimento&conversa=${conversaId}`,
          nomeDoRemetente: `${cfg.personaName} (atendente)`,
        });
      }
      return 'Pedido enviado ao superior. Agora diga ao cliente, com naturalidade, que vai ver com seu superior se consegue uma condição melhor e que volta em alguns minutos. Não diga percentual.';
    }
    case 'chamar_arthur': {
      const motivo = String(entrada.motivo ?? '').slice(0, 500);
      await chamarArthur(db, cfg, conversaId, motivo, 'A conversa precisa de você');
      return 'Arthur avisado. Continue o atendimento normalmente.';
    }
    case 'atualizar_resumo': {
      await db.from('ia_conversations').update({ summary: String(entrada.resumo ?? '').slice(0, 800) }).eq('id', conversaId);
      return 'ok';
    }
    default:
      return `Ferramenta desconhecida: ${nome}`;
  }
}

/* ------------------------------------------------------------ resposta */

const cliente = () => new Anthropic();

/**
 * Responde a conversa (última mensagem do cliente ou um aviso interno, como a
 * resposta do superior ao desconto). Devolve o motivo quando não respondeu.
 */
export async function responderConversa(conversaId: string, avisoInterno?: string): Promise<string | null> {
  const db = dbDoAtendente();
  const cfg = await lerConfig(db);
  if (!cfg.active) return 'atendente desligado';

  const { data: conversa } = await db.from('ia_conversations').select('*').eq('id', conversaId).maybeSingle();
  if (!conversa) return 'conversa não encontrada';
  if (conversa.mode !== 'ia') return 'Arthur assumiu a conversa';
  if (!conversa.last_inbound_at || Date.now() - new Date(conversa.last_inbound_at).getTime() > JANELA_MS - 5 * 60_000)
    return 'fora da janela de 24 h';

  if ((await gastoDoMes(db)) >= cfg.monthlyBudgetUsd) {
    if (!conversa.needs_human)
      await chamarArthur(db, cfg, conversaId, `Teto de US$ ${cfg.monthlyBudgetUsd} do mês atingido: a IA parou de responder.`, 'Teto de gasto atingido');
    return 'teto do mês';
  }

  // Lead, preços do link e pedidos de desconto.
  const [{ data: lead }, { data: item }, { data: kit }, { data: pedidos }, { data: historico }] = await Promise.all([
    conversa.lead_id ? db.from('leads').select('*').eq('id', conversa.lead_id).maybeSingle() : Promise.resolve({ data: null }),
    conversa.lead_id && conversa.kit_id
      ? db.from('lead_kit_items').select('currency').match({ kit_id: conversa.kit_id, lead_id: conversa.lead_id }).maybeSingle()
      : Promise.resolve({ data: null }),
    conversa.kit_id ? db.from('lead_seller_kits').select('catalog, token').eq('id', conversa.kit_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from('ia_discount_requests').select('status, percent').eq('conversation_id', conversaId),
    db
      .from('ia_messages')
      .select('direction, author, body, created_at, media_type, media_id, media_mime')
      .eq('conversation_id', conversaId)
      .order('created_at', { ascending: false })
      .limit(HISTORICO),
  ]);

  const moeda = (item?.currency as 'BRL' | 'USD' | undefined) ?? (lead?.country === 'US' ? 'USD' : 'BRL');
  // Preço do retrato do catálogo guardado no link (o mesmo que o placar usa); sem link, o catálogo de agora.
  const itensDoLink = (kit?.catalog ?? []) as { nome: string; preco: number; prazoDias?: number }[];
  let catalogo = new Map<string, number>(itensDoLink.map((s) => [s.nome, Number(s.preco)]));
  let prazos = new Map<string, number>(itensDoLink.map((s) => [s.nome, Number(s.prazoDias ?? 0)]));
  if (catalogo.size === 0 || itensDoLink.every((s) => !s.prazoDias)) {
    const { data: servicos } = await db.from('internal_services').select('name, price, lead_time_days').eq('active', true);
    if (catalogo.size === 0) catalogo = new Map((servicos ?? []).map((s) => [s.name, Number(s.price)]));
    prazos = new Map((servicos ?? []).map((s) => [s.name, Number(s.lead_time_days ?? 0)]));
  }

  const estado: Estado = {
    db,
    cfg,
    conversaId,
    leadId: conversa.lead_id,
    leadStatus: (lead?.status as LeadStatus | undefined) ?? null,
    tabela: moeda === 'USD' ? TABELA_USD : tabelaBRL(catalogo),
    prazos,
    descontoAprovado: Number((pedidos ?? []).find((p) => p.status === 'aprovado')?.percent ?? 0),
    descontoPendente: (pedidos ?? []).some((p) => p.status === 'aguardando'),
    descontoNegado: (pedidos ?? []).some((p) => p.status === 'negado'),
  };

  // "Fora do ar" da captação pode estar velho ou ter sido falha passageira:
  // confere na hora antes de a IA usar isso como argumento. Se abriu, corrige o banco.
  let situacao: string = lead ? situacaoDoSite(lead.website, lead.site_check) : 'sem_site';
  let motivos: string[] = lead?.reasons ?? [];
  if (lead?.website && situacao === 'fora') {
    if (await siteAbreAgora(lead.website)) {
      situacao = 'no ar (conferido agora; NÃO diga que está fora do ar)';
      motivos = motivos.filter((m) => !/fora do ar/i.test(m));
      await db.from('leads').update({ site_check: null, reasons: motivos }).eq('id', lead.id);
    } else {
      situacao = 'fora do ar (conferido agora, não abriu)';
    }
  }

  const contexto = contextoDaConversa({
    persona: cfg.personaName,
    descontoMax: cfg.extraDiscountMax,
    descontoAprovado: estado.descontoAprovado,
    descontoPendente: estado.descontoPendente,
    descontoNegado: estado.descontoNegado,
    moeda,
    resumo: conversa.summary,
    agora: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
    lead: lead
      ? {
          nome: lead.name,
          cidade: lead.city,
          ramo: lead.niche ?? lead.category,
          site: lead.website,
          situacaoDoSite: situacao,
          nota: lead.rating,
          avaliacoes: lead.review_count,
          motivos,
          sugeridos: lead.suggested_services ?? [],
          etapa: LEAD_STATUS_LABEL[lead.status as LeadStatus] ?? lead.status,
          descoberta: (lead.discovery ?? {}) as Record<string, string | string[]>,
          anotacoes: lead.notes,
          diagnostico: `${SITE_URL}/diagnostico/${lead.public_token}${kit?.token ? `?k=${kit.token}` : ''}`,
        }
      : null,
  });

  // Imagens e PDFs que o cliente mandou por último vão para o Claude ver (no
  // máximo 2, entre as 8 mensagens mais recentes: o histórico não fica no
  // cache, então cada imagem é paga de novo a cada resposta).
  const anexos = new Map<string, Anthropic.Beta.BetaContentBlockParam>();
  const recentes = (historico ?? []).slice(0, 8).filter(
    (m) => m.direction === 'in' && m.media_id && (m.media_type === 'image' || (m.media_type === 'document' && m.media_mime === 'application/pdf'))
  );
  for (const m of recentes.slice(0, 2)) {
    const arq = await baixarMidia(m.media_id!);
    if (!arq || arq.dados.length > 8 * 1024 * 1024) continue;
    const data = arq.dados.toString('base64');
    const mime = arq.mime || m.media_mime || '';
    if (m.media_type === 'document') {
      anexos.set(m.media_id!, { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } });
    } else if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mime)) {
      anexos.set(m.media_id!, {
        type: 'image',
        source: { type: 'base64', media_type: mime as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data },
      });
    }
  }

  // Histórico em turnos alternados: cliente = user; IA e Arthur = assistant.
  const mensagens: Anthropic.Beta.BetaMessageParam[] = [];
  const acrescentar = (papel: 'user' | 'assistant', blocos: Anthropic.Beta.BetaContentBlockParam[]) => {
    const ultimo = mensagens.at(-1);
    if (ultimo && ultimo.role === papel) (ultimo.content as Anthropic.Beta.BetaContentBlockParam[]).push(...blocos);
    else mensagens.push({ role: papel, content: blocos });
  };
  for (const m of [...(historico ?? [])].reverse()) {
    const papel: 'user' | 'assistant' = m.direction === 'in' || m.author === 'sistema' ? 'user' : 'assistant';
    const texto =
      m.author === 'arthur' ? `[Arthur escreveu] ${m.body}` : m.author === 'sistema' ? `[Aviso interno] ${m.body}` : m.body;
    const anexo = m.media_id ? anexos.get(m.media_id) : undefined;
    acrescentar(papel, [...(anexo ? [anexo] : []), { type: 'text', text: texto }]);
  }
  while (mensagens[0]?.role === 'assistant') mensagens.shift();
  if (avisoInterno) acrescentar('user', [{ type: 'text', text: `[Aviso interno] ${avisoInterno}` }]);
  if (mensagens.at(-1)?.role !== 'user') return 'nada novo para responder';

  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    // Cache de 1 h: o cliente de WhatsApp costuma demorar mais que os 5 min do padrão para responder.
    { type: 'text', text: instrucoesFixas(), cache_control: { type: 'ephemeral', ttl: '1h' } },
    { type: 'text', text: contexto },
  ];

  // Modelo pelo momento (o mesmo em todas as rodadas desta resposta, para aproveitar o cache).
  const ultimaDoCliente = (historico ?? []).find((m) => m.direction === 'in')?.body ?? '';
  const modelo = modeloDoMomento(cfg, {
    ultimaDoCliente,
    etapa: estado.leadStatus,
    avisoInterno: !!avisoInterno,
    descontoPendente: estado.descontoPendente,
    primeiraResposta: !(historico ?? []).some((m) => m.direction === 'out'),
  });

  const respostas: string[] = [];
  const anthropic = cliente();
  for (let rodada = 0; rodada < RODADAS; rodada++) {
    let r: Anthropic.Beta.BetaMessage;
    try {
      r = await anthropic.beta.messages.create({
        model: modelo,
        max_tokens: 8000,
        system,
        tools,
        messages: mensagens,
        output_config: { effort: 'low' },
        // Recusa do modelo por engano: a própria API tenta de novo em outro modelo.
        ...(modelo === 'claude-haiku-5-5'
          ? {}
          : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }),
      });
    } catch (erro) {
      console.error('[atendente] Claude falhou', erro);
      const msg =
        erro instanceof Anthropic.RateLimitError
          ? 'limite de uso da API da Anthropic'
          : erro instanceof Anthropic.AuthenticationError
            ? 'chave da Anthropic inválida'
            : erro instanceof Anthropic.APIError
              ? `erro ${erro.status} da API da Anthropic`
              : 'falha ao falar com a IA';
      await chamarArthur(db, cfg, conversaId, `A IA não conseguiu responder (${msg}). Responda você.`, 'A IA falhou');
      return msg;
    }

    const u = r.usage;
    const uso = {
      entrada: u.input_tokens,
      saida: u.output_tokens,
      cacheLido: u.cache_read_input_tokens ?? 0,
      cacheEscrito: u.cache_creation_input_tokens ?? 0,
    };
    await db.from('ia_usage').insert({
      conversation_id: conversaId,
      model: r.model,
      input_tokens: uso.entrada,
      output_tokens: uso.saida,
      cache_read_tokens: uso.cacheLido,
      cache_write_tokens: uso.cacheEscrito,
      cost_usd: custoDaChamada(r.model, uso),
    });

    if (r.stop_reason === 'refusal') {
      await chamarArthur(db, cfg, conversaId, 'A IA recusou responder a última mensagem. Responda você.', 'A IA travou');
      return 'recusa';
    }

    const texto = r.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (texto) respostas.push(texto);

    const usos = r.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
    if (r.stop_reason !== 'tool_use' || usos.length === 0) break;

    mensagens.push({ role: 'assistant', content: r.content });
    const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const t of usos) {
      let conteudo: string;
      try {
        conteudo = await executar(estado, t.name, (t.input ?? {}) as Record<string, unknown>);
      } catch {
        conteudo = 'Falhou agora. Siga sem isso e, se for importante, use chamar_arthur.';
      }
      resultados.push({ type: 'tool_result', tool_use_id: t.id, content: conteudo });
    }
    mensagens.push({ role: 'user', content: resultados });
  }

  // Manda as mensagens (separadas por "---") pelo WhatsApp e grava.
  const partes = respostas
    .join('\n---\n')
    .split(/^\s*---\s*$/m)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 4);
  for (const parte of partes) {
    const env = await enviarTexto(conversa.contact_id, parte);
    await registrar(db, conversaId, 'ia', parte, env.ok ? { external_id: env.id, status: 'sent' } : { status: 'failed', error: env.erro });
    if (!env.ok) {
      await chamarArthur(db, cfg, conversaId, `Falha ao enviar pelo WhatsApp: ${env.erro}`, 'Mensagem não enviada');
      break;
    }
  }
  await db.from('ia_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversaId);
  return partes.length ? null : 'sem texto';
}
