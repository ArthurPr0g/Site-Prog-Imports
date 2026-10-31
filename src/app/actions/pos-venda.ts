'use server';

// Pós-venda da Prog Soluções (aba /admin/pos-venda; P1–P9 do docs/CAPTACAO-BACKLOG.md):
// registrar venda, projeto (status, entrega, orçamento/contrato do ERP), rodadas de
// ajuste (abrir, entregar, aceite), reuniões e ata. Tudo com a sessão do admin (RLS);
// o aviso no WhatsApp do Arthur e o Google Agenda usam a chave do atendente.

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';
import { dbDoAtendente } from '@/lib/atendente/db';
import { lerConfig } from '@/lib/atendente/agente';
import { avisarArthur } from '@/lib/atendente/avisos';
import { calcularProposta } from '@/lib/atendente/regras';
import { tabelaBRL, TABELA_USD } from '@/lib/precos-captacao';
import { etapasDoDesign, type EtapasDoDesign, type PedidosDesign } from '@/lib/pedidos-design';
import { criarProjetoDaVenda, abrirRodada, escolhaDoJson, prazosDoCatalogo } from '@/lib/pos-venda';
import { agendaConectada, criarEventoNaAgenda } from '@/lib/google-agenda';
import type { Escolha } from '@/lib/simulador';
import { SITE_URL } from '@/lib/seo';

async function admin() {
  return (await requireAdmin()) ? createClient() : null;
}
const revalidar = () => revalidatePath('/admin/pos-venda');

/* ------------------------------------------------------------ leitura */

export type ProjetoDoPainel = {
  id: string;
  leadId: string | null;
  cliente: string;
  responsavel: string | null;
  vendidoPor: string;
  vendidoEm: string;
  moeda: 'BRL' | 'USD';
  valor: number | null;
  mensal: number | null;
  prazoDias: number;
  entregaPrevista: string | null;
  entregueEm: string | null;
  status: 'em_andamento' | 'entregue' | 'em_suporte' | 'encerrado';
  observacoes: string | null;
  /** Pasta do código e site publicado: a Lia faz ajustes simples pedidos pelo cliente só nessa pasta (0101). */
  pasta: string | null;
  siteUrl: string | null;
  orcamento: { id: string; titulo: string } | null;
  contato: { telefone: string | null; email: string | null };
  sinal: { valor: number; pagoEm: string | null; status: string } | null;
  servicos: { id: string; tipo: string; nome: string; rodadasIncluidas: number; suporteDias: number; prazoDias: number }[];
  rodadas: {
    id: string;
    servicoId: string;
    numero: number;
    extra: boolean;
    pedido: string;
    pedidoEm: string;
    atendidoPor: string | null;
    entregueEm: string | null;
    aceiteEm: string | null;
    status: 'aberta' | 'entregue' | 'aceita';
  }[];
  reunioes: { id: string; titulo: string; inicio: string; link: string | null; rodadaId: string | null; ata: string | null }[];
  /** Pedidos do Claude Design (0106): só liberados depois das etapas anteriores. */
  design: EtapasDoDesign & {
    pedidoEm: string | null;
    duda: string | null;
    nina: string | null;
    /** Caminho integrado: links dos artifacts no Claude e a aprovação do Arthur. */
    dudaLink: string | null;
    ninaLink: string | null;
    aprovadoEm: string | null;
  };
};

export async function painelDoPosVendaAction(): Promise<{ projetos: ProjetoDoPainel[]; orcamentos: { id: string; titulo: string }[] } | null> {
  const supabase = await admin();
  if (!supabase) return null;
  const [{ data: projetos }, { data: orcamentos }] = await Promise.all([
    supabase
      .from('projetos')
      .select(
        '*, projeto_servicos(*), rodadas(*), reunioes(id, titulo, inicio, meet_link, rodada_id, ata, status), service_quotes(id, title), leads(phone, email, briefing_confirmado_em, cobrancas(parcela, valor, pago_em, status))'
      )
      .order('vendido_em', { ascending: false })
      .limit(200),
    supabase.from('service_quotes').select('id, title, created_at').order('created_at', { ascending: false }).limit(60),
  ]);
  // Financeiro das indicações (encomendas): pago, sinal ou de graça libera o design.
  const leadIds = (projetos ?? []).map((p) => p.lead_id).filter(Boolean) as string[];
  const { data: encomendas } = leadIds.length
    ? await supabase.from('encomendas').select('lead_id, pagamento').in('lead_id', leadIds).neq('status', 'cancelada')
    : { data: [] };
  const pagamentoDo = new Map((encomendas ?? []).map((e) => [e.lead_id, e.pagamento]));
  return {
    orcamentos: (orcamentos ?? []).map((o) => ({ id: o.id, titulo: o.title })),
    projetos: (projetos ?? []).map((p) => {
      const sinal = (p.leads?.cobrancas ?? []).find((c) => c.parcela === 'sinal');
      const pedidos = (p.pedidos_design ?? {}) as PedidosDesign;
      const etapas = etapasDoDesign({
        pasta: p.pasta,
        sinalPago: !!sinal?.pago_em,
        pagamentoDaIndicacao: p.lead_id ? (pagamentoDo.get(p.lead_id) ?? null) : null,
        temPrestacao: !!p.service_order_id,
        briefingConfirmadoEm: p.briefing_confirmado_em ?? p.leads?.briefing_confirmado_em ?? null,
        pedidos,
      });
      return {
        id: p.id,
        leadId: p.lead_id,
        cliente: p.cliente,
        responsavel: p.responsavel,
        vendidoPor: p.vendido_por,
        vendidoEm: p.vendido_em,
        moeda: p.moeda as 'BRL' | 'USD',
        valor: p.valor === null ? null : Number(p.valor),
        mensal: p.mensal === null ? null : Number(p.mensal),
        prazoDias: p.prazo_dias,
        entregaPrevista: p.entrega_prevista,
        entregueEm: p.entregue_em,
        status: p.status as ProjetoDoPainel['status'],
        observacoes: p.observacoes,
        pasta: p.pasta,
        siteUrl: p.site_url,
        orcamento: p.service_quotes ? { id: p.service_quotes.id, titulo: p.service_quotes.title } : null,
        contato: { telefone: p.leads?.phone ?? null, email: p.leads?.email ?? null },
        sinal: sinal ? { valor: Number(sinal.valor), pagoEm: sinal.pago_em, status: sinal.status } : null,
        servicos: (p.projeto_servicos ?? [])
          .sort((a, b) => a.posicao - b.posicao)
          .map((s) => ({ id: s.id, tipo: s.tipo, nome: s.nome, rodadasIncluidas: s.rodadas_incluidas, suporteDias: s.suporte_dias, prazoDias: s.prazo_dias })),
        rodadas: (p.rodadas ?? [])
          .sort((a, b) => a.pedido_em.localeCompare(b.pedido_em))
          .map((r) => ({
            id: r.id,
            servicoId: r.servico_id,
            numero: r.numero,
            extra: r.extra,
            pedido: r.pedido,
            pedidoEm: r.pedido_em,
            atendidoPor: r.atendido_por,
            entregueEm: r.entregue_em,
            aceiteEm: r.aceite_em,
            status: r.status as 'aberta' | 'entregue' | 'aceita',
          })),
        reunioes: (p.reunioes ?? [])
          .filter((r) => r.status === 'marcada')
          .sort((a, b) => a.inicio.localeCompare(b.inicio))
          .map((r) => ({ id: r.id, titulo: r.titulo, inicio: r.inicio, link: r.meet_link, rodadaId: r.rodada_id, ata: r.ata })),
        design: { ...etapas, pedidoEm: pedidos.pedido_em ?? null, duda: etapas.prontos ? (pedidos.duda ?? null) : null, nina: etapas.prontos ? (pedidos.nina ?? null) : null, dudaLink: pedidos.duda_link ?? null, ninaLink: pedidos.nina_link ?? null, aprovadoEm: pedidos.aprovado_em ?? null },
      };
    }),
  };
}

/** Leads para "Registrar venda" (busca pelo nome; os em negociação primeiro). */
export async function buscarLeadsParaVendaAction(busca: string): Promise<{ id: string; nome: string; status: string; pacote: Escolha | null }[]> {
  const supabase = await admin();
  if (!supabase || busca.trim().length < 2) return [];
  const { data } = await supabase
    .from('leads')
    .select('id, name, status, pacote')
    .ilike('name', `%${busca.trim().replace(/[%_]/g, '')}%`)
    .order('updated_at', { ascending: false })
    .limit(8);
  return (data ?? []).map((l) => ({ id: l.id, nome: l.name, status: l.status, pacote: escolhaDoJson(l.pacote) }));
}

/* ------------------------------------------------------------ venda */

/** P1: registra a venda (com ou sem lead) e cria o projeto. Valor vazio = preço da tabela do pacote. */
export async function registrarVendaAction(v: {
  leadId: string | null;
  cliente: string;
  escolha: Escolha;
  vendidoPor: string;
  moeda: 'BRL' | 'USD';
  valor: number | null;
  /** Mensalidade combinada (vazio = a da tabela do pacote). Vem da Pré-venda. */
  mensal?: number | null;
}): Promise<ActionResult> {
  const supabase = await admin();
  if (!supabase) return errResult('Sem permissão.');
  const db = dbDoAtendente();
  const { data: servicos } = await db.from('internal_services').select('name, price').eq('active', true);
  const tabela = v.moeda === 'USD' ? TABELA_USD : tabelaBRL(new Map((servicos ?? []).map((s) => [s.name, Number(s.price)])));
  const prop = calcularProposta(v.escolha, tabela, 0, await prazosDoCatalogo(db));
  const valor = v.valor && v.valor > 0 ? v.valor : prop.total;
  const mensal = typeof v.mensal === 'number' && v.mensal >= 0 ? v.mensal : prop.mensal;
  let cliente = v.cliente.trim();
  if (v.leadId) {
    const { data: l } = await supabase.from('leads').select('name, closed_at').eq('id', v.leadId).maybeSingle();
    if (!l) return errResult('Lead não encontrado.');
    cliente = cliente || l.name;
    const agora = new Date().toISOString();
    const { error } = await supabase
      .from('leads')
      .update({
        status: 'fechado',
        closed_at: l.closed_at ?? agora,
        closed_value: valor,
        closed_monthly: mensal,
        closed_currency: v.moeda,
        pacote: v.escolha as never,
        next_contact: null,
        updated_at: agora,
      })
      .eq('id', v.leadId);
    if (error) return errResult(friendlyDbError(error, 'Não foi possível marcar o lead como fechado.'));
  }
  if (!cliente) return errResult('Informe o cliente.');
  const r = await criarProjetoDaVenda(db, {
    leadId: v.leadId,
    cliente,
    vendidoPor: v.vendidoPor.trim() || 'Arthur',
    escolha: v.escolha,
    moeda: v.moeda,
    valor,
    mensal,
  });
  if ('erro' in r) return errResult(r.erro);
  revalidar();
  revalidatePath('/admin/captacao');
  return okResult(r.novo ? 'Venda registrada: o projeto foi criado.' : 'Esse lead já tinha projeto: abri o existente.');
}

/* ------------------------------------------------------------ projeto */

export async function atualizarProjetoAction(
  id: string,
  c: Partial<{ status: ProjetoDoPainel['status']; entregaPrevista: string | null; entregueEm: string | null; observacoes: string | null; responsavel: string | null; orcamentoId: string | null; pasta: string | null; siteUrl: string | null }>
): Promise<ActionResult> {
  const supabase = await admin();
  if (!supabase) return errResult('Sem permissão.');
  const { error } = await supabase
    .from('projetos')
    .update({
      ...(c.status !== undefined ? { status: c.status } : {}),
      ...(c.entregaPrevista !== undefined ? { entrega_prevista: c.entregaPrevista || null } : {}),
      ...(c.entregueEm !== undefined ? { entregue_em: c.entregueEm || null } : {}),
      ...(c.observacoes !== undefined ? { observacoes: c.observacoes } : {}),
      ...(c.responsavel !== undefined ? { responsavel: c.responsavel } : {}),
      ...(c.orcamentoId !== undefined ? { service_quote_id: c.orcamentoId || null } : {}),
      ...(c.pasta !== undefined ? { pasta: c.pasta?.trim() || null } : {}),
      ...(c.siteUrl !== undefined ? { site_url: c.siteUrl?.trim() || null } : {}),
    })
    .eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar.'));
  revalidar();
  return okResult('Salvo.');
}

/* ------------------------------------------------------------ rodadas */

/** P3/P4: abre a rodada; acima do incluído ela nasce extra e o Arthur é avisado (vira orçamento). */
export async function novaRodadaAction(projetoId: string, servicoId: string, pedido: string, atendidoPor: string): Promise<ActionResult> {
  const supabase = await admin();
  if (!supabase) return errResult('Sem permissão.');
  if (!pedido.trim()) return errResult('Descreva o que o cliente pediu.');
  const db = dbDoAtendente();
  const r = await abrirRodada(db, { projetoId, servicoId, pedido: pedido.trim(), atendidoPor: atendidoPor.trim() || null });
  if ('erro' in r) return errResult(r.erro);
  if (r.extra) {
    const { data: p } = await db.from('projetos').select('cliente, lead_id').eq('id', projetoId).maybeSingle();
    await avisarArthur(db, await lerConfig(db), {
      titulo: 'Rodada além do contrato',
      texto: `${p?.cliente ?? 'Cliente'} pediu a ${r.numero}ª rodada (o contrato inclui ${r.incluidas}). Orce antes de fazer: "${pedido.trim().slice(0, 160)}"`,
      leadId: p?.lead_id ?? null,
      link: `${SITE_URL}/admin/pos-venda`,
    });
  }
  revalidar();
  return okResult(r.extra ? `Rodada ${r.numero} aberta como EXTRA: o contrato inclui ${r.incluidas}. Orce antes de fazer.` : `Rodada ${r.numero} aberta.`);
}

export async function marcarRodadaAction(rodadaId: string, passo: 'entregue' | 'aceita'): Promise<ActionResult> {
  const supabase = await admin();
  if (!supabase) return errResult('Sem permissão.');
  const agora = new Date().toISOString();
  const { error } = await supabase
    .from('rodadas')
    .update(passo === 'entregue' ? { status: 'entregue', entregue_em: agora } : { status: 'aceita', aceite_em: agora })
    .eq('id', rodadaId);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar.'));
  revalidar();
  return okResult(passo === 'entregue' ? 'Rodada entregue: o cliente tem 5 dias úteis para aprovar.' : 'Aceite registrado.');
}

/* ------------------------------------------------------------ reuniões */

/** P5: reunião do projeto (ou de uma rodada). Com o Google Agenda conectado, entra lá com Meet. */
export async function marcarReuniaoDoProjetoAction(r: {
  projetoId: string;
  rodadaId: string | null;
  inicio: string;
  duracaoMin: number;
  link: string;
  assunto: string;
}): Promise<ActionResult> {
  const supabase = await admin();
  if (!supabase) return errResult('Sem permissão.');
  const inicio = new Date(r.inicio);
  if (!Number.isFinite(inicio.getTime())) return errResult('Data inválida.');
  const fim = new Date(inicio.getTime() + Math.max(15, r.duracaoMin || 30) * 60_000);
  const db = dbDoAtendente();
  const { data: p } = await db.from('projetos').select('cliente, lead_id, leads(email)').eq('id', r.projetoId).maybeSingle();
  const titulo = `Prog Soluções × ${p?.cliente ?? 'cliente'}: ${r.assunto.trim() || 'reunião do projeto'}`;
  const ev = (await agendaConectada(db))
    ? await criarEventoNaAgenda(db, {
        titulo,
        descricao: 'Reunião do pós-venda (painel da Prog).',
        inicio,
        fim,
        emailCliente: p?.leads?.email ?? null,
      })
    : null;
  const { error } = await supabase.from('reunioes').insert({
    projeto_id: r.projetoId,
    rodada_id: r.rodadaId,
    lead_id: p?.lead_id ?? null,
    titulo,
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    google_event_id: ev?.ok ? ev.id : null,
    meet_link: r.link.trim() || (ev?.ok ? ev.meet : null),
  });
  if (error) return errResult(friendlyDbError(error, 'Não foi possível marcar.'));
  revalidar();
  return okResult(ev?.ok ? 'Reunião marcada e colocada na sua agenda.' : 'Reunião registrada. (Agenda do Google não conectada: crie o evento você.)');
}

export async function salvarAtaAction(reuniaoId: string, ata: string): Promise<ActionResult> {
  const supabase = await admin();
  if (!supabase) return errResult('Sem permissão.');
  const { error } = await supabase.from('reunioes').update({ ata: ata.trim().slice(0, 8000) || null }).eq('id', reuniaoId);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar.'));
  revalidar();
  return okResult('Ata salva.');
}

/** Exclui o projeto (venda cancelada ou teste), com os serviços, as rodadas e o vínculo das reuniões. */
export async function excluirProjetoAction(id: string): Promise<ActionResult> {
  const supabase = await admin();
  if (!supabase) return errResult('Sem permissão.');
  const { error } = await supabase.from('projetos').delete().eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível excluir.'));
  revalidar();
  return okResult('Projeto excluído.');
}

/** O Arthur marca à mão que a descoberta foi confirmada (quando a confirmação veio fora da Lia, ex.: reunião). */
export async function marcarDescobertaConfirmadaAction(projetoId: string): Promise<ActionResult> {
  const supabase = await admin();
  if (!supabase) return errResult('Sem permissão.');
  const { error } = await supabase.from('projetos').update({ briefing_confirmado_em: new Date().toISOString() }).eq('id', projetoId);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível marcar.'));
  revalidatePath('/admin/pos-venda');
  return okResult('Descoberta marcada como confirmada. Se o resto estiver ok, a Bia prepara os pedidos do Claude Design.');
}
