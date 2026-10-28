// Relatório da captação no WhatsApp do dono (pedido do Arthur em 28/10/2026): ele
// manda "relatório" (ou "como está a captação?") do número dele para o da Lia e
// recebe na hora o funil, a meta do semestre e o custo da IA. Mesma conta do
// painel (resumoDaMeta, estimar pelo catálogo, dólar do dia). Leads de teste fora.

import type { DbDoAtendente } from '@/lib/atendente/db';
import type { ConfigDoAtendente } from '@/lib/atendente/regras';
import { buscarCotacaoMercado } from '@/lib/usd-rate';
import { TABELA_USD, tabelaBRL, estimar, emReais, type Cotacoes } from '@/lib/precos-captacao';
import { resumoDaMeta, type LeadDaMeta } from '@/lib/meta-captacao';
import type { LeadStatus } from '@/lib/captacao';
import { SITE_URL } from '@/lib/seo';

/** O dono está pedindo o relatório? */
export const PEDIDO_DE_RELATORIO = /relat[oó]rio|como (est[aá]|t[aá]|vai).{0,20}capta|andamento|resumo da capta/i;

const reais = (v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
const dolar = (v: number) => `US$ ${v.toFixed(2).replace('.', ',')}`;
const n = (v: number) => v.toLocaleString('pt-BR');

type LinhaDoLead = {
  status: string;
  country: string | null;
  suggested_services: string[] | null;
  first_contact_at: string | null;
  replied_at: string | null;
  closed_at: string | null;
  closed_value: number | null;
  closed_monthly: number | null;
  closed_currency: string | null;
  source: string | null;
};

/** Todos os leads (a API devolve no máximo 1.000 por vez: lê em páginas). */
async function todosOsLeads(db: DbDoAtendente): Promise<LinhaDoLead[]> {
  const lista: LinhaDoLead[] = [];
  for (let de = 0; ; de += 1000) {
    const { data } = await db
      .from('leads')
      .select('status, country, suggested_services, first_contact_at, replied_at, closed_at, closed_value, closed_monthly, closed_currency, source')
      .order('id')
      .range(de, de + 999);
    lista.push(...((data ?? []) as LinhaDoLead[]));
    if (!data || data.length < 1000) return lista;
  }
}

export async function relatorioDaCaptacao(db: DbDoAtendente, cfg: ConfigDoAtendente): Promise<string> {
  const agora = Date.now();
  const [todos, { data: servicos }, cot, { data: mes }, { data: conversas }, { data: gastos }] = await Promise.all([
    todosOsLeads(db),
    db.from('internal_services').select('name, price').eq('active', true),
    buscarCotacaoMercado(),
    db
      .from('ia_gasto_por_mes')
      .select('custo_usd')
      .eq('mes', new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString())
      .maybeSingle(),
    db.from('ia_conversations').select('id, leads(status)').eq('is_test', false).not('contact_id', 'like', 'simulador:%'),
    db.from('ia_gasto_por_conversa').select('conversation_id, custo_usd'),
  ]);
  const cotacoes: Cotacoes = cot.ok ? { USD: cot.cotacao.valor, atualizadaEm: cot.cotacao.atualizadaEm } : { USD: null, atualizadaEm: null };
  const tabBRL = tabelaBRL(new Map((servicos ?? []).map((s) => [s.name, Number(s.price)])));
  const leads = todos.filter((l) => !(l.source ?? '').startsWith('teste'));

  // Funil pela etapa atual de cada lead (igual aos chips do painel).
  const conta = (s: LeadStatus) => leads.filter((l) => l.status === s).length;
  const desde = (dias: number) => new Date(agora - dias * 24 * 3600_000).toISOString();
  const contatados7 = leads.filter((l) => l.first_contact_at && l.first_contact_at >= desde(7)).length;
  const responderam7 = leads.filter((l) => l.replied_at && l.replied_at >= desde(7)).length;
  const fechados30 = leads.filter((l) => l.status === 'fechado' && l.closed_at && l.closed_at >= desde(30)).length;

  // Meta: mesma conta do painel.
  const daMeta: LeadDaMeta[] = leads.map((l) => {
    const e = estimar(l.suggested_services ?? [], l.country === 'US' ? TABELA_USD : tabBRL);
    const negociado = l.status === 'fechado' && l.closed_value !== null;
    const moeda = (l.closed_currency as 'BRL' | 'USD' | null) ?? 'BRL';
    return {
      status: l.status as LeadStatus,
      unico: negociado ? (emReais(Number(l.closed_value), moeda, cotacoes) ?? 0) : (emReais(e.unico, e.moeda, cotacoes) ?? 0),
      mensal:
        negociado && l.closed_monthly !== null
          ? (emReais(Number(l.closed_monthly), moeda, cotacoes) ?? 0)
          : (emReais(e.mensal, e.moeda, cotacoes) ?? 0),
      firstContactAt: l.first_contact_at,
      repliedAt: l.replied_at,
      closedAt: l.closed_at,
    };
  });
  const m = resumoDaMeta(daMeta, agora);
  const emNegociacao = daMeta.filter((l) => ['respondeu', 'reuniao', 'proposta'].includes(l.status));
  const pct = (v: number) => `${Math.round((v / m.valor) * 100)}%`;
  const mesAtual = m.meses[m.atual];
  const linhaDoMes =
    m.atual < 0
      ? `• Começa em 1º/${String(new Date(m.meses[0].inicio).getUTCMonth() + 1).padStart(2, '0')}: meta do 1º mês ${reais(m.meses[0].meta)}`
      : mesAtual
        ? `• Meta de ${mesAtual.rotulo}: ${reais(mesAtual.realizado)} de ${reais(mesAtual.meta)}`
        : '• Semestre encerrado';

  // Custo da IA (sem testes nem simulador).
  const lista = conversas ?? [];
  const ids = new Set(lista.map((c) => c.id));
  const gastoReal = (gastos ?? []).filter((g) => g.conversation_id && ids.has(g.conversation_id)).reduce((s, g) => s + Number(g.custo_usd ?? 0), 0);
  const etapa = (c: (typeof lista)[number]) => c.leads?.status ?? 'respondeu';
  const propostas = lista.filter((c) => ['proposta', 'fechado'].includes(etapa(c))).length;
  const vendas = lista.filter((c) => etapa(c) === 'fechado').length;
  const gastoMes = Number(mes?.custo_usd ?? 0);
  const emR = (usd: number) =>
    cotacoes.USD ? ` (R$ ${(usd * cotacoes.USD).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : '';
  const por = (q: number) => (q ? dolar(gastoReal / q) : '–');

  const quando = new Date(agora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return [
    `📊 *Captação · ${quando}*`,
    '',
    '*Funil* (sem os testes)',
    `• Na fila: ${n(conta('novo'))}`,
    `• Contatados: ${n(conta('contatado'))} · Responderam: ${n(conta('respondeu'))}`,
    `• Reunião: ${n(conta('reuniao'))} · Proposta: ${n(conta('proposta'))}`,
    `• Fechados: ${n(conta('fechado'))} · Perdidos: ${n(conta('perdido') + conta('nao_contatar'))}`,
    `• Últimos 7 dias: ${n(contatados7)} contatados, ${n(responderam7)} responderam · fechados em 30 dias: ${n(fechados30)}`,
    '',
    '🎯 *Meta do semestre*',
    `• Realizado: ${reais(m.realizado)} de ${reais(m.valor)} (${pct(m.realizado)})`,
    linhaDoMes,
    `• Projeção até o fim: ${reais(m.projecao)} (${pct(m.projecao)} da meta)`,
    `• Em negociação: ${n(emNegociacao.length)} lead${emNegociacao.length === 1 ? '' : 's'}, ~${reais(emNegociacao.reduce((s, l) => s + l.unico, 0))} + ${reais(emNegociacao.reduce((s, l) => s + l.mensal, 0))}/mês`,
    '',
    `🤖 *Custo da ${cfg.personaName}*`,
    `• No mês: ${dolar(gastoMes)}${emR(gastoMes)} de ${dolar(cfg.monthlyBudgetUsd)} de teto`,
    `• ${n(lista.length)} conversa${lista.length === 1 ? '' : 's'} reais: ${por(lista.length)} por conversa · ${por(propostas)} por proposta (${propostas}) · ${por(vendas)} por venda (${vendas})`,
    '',
    `Painel: ${SITE_URL}/admin/captacao`,
  ].join('\n');
}
