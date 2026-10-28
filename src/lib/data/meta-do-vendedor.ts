// Meta da Captação para a página do vendedor: lê o mínimo de cada lead pela
// função lead_kit_meta (sem nome nem contato) e faz a mesma conta do painel.
// Só no servidor.

import { createClient } from '@/lib/supabase/server';
import { buscarCotacaoMercado } from '@/lib/usd-rate';
import { TABELA_USD, tabelaBRL, estimar, emReais, type Cotacoes } from '@/lib/precos-captacao';
import { resumoDaMeta, type LeadDaMeta, type ResumoDaMeta } from '@/lib/meta-captacao';
import type { LeadStatus } from '@/lib/captacao';

type Linha = { s: LeadStatus; c: string; sv: string[]; fc: string | null; ra: string | null; ca: string | null };

// A página atualiza a cada 30 s: a cotação do dólar fica guardada por 30 min
// em vez de consultar a API externa a cada atualização.
const VALIDADE_DA_COTACAO = 30 * 60 * 1000;
let cotacaoGuardada: { em: number; valor: Cotacoes } | null = null;
async function cotacoes(): Promise<Cotacoes> {
  if (cotacaoGuardada && Date.now() - cotacaoGuardada.em < VALIDADE_DA_COTACAO) return cotacaoGuardada.valor;
  const r = await buscarCotacaoMercado();
  const valor: Cotacoes = r.ok
    ? { USD: r.cotacao.valor, atualizadaEm: r.cotacao.atualizadaEm }
    : { USD: null, atualizadaEm: null };
  if (r.ok) cotacaoGuardada = { em: Date.now(), valor };
  return valor;
}

/** null = link desativado ou erro de leitura. */
export async function metaDoVendedor(token: string): Promise<ResumoDaMeta | null> {
  const supabase = await createClient();
  const [{ data, error }, cot] = await Promise.all([supabase.rpc('lead_kit_meta', { p_token: token }), cotacoes()]);
  if (error || !data) return null;
  const { leads, catalogo } = data as unknown as { leads: Linha[]; catalogo: [string, number][] };
  const tabBRL = tabelaBRL(new Map(catalogo.map(([n, p]) => [n, Number(p)])));
  const daMeta: LeadDaMeta[] = leads.map((l) => {
    const e = estimar(l.sv ?? [], l.c === 'US' ? TABELA_USD : tabBRL);
    return {
      status: l.s,
      unico: emReais(e.unico, e.moeda, cot) ?? 0,
      mensal: emReais(e.mensal, e.moeda, cot) ?? 0,
      firstContactAt: l.fc,
      repliedAt: l.ra,
      closedAt: l.ca,
    };
  });
  return resumoDaMeta(daMeta, Date.now());
}
