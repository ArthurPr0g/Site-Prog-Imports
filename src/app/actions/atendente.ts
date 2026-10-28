'use server';

// Painel do atendente de IA (aba Atendimento da Captação): ler conversas,
// responder como Arthur, assumir/devolver para a IA, decidir o desconto extra
// e configurar. Tudo com a sessão do admin (RLS); só o envio pelo WhatsApp usa
// o token da Meta, que fica no servidor.

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';
import { enviarTexto, whatsappConfigurado, JANELA_MS } from '@/lib/atendente/whatsapp-api';
import { emailConfigurado } from '@/lib/atendente/email';
import {
  MODELOS_DA_IA,
  type ConfigDoAtendente,
  type ConversaDoPainel,
  type LicaoDaLia,
  type MensagemDoPainel,
  type ModeloDaIA,
  type PainelDoAtendente,
  type PedidoDeDesconto,
} from '@/lib/atendente/regras';
import type { LeadStatus } from '@/lib/captacao';
import { respondidas, type RespostasDoChecklist } from '@/lib/checklist-descoberta';
import { responderConversa, SIMULADOR } from '@/lib/atendente/agente';
import { dbDoAtendente } from '@/lib/atendente/db';
import { agendaConectada, googleConfigurado } from '@/lib/google-agenda';
import { SELECT_DO_ITEM, emailDoLead, regiaoDoLead, type ItemComLead } from '@/lib/atendente/email-do-lead';
import { enviarEmail } from '@/lib/atendente/email';
import { lerConfig } from '@/lib/atendente/agente';
import { emailDeVerdade } from '@/lib/captacao';

async function adminClient() {
  const admin = await requireAdmin();
  if (!admin) return null;
  return createClient();
}

const inicioDoMes = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};
const inicioDoDia = () => {
  const d = new Date(Date.now() - 3 * 3600_000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 3)).toISOString();
};

export async function painelDoAtendenteAction(): Promise<PainelDoAtendente | null> {
  const supabase = await adminClient();
  if (!supabase) return null;

  const [cfg, conversas, pedidos, uso, saidas, emails, licoes, gastos, avisos] = await Promise.all([
    supabase.from('ia_config').select('*').eq('id', true).maybeSingle(),
    supabase
      .from('ia_conversations')
      .select(
        '*, leads(name, status, first_contact_at, replied_at, closed_at, diag_last_view_at, discovery, cobrancas(parcela, valor, link, pago_em, status, created_at)), ia_messages(body, created_at)'
      )
      // Conversas do simulador ficam só na seção "Testar a Lia".
      .not('contact_id', 'like', 'simulador:%')
      .order('last_message_at', { ascending: false })
      .order('created_at', { referencedTable: 'ia_messages', ascending: false })
      .limit(1, { referencedTable: 'ia_messages' })
      .limit(150),
    supabase
      .from('ia_discount_requests')
      .select('*, leads(name)')
      .order('created_at', { ascending: false })
      .limit(30),
    supabase.from('ia_gasto_por_mes').select('custo_usd').eq('mes', inicioDoMes()).maybeSingle(),
    supabase
      .from('ia_messages')
      .select('id', { count: 'exact', head: true })
      .eq('direction', 'out')
      .in('author', ['ia', 'arthur'])
      .gte('created_at', inicioDoMes()),
    supabase.from('ia_emails').select('id', { count: 'exact', head: true }).eq('step', 0).gte('sent_at', inicioDoDia()),
    supabase
      .from('ia_aprendizados')
      .select('id, tipo, ramo, texto, exemplo, status, vezes, created_at')
      .neq('status', 'descartado')
      .order('vezes', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('ia_gasto_por_conversa').select('conversation_id, custo_usd'),
    supabase.from('ia_avisos').select('titulo, via, status, error, created_at').order('created_at', { ascending: false }).limit(8),
  ]);
  const gastoPorConversa = new Map((gastos.data ?? []).map((g) => [g.conversation_id, Number(g.custo_usd ?? 0)]));

  const c = cfg.data;
  const config: ConfigDoAtendente = {
    personaName: c?.persona_name ?? 'Lia',
    active: c?.active ?? false,
    model: (c?.model ?? 'claude-opus-5-5') as ModeloDaIA,
    autoModel: c?.auto_model ?? true,
    monthlyBudgetUsd: Number(c?.monthly_budget_usd ?? 30),
    extraDiscountMax: Number(c?.extra_discount_max ?? 10),
    discountWaitMinutes: c?.discount_wait_minutes ?? 6,
    dailyEmailCap: c?.daily_email_cap ?? 15,
    ownerEmail: c?.owner_email ?? null,
  };

  return {
    config,
    conversas: (conversas.data ?? []).map(
      (v): ConversaDoPainel => ({
        id: v.id,
        channel: v.channel as ConversaDoPainel['channel'],
        contactId: v.contact_id,
        contactName: v.contact_name,
        leadId: v.lead_id,
        leadName: v.leads?.name ?? null,
        leadStatus: (v.leads?.status as LeadStatus | undefined) ?? null,
        kitId: v.kit_id,
        mode: v.mode as ConversaDoPainel['mode'],
        needsHuman: v.needs_human,
        needsHumanReason: v.needs_human_reason,
        summary: v.summary,
        lastInboundAt: v.last_inbound_at,
        lastMessageAt: v.last_message_at,
        unread: v.unread,
        ultimaMensagem: v.ia_messages?.[0]?.body ?? null,
        descoberta: (v.leads?.discovery ?? {}) as RespostasDoChecklist,
        gastoUsd: gastoPorConversa.get(v.id) ?? 0,
        isTest: v.is_test,
        marcos: {
          contatado: v.leads?.first_contact_at ?? null,
          respondeu: v.leads?.replied_at ?? null,
          fechado: v.leads?.closed_at ?? null,
          diagnosticoVisto: v.leads?.diag_last_view_at ?? null,
          descoberta: respondidas((v.leads?.discovery ?? {}) as RespostasDoChecklist),
          sinal: (() => {
            const s = (v.leads?.cobrancas ?? [])
              .filter((c) => c.parcela === 'sinal')
              .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
            return s ? { valor: Number(s.valor), link: s.link, pagoEm: s.pago_em, status: s.status } : null;
          })(),
        },
      })
    ),
    pedidos: (pedidos.data ?? []).map(
      (p): PedidoDeDesconto => ({
        id: p.id,
        conversationId: p.conversation_id,
        leadName: p.leads?.name ?? null,
        percent: Number(p.percent),
        reason: p.reason,
        status: p.status as PedidoDeDesconto['status'],
        releaseAt: p.release_at,
        createdAt: p.created_at,
      })
    ),
    licoes: (licoes.data ?? []).map(
      (a): LicaoDaLia => ({
        id: a.id,
        tipo: a.tipo as LicaoDaLia['tipo'],
        ramo: a.ramo,
        texto: a.texto,
        exemplo: a.exemplo,
        status: a.status as LicaoDaLia['status'],
        vezes: a.vezes,
        createdAt: a.created_at,
      })
    ),
    gastoDoMes: Number(uso.data?.custo_usd ?? 0),
    mensagensDoMes: saidas.count ?? 0,
    emailsHoje: emails.count ?? 0,
    integracoes: {
      whatsapp: whatsappConfigurado() && !!process.env.WHATSAPP_VERIFY_TOKEN,
      email: emailConfigurado(),
      ia: !!process.env.ANTHROPIC_API_KEY,
      banco: !!process.env.ATENDENTE_SUPABASE_KEY,
      relogio: !!process.env.ATENDENTE_TICK_SECRET,
    },
    agenda: !googleConfigurado() ? 'sem_chaves' : (await agendaConectada(dbDoAtendente())) ? 'conectada' : 'desconectada',
    avisos: {
      whatsappDoDono: c?.owner_whatsapp ?? null,
      modelo: c?.aviso_template_status ?? null,
      janelaAberta: !!c?.owner_last_inbound_at && Date.now() - new Date(c.owner_last_inbound_at).getTime() < JANELA_MS,
      ultimos: (avisos.data ?? []).map((a) => ({ titulo: a.titulo, via: a.via, status: a.status, erro: a.error, criadoEm: a.created_at })),
    },
  };
}

export async function mensagensDaConversaAction(id: string): Promise<MensagemDoPainel[]> {
  const supabase = await adminClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('ia_messages')
    .select('id, direction, author, body, status, error, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })
    .limit(400);
  await supabase.from('ia_conversations').update({ unread: 0 }).eq('id', id).gt('unread', 0);
  return (data ?? []).map((m) => ({
    id: m.id,
    direction: m.direction as MensagemDoPainel['direction'],
    author: m.author as MensagemDoPainel['author'],
    body: m.body,
    status: m.status,
    error: m.error,
    createdAt: m.created_at,
  }));
}

/** O Arthur responde pelo painel: a conversa passa para ele (a IA fica calada até ele devolver). */
export async function responderComoArthurAction(conversaId: string, texto: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const corpo = texto.trim();
  if (!corpo) return errResult('Escreva a mensagem.');
  const { data: c } = await supabase
    .from('ia_conversations')
    .select('contact_id, channel, last_inbound_at')
    .eq('id', conversaId)
    .maybeSingle();
  if (!c) return errResult('Conversa não encontrada.');
  if (c.channel !== 'whatsapp') return errResult('Por enquanto só dá para responder pelo WhatsApp.');
  if (!c.last_inbound_at || Date.now() - new Date(c.last_inbound_at).getTime() > JANELA_MS) {
    return errResult('Passaram 24 h da última mensagem do cliente: o WhatsApp só deixa responder com modelo aprovado. Ligue ou mande pelo seu WhatsApp.');
  }
  const r = await enviarTexto(c.contact_id, corpo);
  await supabase.from('ia_messages').insert({
    conversation_id: conversaId,
    direction: 'out',
    author: 'arthur',
    body: corpo,
    ...(r.ok ? { external_id: r.id, status: 'sent' } : { status: 'failed', error: r.erro }),
  });
  await supabase
    .from('ia_conversations')
    .update({ mode: 'humano', needs_human: false, last_message_at: new Date().toISOString() })
    .eq('id', conversaId);
  return r.ok ? okResult('Enviada. A conversa ficou com você: devolva para a IA quando quiser.') : errResult(`Não saiu: ${r.erro}`);
}

export async function alternarModoAction(conversaId: string, modo: 'ia' | 'humano'): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const { error } = await supabase
    .from('ia_conversations')
    .update({ mode: modo, ...(modo === 'humano' ? { needs_human: false } : {}) })
    .eq('id', conversaId);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível mudar.'));
  return okResult(modo === 'ia' ? 'A IA volta a responder a partir da próxima mensagem do cliente.' : 'A conversa é sua: a IA não responde mais.');
}

export async function resolverChamadoAction(conversaId: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const { error } = await supabase
    .from('ia_conversations')
    .update({ needs_human: false, needs_human_reason: null })
    .eq('id', conversaId);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível marcar.'));
  return okResult('Marcado como resolvido.');
}

/** Aprovar (com o texto editado), descartar ou desativar uma lição da Lia. Vale a partir da próxima resposta dela. */
export async function decidirLicaoAction(id: string, status: 'ativo' | 'descartado', texto?: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const limpo = texto?.trim();
  if (limpo !== undefined && (limpo.length < 5 || limpo.length > 400)) return errResult('A lição precisa ter entre 5 e 400 caracteres.');
  const { error } = await supabase
    .from('ia_aprendizados')
    .update({ status, decided_at: new Date().toISOString(), ...(limpo ? { texto: limpo } : {}) })
    .eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar.'));
  return okResult(status === 'ativo' ? 'Aprovada: a Lia usa a partir da próxima resposta.' : 'Descartada: a Lia não usa mais.');
}

/** Liberar já ou negar o desconto extra. A IA responde ao cliente no próximo minuto (tick). */
export async function decidirDescontoAction(id: string, decisao: 'aprovado' | 'negado'): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  const { data, error } = await supabase
    .from('ia_discount_requests')
    .update({ status: decisao, decided_by: 'arthur', decided_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'aguardando')
    .select('id');
  if (error) return errResult(friendlyDbError(error, 'Não foi possível decidir.'));
  if (!data?.length) return errResult('Este pedido já foi decidido.');
  return okResult(decisao === 'aprovado' ? 'Liberado: a IA avisa o cliente em até 1 minuto.' : 'Negado: a IA avisa o cliente em até 1 minuto.');
}

export async function salvarConfigAtendenteAction(c: ConfigDoAtendente): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');
  if (!c.personaName.trim()) return errResult('Informe o nome da atendente.');
  if (!MODELOS_DA_IA.some((m) => m.id === c.model)) return errResult('Modelo inválido.');
  const { error } = await supabase
    .from('ia_config')
    .update({
      persona_name: c.personaName.trim(),
      active: c.active,
      model: c.model,
      auto_model: c.autoModel,
      monthly_budget_usd: Math.max(0, c.monthlyBudgetUsd),
      extra_discount_max: Math.min(Math.max(0, c.extraDiscountMax), 30),
      discount_wait_minutes: Math.min(Math.max(1, Math.round(c.discountWaitMinutes)), 120),
      daily_email_cap: Math.min(Math.max(0, Math.round(c.dailyEmailCap)), 200),
      owner_email: c.ownerEmail?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', true);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar.'));
  // O nome da IA também é o "vendedor" do link dela.
  await supabase.from('lead_seller_kits').update({ seller_name: c.personaName.trim() }).eq('kind', 'ia');
  revalidatePath('/admin/captacao');
  return okResult(c.active ? 'Salvo. A atendente está ligada.' : 'Salvo. A atendente está desligada.');
}

/**
 * "Orientar a Lia": o Arthur dá uma instrução numa conversa (ex.: "mande os
 * exemplos você mesma") e ela responde ao cliente seguindo. A instrução fica no
 * histórico como aviso interno; o cliente não vê.
 */
export async function orientarLiaAction(conversaId: string, instrucao: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Sem permissão.');
  const texto = instrucao.trim().slice(0, 1000);
  if (!texto) return errResult('Escreva a orientação.');
  const { data: c } = await supabase.from('ia_conversations').select('mode').eq('id', conversaId).maybeSingle();
  if (!c) return errResult('Conversa não encontrada.');
  if (c.mode !== 'ia') return errResult('Você assumiu esta conversa: devolva para a IA antes de orientar.');
  const { error } = await supabase.from('ia_messages').insert({
    conversation_id: conversaId,
    direction: 'out',
    author: 'sistema',
    body: `Orientação do Arthur (o cliente não vê). Siga agora escrevendo SÓ a próxima mensagem para o cliente, falando com ele; não responda ao Arthur nem conte o que fez: ${texto}`,
  });
  if (error) return errResult(friendlyDbError(error, 'Não foi possível registrar a orientação.'));
  const motivo = await responderConversa(conversaId);
  revalidatePath('/admin/captacao');
  if (motivo?.startsWith('outra resposta')) return okResult('A Lia está terminando uma resposta; ela segue a orientação logo em seguida.');
  return motivo ? errResult(`A Lia não respondeu: ${motivo}.`) : okResult('A Lia respondeu seguindo a orientação.');
}

/* ------------------------------------------------------------ simulador */

/** Abre uma conversa de teste com a Lia (opcionalmente fingindo ser um lead). Nada sai pelo WhatsApp. */
export async function novaConversaDeTesteAction(leadId: string | null): Promise<{ id: string } | { erro: string }> {
  const supabase = await adminClient();
  if (!supabase) return { erro: 'Sem permissão.' };
  const { data, error } = await supabase
    .from('ia_conversations')
    .insert({
      channel: 'whatsapp',
      contact_id: `${SIMULADOR}${crypto.randomUUID()}`,
      contact_name: 'Teste do painel',
      lead_id: leadId,
      is_test: true,
      last_inbound_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error || !data) return { erro: friendlyDbError(error, 'Não foi possível abrir o teste.') };
  return { id: data.id };
}

/** Manda uma mensagem "do cliente" ao simulador e espera a Lia responder. */
export async function mensagemDeTesteAction(
  conversaId: string,
  texto: string
): Promise<{ mensagens: MensagemDoPainel[]; aviso: string | null }> {
  const supabase = await adminClient();
  if (!supabase) return { mensagens: [], aviso: 'Sem permissão.' };
  const { data: c } = await supabase.from('ia_conversations').select('contact_id').eq('id', conversaId).maybeSingle();
  if (!c?.contact_id.startsWith(SIMULADOR)) return { mensagens: [], aviso: 'Isto não é uma conversa de teste.' };
  const agora = new Date().toISOString();
  await supabase
    .from('ia_messages')
    .insert({ conversation_id: conversaId, direction: 'in', author: 'lead', body: texto.trim().slice(0, 2000), created_at: agora });
  await supabase.from('ia_conversations').update({ last_inbound_at: agora, last_message_at: agora }).eq('id', conversaId);
  const motivo = await responderConversa(conversaId);
  return { mensagens: await mensagensDaConversaAction(conversaId), aviso: motivo };
}

/* ------------------------------------------------------------ resultados da Lia */

export type ResultadosDaLia = {
  conversas: number;
  gastoTotal: number;
  propostas: number;
  reunioes: number;
  fechados: number;
  /** Conversas paradas há mais de 2 dias sem fechar nem perder, pela etapa em que pararam. */
  paradas: { etapa: string; quantas: number }[];
  /** As paradas mais recentes, com a última fala da Lia antes do silêncio. */
  exemplos: { conversaId: string; quem: string; etapa: string; ultimaDaLia: string | null; paradaHa: number }[];
  /** Média de mensagens do cliente até a Lia passar o preço. */
  mensagensDoClienteAtePreco: number | null;
};

const DOIS_DIAS = 2 * 24 * 3600_000;
const rotuloDaParada = (s: LeadStatus) =>
  s === 'proposta' ? 'depois do preço' : s === 'reuniao' ? 'com reunião marcada' : 'antes do preço';

export async function resultadosDaLiaAction(): Promise<ResultadosDaLia | null> {
  const supabase = await adminClient();
  if (!supabase) return null;
  const [{ data: conversas }, { data: gastos }] = await Promise.all([
    supabase
      .from('ia_conversations')
      .select('id, contact_name, last_inbound_at, leads(name, status)')
      .eq('is_test', false)
      .not('contact_id', 'like', 'simulador:%'),
    supabase.from('ia_gasto_por_conversa').select('conversation_id, custo_usd'),
  ]);
  const lista = conversas ?? [];
  const ids = new Set(lista.map((c) => c.id));
  const gastoTotal = (gastos ?? [])
    .filter((g) => g.conversation_id && ids.has(g.conversation_id))
    .reduce((s, g) => s + Number(g.custo_usd ?? 0), 0);
  const status = (c: (typeof lista)[number]) => (c.leads?.status as LeadStatus | undefined) ?? 'respondeu';

  const agora = Date.now();
  const paradas = lista.filter(
    (c) =>
      !['fechado', 'perdido', 'nao_contatar'].includes(status(c)) &&
      !!c.last_inbound_at &&
      agora - new Date(c.last_inbound_at).getTime() > DOIS_DIAS
  );
  const porEtapa = new Map<string, number>();
  for (const c of paradas) porEtapa.set(rotuloDaParada(status(c)), (porEtapa.get(rotuloDaParada(status(c))) ?? 0) + 1);

  const recentes = [...paradas].sort((a, b) => (b.last_inbound_at ?? '').localeCompare(a.last_inbound_at ?? '')).slice(0, 6);
  const exemplos = await Promise.all(
    recentes.map(async (c) => {
      const { data: m } = await supabase
        .from('ia_messages')
        .select('body')
        .eq('conversation_id', c.id)
        .eq('author', 'ia')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return {
        conversaId: c.id,
        quem: c.leads?.name ?? c.contact_name ?? 'sem nome',
        etapa: rotuloDaParada(status(c)),
        ultimaDaLia: m?.body ?? null,
        paradaHa: Math.floor((agora - new Date(c.last_inbound_at!).getTime()) / (24 * 3600_000)),
      };
    })
  );

  // Mensagens do cliente até a primeira proposta da Lia (o bloco com "Total:").
  const comPreco = lista.filter((c) => ['proposta', 'fechado'].includes(status(c)));
  const contagens = await Promise.all(
    comPreco.map(async (c) => {
      const { data: ms } = await supabase
        .from('ia_messages')
        .select('direction, author, body')
        .eq('conversation_id', c.id)
        .order('created_at', { ascending: true })
        .limit(300);
      let n = 0;
      for (const m of ms ?? []) {
        if (m.direction === 'in') n++;
        else if (m.author === 'ia' && /Total:/.test(m.body)) return n;
      }
      return null;
    })
  );
  const validas = contagens.filter((n): n is number => n !== null);

  return {
    conversas: lista.length,
    gastoTotal,
    propostas: comPreco.length,
    reunioes: lista.filter((c) => ['reuniao', 'proposta', 'fechado'].includes(status(c))).length,
    fechados: lista.filter((c) => status(c) === 'fechado').length,
    paradas: [...porEtapa].map(([etapa, quantas]) => ({ etapa, quantas })),
    exemplos,
    mensagensDoClienteAtePreco: validas.length ? validas.reduce((s, n) => s + n, 0) / validas.length : null,
  };
}

/**
 * "Enviar e-mail de teste": manda para as caixas do Arthur o mesmo 1º e-mail que
 * um lead do Brasil da lista da Lia vai receber, nas 2 versões (bonita e só texto),
 * igual ao real (sem marca de teste no assunto, que também pesa no filtro de spam).
 * Não registra envio nem mexe no lead.
 */
export async function enviarEmailDeTesteAction(paraLista: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Sem permissão.');
  const destinos = [...new Set(paraLista.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean))].slice(0, 5);
  if (!destinos.length || destinos.some((d) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d))) return errResult('Confira os e-mails.');
  if (!emailConfigurado()) return errResult('O e-mail ainda não está configurado na Vercel (SMTP_*).');
  const db = dbDoAtendente();
  const cfg = await lerConfig(db);
  const { data: itens } = await db
    .from('lead_kit_items')
    .select(SELECT_DO_ITEM)
    .eq('lead_seller_kits.kind', 'ia')
    .eq('lead_seller_kits.active', true)
    .order('position');
  const lista = (itens ?? []) as unknown as ItemComLead[];
  // O teste é para o Arthur ler: lead do Brasil primeiro (em português).
  const comEmail = lista.filter((x) => x.leads.email && emailDeVerdade(x.leads.email));
  const item =
    comEmail.find((x) => x.leads.country !== 'US' && x.leads.status === 'novo') ??
    comEmail.find((x) => x.leads.country !== 'US') ??
    comEmail[0];
  if (!item) return errResult('Nenhum lead com e-mail na lista da Lia.');
  const email = emailDoLead(cfg, item, 0, { regiao: await regiaoDoLead(db, item.leads) });
  if (!email) return errResult('O link da Lia está sem o WhatsApp dela: gere o link de novo na aba Vendedores.');
  const falhas: string[] = [];
  for (const para of destinos) {
    for (const versao of ['bonita', 'texto'] as const) {
      const r = await enviarEmail({
        para,
        assunto: email.assunto,
        texto: email.corpo,
        ...(versao === 'bonita' ? { html: email.html } : {}),
        nomeDoRemetente: `${cfg.personaName} | Prog Soluções`,
        responderPara: cfg.ownerEmail,
      });
      if (!r.ok) falhas.push(`${para} (${versao}): ${r.erro}`);
    }
  }
  if (falhas.length) return errResult(`Falhou: ${falhas.join('; ')}`);
  return okResult(
    `2 versões (bonita e só texto) enviadas para ${destinos.join(', ')}, com o e-mail de ${item.leads.name}. Veja em qual pasta cada uma caiu.`
  );
}
