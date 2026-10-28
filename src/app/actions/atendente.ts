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
import { responderConversa } from '@/lib/atendente/agente';

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
    body: `Orientação do Arthur (o cliente não vê; siga agora): ${texto}`,
  });
  if (error) return errResult(friendlyDbError(error, 'Não foi possível registrar a orientação.'));
  const motivo = await responderConversa(conversaId);
  revalidatePath('/admin/captacao');
  return motivo ? errResult(`A Lia não respondeu: ${motivo}.`) : okResult('A Lia respondeu seguindo a orientação.');
}
