'use server';

// Pré-venda da Prog Soluções (/admin/pre-venda, pedido do Arthur em 31/10/2026): junta numa leitura só o
// lead, a conversa da Lia, as reuniões, a cobrança do sinal e o que o Arthur marcou na tabela `prevenda`
// (0114). Tudo pela sessão do admin (RLS). Não manda mensagem a ninguém e não cria cobrança.

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';
import type { TablesUpdate } from '@/lib/supabase/database.types';
import type { LeadStatus, Pais } from '@/lib/captacao';
import { estimar, tabelaBRL, TABELA_USD, moedaDoPais, type Moeda } from '@/lib/precos-captacao';
import { simular } from '@/lib/simulador';
import { escolhaDoJson } from '@/lib/pos-venda';
import { CHECKLIST, respondidas } from '@/lib/checklist-descoberta';
import {
  ETAPAS_DA_PRE_VENDA,
  PASSOS,
  atualizacoesDoJson,
  calcularPassos,
  passosDoJson,
  pendenciasDoJson,
  proximoPasso,
  type AtualizacaoDoDono,
  type ChavePasso,
  type EtapaDaPreVenda,
  type PassoCalculado,
  type PassoManual,
  type Pendencia,
  type ProximoPasso,
} from '@/lib/pre-venda';

async function admin() {
  return (await requireAdmin()) ? createClient() : null;
}

export type LeadDaPreVenda = {
  id: string;
  nome: string;
  empresa: string | null;
  cidade: string | null;
  origem: string | null;
  etapa: EtapaDaPreVenda;
  /** Desde quando está na etapa (a melhor data que os registros têm). */
  naEtapaDesde: string;
  pais: Pais;
  telefone: string | null;
  email: string | null;
  publicToken: string;
  diagViews: number;
  notas: string | null;
  briefing: Record<string, string>;
  descoberta: string[];
  pesquisa: { resumo: string | null; itens: { campo: string; valor: string }[] } | null;
  conversa: {
    id: string;
    resumo: string | null;
    modo: string;
    precisaDeVoce: boolean;
    ultimaEm: string | null;
    /** cliente, lia ou arthur (quem mandou a última mensagem). */
    ultimoDe: 'cliente' | 'lia' | 'arthur' | null;
    janelaAberta: boolean;
  } | null;
  reunioes: { id: string; titulo: string; inicio: string; status: string; salaStatus: string | null; resumo: string | null; link: string | null }[];
  atualizacoes: AtualizacaoDoDono[];
  pacote: { itens: string[]; moeda: Moeda; total: number; mensal: number; origem: 'escolhido' | 'sugerido' } | null;
  sinal: { valor: number; pagoEm: string | null; status: string } | null;
  passos: PassoCalculado[];
  proximo: ProximoPasso | null;
  /** Última vez que algo aconteceu com o lead (base do alerta de parado). */
  ultimoMovimento: string | null;
  prevenda: {
    existe: boolean;
    pendencias: Pendencia[];
    proximoPasso: string | null;
    proximoResponsavel: string | null;
    proximoPrazo: string | null;
    pasta: string | null;
    briefingUrl: string | null;
    designSystemUrl: string | null;
    prototipoUrl: string | null;
    propostaUrl: string | null;
    desconto: number | null;
    valorProposta: number | null;
    propostaEnviadaEm: string | null;
    prazoPrometido: string | null;
    observacoes: string | null;
  };
};

export type PainelDaPreVenda = {
  leads: LeadDaPreVenda[];
  /** Leads com projeto aberto no Pós-venda mas etapa diferente de "fechado" (não corrigimos sozinhos). */
  etapaDesatualizada: { id: string; nome: string; etapa: string }[];
  /** false = a tabela `prevenda` (0114) ainda não existe no banco: a tela mostra só o automático. */
  tabelaPronta: boolean;
};

const maior = (...ds: (string | null | undefined)[]) =>
  ds.filter((d): d is string => !!d).reduce<string | null>((m, d) => (m === null || d > m ? d : m), null);

export async function painelDaPreVendaAction(): Promise<PainelDaPreVenda | null> {
  const supabase = await admin();
  if (!supabase) return null;
  const colunas =
    'id, name, category, city, source, status, phone, email, country, public_token, diag_views, notes, briefing, briefing_confirmado_em, discovery, pesquisa, atualizacoes_do_dono, first_contact_at, replied_at, last_contact_at, created_at, pacote, suggested_services';

  // Conversas reais da Lia (fora as de teste): trazem os leads "novos" que chegaram pelo WhatsApp/portfólio.
  const [{ data: conversas }, { data: emEtapa }, { data: servicos }, { data: projetos }] = await Promise.all([
    supabase
      .from('ia_conversations')
      .select('id, lead_id, summary, mode, needs_human, last_inbound_at, last_message_at, created_at')
      .eq('is_test', false)
      .not('lead_id', 'is', null)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(500),
    supabase.from('leads').select(colunas).in('status', ['contatado', 'respondeu', 'reuniao', 'proposta']).limit(1000),
    supabase.from('internal_services').select('name, price').eq('active', true),
    supabase.from('projetos').select('lead_id, cliente, status').not('lead_id', 'is', null),
  ]);

  const convDoLead = new Map<string, NonNullable<typeof conversas>[number]>();
  for (const c of conversas ?? []) if (c.lead_id && !convDoLead.has(c.lead_id)) convDoLead.set(c.lead_id, c);
  const jaTem = new Set((emEtapa ?? []).map((l) => l.id));
  const novosComConversa = [...convDoLead.keys()].filter((id) => !jaTem.has(id));
  const { data: novos } = novosComConversa.length
    ? await supabase.from('leads').select(colunas).in('id', novosComConversa).eq('status', 'novo')
    : { data: [] };

  // Projeto aberto no Pós-venda = já vendido, mesmo que a etapa do lead tenha ficado para trás.
  // O projeto de teste do Pós-venda ("TESTE ...") não conta.
  const comProjeto = new Set(
    (projetos ?? []).filter((p) => p.status !== 'encerrado' && !/teste/i.test(p.cliente)).map((p) => p.lead_id as string)
  );

  const todos = [...(emEtapa ?? []), ...(novos ?? [])].filter((l) => !(l.source ?? '').toLowerCase().includes('teste'));
  const etapaDesatualizada = todos.filter((l) => comProjeto.has(l.id)).map((l) => ({ id: l.id, nome: l.name, etapa: l.status }));
  const leads = todos.filter((l) => !comProjeto.has(l.id));
  const ids = leads.map((l) => l.id);
  const convIds = ids.map((id) => convDoLead.get(id)?.id).filter((x): x is string => !!x);

  const [{ data: reunioes }, { data: cobrancas }, prev, { data: mensagens }] = await Promise.all([
    ids.length
      ? supabase.from('reunioes').select('id, lead_id, titulo, inicio, status, sala_status, resumo, meet_link').in('lead_id', ids).order('inicio')
      : Promise.resolve({ data: [] as never[] }),
    ids.length
      ? supabase.from('cobrancas').select('lead_id, parcela, valor, pago_em, status').in('lead_id', ids).eq('parcela', 'sinal')
      : Promise.resolve({ data: [] as never[] }),
    ids.length ? supabase.from('prevenda').select('*').in('lead_id', ids) : Promise.resolve({ data: [] as never[], error: null }),
    convIds.length
      ? supabase
          .from('ia_messages')
          .select('conversation_id, direction, author, created_at')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: false })
          .limit(1500)
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const tabelaPronta = !prev.error;
  const prevDo = new Map((prev.data ?? []).map((p) => [p.lead_id, p]));
  const ultimaMsg = new Map<string, { direction: string; author: string | null; created_at: string }>();
  for (const m of mensagens ?? []) if (!ultimaMsg.has(m.conversation_id)) ultimaMsg.set(m.conversation_id, m);

  const tabBRL = tabelaBRL(new Map((servicos ?? []).map((s) => [s.name, Number(s.price)])));
  const agora = Date.now();

  return {
    tabelaPronta,
    etapaDesatualizada,
    leads: leads.map((l): LeadDaPreVenda => {
      const pais = (l.country === 'US' ? 'US' : 'BR') as Pais;
      const moeda = moedaDoPais(pais);
      const tabela = moeda === 'USD' ? TABELA_USD : tabBRL;
      const conv = convDoLead.get(l.id) ?? null;
      const msg = conv ? ultimaMsg.get(conv.id) : undefined;
      const p = prevDo.get(l.id);
      const atualizacoes = atualizacoesDoJson(l.atualizacoes_do_dono);
      const rs = (reunioes ?? []).filter((r) => r.lead_id === l.id);
      const sinalRow = (cobrancas ?? []).find((c) => c.lead_id === l.id);
      const sinal = sinalRow ? { valor: Number(sinalRow.valor), pagoEm: sinalRow.pago_em, status: sinalRow.status } : null;

      // Pacote: o escolhido na conversa (leads.pacote, o mesmo que o Pós-venda usa ao registrar a venda);
      // sem ele, o sugerido pela Captação. Preço cheio do catálogo, sem desconto extra.
      const escolha = escolhaDoJson(l.pacote);
      let pacote: LeadDaPreVenda['pacote'] = null;
      if (escolha) {
        const s = simular(escolha, tabela);
        pacote = { itens: s.linhas.map((x) => x.nome), moeda, total: s.total, mensal: s.mensal, origem: 'escolhido' };
      } else if ((l.suggested_services ?? []).length) {
        const e = estimar(l.suggested_services ?? [], tabela);
        if (e.unico > 0) pacote = { itens: l.suggested_services ?? [], moeda, total: e.unico, mensal: e.mensal, origem: 'sugerido' };
      }

      const reuniaoFeita = rs.filter((r) => r.status === 'realizada' || r.sala_status === 'encerrada').at(-1)?.inicio ?? null;
      const ultimaReuniaoRegistrada = atualizacoes.filter((a) => a.etapaDepois === 'reuniao' || a.resumo).at(-1)?.em ?? null;
      const marcada = rs.find((r) => r.status === 'marcada' && Date.parse(r.inicio) >= agora)?.inicio ?? null;
      const briefing = (l.briefing && typeof l.briefing === 'object' && !Array.isArray(l.briefing) ? l.briefing : {}) as Record<string, unknown>;
      const briefingTexto = Object.fromEntries(
        Object.entries(briefing).filter(([, v]) => typeof v === 'string' && v.trim()) as [string, string][]
      );
      const discovery = (l.discovery ?? {}) as Record<string, string | string[]>;

      const passos = calcularPassos(
        {
          status: l.status as LeadStatus,
          primeiroContato: l.first_contact_at ?? conv?.created_at ?? null,
          respondeuEm: l.replied_at ?? conv?.last_inbound_at ?? null,
          briefingConfirmadoEm: l.briefing_confirmado_em,
          descobertaRespondida: respondidas(discovery),
          temBriefing: Object.keys(briefingTexto).length > 0,
          reuniaoFeitaEm: maior(reuniaoFeita, ultimaReuniaoRegistrada),
          reuniaoMarcadaPara: marcada,
          designSystemUrl: p?.design_system_url ?? null,
          prototipoUrl: p?.prototipo_url ?? null,
          propostaEnviadaEm: p?.proposta_enviada_em ?? null,
          sinal: sinal ? { pagoEm: sinal.pagoEm } : null,
        },
        passosDoJson(p?.passos)
      );

      const etapa = l.status as EtapaDaPreVenda;
      const desdeDaAtualizacao = atualizacoes.filter((a) => a.etapaDepois === etapa).at(-1)?.em ?? null;
      const naEtapaDesde =
        (etapa === 'proposta' ? (p?.proposta_enviada_em ?? desdeDaAtualizacao) : null) ??
        (etapa === 'reuniao' ? desdeDaAtualizacao : null) ??
        (etapa === 'respondeu' ? (desdeDaAtualizacao ?? l.replied_at) : null) ??
        (etapa === 'contatado' ? l.first_contact_at : null) ??
        desdeDaAtualizacao ??
        l.created_at;

      const pesquisa = l.pesquisa as { resumo?: unknown; itens?: { campo?: unknown; valor?: unknown }[] } | null;

      return {
        id: l.id,
        nome: l.name,
        empresa: l.category,
        cidade: l.city,
        origem: l.source,
        etapa: ETAPAS_DA_PRE_VENDA.includes(etapa) ? etapa : 'novo',
        naEtapaDesde,
        pais,
        telefone: l.phone,
        email: l.email,
        publicToken: l.public_token,
        diagViews: l.diag_views,
        notas: l.notes,
        briefing: briefingTexto,
        descoberta: Object.entries(discovery)
          .filter(([, v]) => (Array.isArray(v) ? v.length : String(v ?? '').trim()))
          .map(([k, v]) => `${CHECKLIST.find((q) => q.chave === k)?.pergunta ?? k} ${Array.isArray(v) ? v.join(', ') : v}`),
        pesquisa:
          pesquisa && typeof pesquisa === 'object'
            ? {
                resumo: typeof pesquisa.resumo === 'string' ? pesquisa.resumo : null,
                itens: (Array.isArray(pesquisa.itens) ? pesquisa.itens : [])
                  .filter((i) => typeof i?.campo === 'string' && typeof i?.valor === 'string')
                  .map((i) => ({ campo: i.campo as string, valor: i.valor as string })),
              }
            : null,
        conversa: conv
          ? {
              id: conv.id,
              resumo: conv.summary,
              modo: conv.mode,
              precisaDeVoce: conv.needs_human,
              ultimaEm: conv.last_message_at,
              ultimoDe: !msg ? null : msg.direction === 'in' ? 'cliente' : msg.author === 'ia' ? 'lia' : 'arthur',
              // A Meta só deixa mandar texto livre até 24 h depois da última mensagem do cliente.
              janelaAberta: !!conv.last_inbound_at && agora - Date.parse(conv.last_inbound_at) < 24 * 3600_000,
            }
          : null,
        reunioes: rs.map((r) => ({
          id: r.id,
          titulo: r.titulo,
          inicio: r.inicio,
          status: r.status,
          salaStatus: r.sala_status,
          resumo: r.resumo,
          link: r.meet_link,
        })),
        atualizacoes,
        pacote,
        sinal,
        passos,
        proximo: proximoPasso(
          { passo: p?.proximo_passo ?? null, quem: p?.proximo_responsavel ?? null, prazo: p?.proximo_prazo ?? null },
          atualizacoes
        ),
        ultimoMovimento: maior(conv?.last_message_at, l.last_contact_at, l.replied_at, l.first_contact_at, atualizacoes.at(-1)?.em, p?.updated_at, reuniaoFeita, l.created_at),
        prevenda: {
          existe: !!p,
          pendencias: pendenciasDoJson(p?.pendencias),
          proximoPasso: p?.proximo_passo ?? null,
          proximoResponsavel: p?.proximo_responsavel ?? null,
          proximoPrazo: p?.proximo_prazo ?? null,
          pasta: p?.pasta ?? null,
          briefingUrl: p?.briefing_url ?? null,
          designSystemUrl: p?.design_system_url ?? null,
          prototipoUrl: p?.prototipo_url ?? null,
          propostaUrl: p?.proposta_url ?? null,
          desconto: p?.desconto === null || p?.desconto === undefined ? null : Number(p.desconto),
          valorProposta: p?.valor_proposta === null || p?.valor_proposta === undefined ? null : Number(p.valor_proposta),
          propostaEnviadaEm: p?.proposta_enviada_em ?? null,
          prazoPrometido: p?.prazo_prometido ?? null,
          observacoes: p?.observacoes ?? null,
        },
      };
    }),
  };
}

/* ------------------------------------------------------------ gravação */

export type AlteracaoDaPreVenda = Partial<{
  passo: { chave: ChavePasso; valor: PassoManual | null };
  pendencias: Pendencia[];
  proximoPasso: string | null;
  proximoResponsavel: string | null;
  proximoPrazo: string | null;
  pasta: string | null;
  briefingUrl: string | null;
  designSystemUrl: string | null;
  prototipoUrl: string | null;
  propostaUrl: string | null;
  desconto: number | null;
  valorProposta: number | null;
  propostaEnviadaEm: string | null;
  prazoPrometido: string | null;
  observacoes: string | null;
}>;

const texto = (v: string | null | undefined, max: number) => (v?.trim() ? v.trim().slice(0, max) : null);
const data = (v: string | null | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const url = (v: string | null | undefined) => {
  const t = texto(v, 1000);
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};
const valor = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null);

/** Grava o que o Arthur mudou na pré-venda de um lead (cria a linha na primeira vez). */
export async function salvarPreVendaAction(leadId: string, a: AlteracaoDaPreVenda): Promise<ActionResult> {
  const supabase = await admin();
  if (!supabase) return errResult('Sem permissão.');
  const { data: atual, error: erroLeitura } = await supabase.from('prevenda').select('passos').eq('lead_id', leadId).maybeSingle();
  if (erroLeitura) return errResult('A tabela da pré-venda ainda não foi criada no banco (migration 0114).');

  const c: TablesUpdate<'prevenda'> = { updated_at: new Date().toISOString() };
  if (a.passo) {
    if (!PASSOS.some((p) => p.chave === a.passo!.chave)) return errResult('Passo inválido.');
    const passos = { ...passosDoJson(atual?.passos) };
    if (a.passo.valor) passos[a.passo.chave] = { estado: a.passo.valor.estado, em: data(a.passo.valor.em) };
    else delete passos[a.passo.chave];
    c.passos = passos;
  }
  if (a.pendencias !== undefined) c.pendencias = pendenciasDoJson(a.pendencias).slice(0, 60);
  if (a.proximoPasso !== undefined) c.proximo_passo = texto(a.proximoPasso, 500);
  if (a.proximoResponsavel !== undefined) c.proximo_responsavel = texto(a.proximoResponsavel, 80);
  if (a.proximoPrazo !== undefined) c.proximo_prazo = data(a.proximoPrazo);
  if (a.pasta !== undefined) c.pasta = texto(a.pasta, 300);
  if (a.briefingUrl !== undefined) c.briefing_url = url(a.briefingUrl);
  if (a.designSystemUrl !== undefined) c.design_system_url = url(a.designSystemUrl);
  if (a.prototipoUrl !== undefined) c.prototipo_url = url(a.prototipoUrl);
  if (a.propostaUrl !== undefined) c.proposta_url = url(a.propostaUrl);
  if (a.desconto !== undefined) c.desconto = valor(a.desconto);
  if (a.valorProposta !== undefined) c.valor_proposta = valor(a.valorProposta);
  if (a.propostaEnviadaEm !== undefined) c.proposta_enviada_em = data(a.propostaEnviadaEm) ? `${a.propostaEnviadaEm}T12:00:00-03:00` : null;
  if (a.prazoPrometido !== undefined) c.prazo_prometido = data(a.prazoPrometido);
  if (a.observacoes !== undefined) c.observacoes = texto(a.observacoes, 20000);

  const { error } = await supabase.from('prevenda').upsert({ ...c, lead_id: leadId }, { onConflict: 'lead_id' });
  if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar a pré-venda.'));
  revalidatePath('/admin/pre-venda');
  return okResult('Pré-venda salva.');
}
