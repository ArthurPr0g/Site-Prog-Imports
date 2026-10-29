// Pós-venda da Prog Soluções (pedido do dono em 28/10/2026; P1–P9 no
// docs/CAPTACAO-BACKLOG.md). Venda feita → projeto com os serviços vendidos,
// prazo, entrega prevista e o contador de rodadas de ajuste por serviço.
//
// Números do contrato e do guia, sem duplicar: rodadas e dias de suporte saem do
// "o que inclui" de cada nível (guia-dos-pacotes, ex.: "3 rodadas de ajustes · 60 dias
// de suporte"); sem número no guia, vale REGRAS_DO_CONTRATO.rodadasDeRevisao. Prazo
// de cada serviço e do pacote pelo catálogo (prazoDoPacote, o mesmo do simulador).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { NOMES, type Escolha } from '@/lib/simulador';
import { GUIA_DO_PRODUTO, GUIA_DA_MARCA } from '@/lib/guia-dos-pacotes';
import { REGRAS_DO_CONTRATO } from '@/lib/contract';
import { prazoDoPacote } from '@/lib/atendente/regras';

type Db = SupabaseClient<Database>;

export type ServicoVendido = { tipo: 'site' | 'loja' | 'erp' | 'marca'; nome: string; rodadas: number; suporte: number; prazo: number };

const numero = (lista: string[], re: RegExp) => {
  for (const t of lista) {
    const m = t.match(re);
    if (m) return Number(m[1]);
  }
  return null;
};
const rodadasDo = (inclui: string[]) => numero(inclui, /(\d+)\s+rodadas/i) ?? REGRAS_DO_CONTRATO.rodadasDeRevisao;
const suporteDo = (inclui: string[]) => numero(inclui, /(\d+)\s+dias de suporte/i) ?? 0;

/** Serviços de um pacote do simulador, com rodadas, suporte e prazo de cada um. */
export function servicosDoPacote(e: Escolha, prazos: Map<string, number>): ServicoVendido[] {
  const n = NOMES.BRL;
  const lista: ServicoVendido[] = [];
  const guia = GUIA_DO_PRODUTO[e.produto].niveis[e.nivel].inclui;
  lista.push({ tipo: e.produto, nome: n[e.produto][e.nivel], rodadas: rodadasDo(guia), suporte: suporteDo(guia), prazo: prazos.get(n[e.produto][e.nivel]) ?? 0 });
  if (e.comGestao && e.produto !== 'erp') {
    const g = GUIA_DO_PRODUTO.erp.niveis[e.nivelGestao].inclui;
    lista.push({ tipo: 'erp', nome: n.erp[e.nivelGestao], rodadas: rodadasDo(g), suporte: suporteDo(g), prazo: prazos.get(n.erp[e.nivelGestao]) ?? 0 });
  }
  if (e.marca) {
    const m = GUIA_DA_MARCA[e.marca - 1].inclui;
    lista.push({ tipo: 'marca', nome: n.marca[e.marca - 1], rodadas: rodadasDo(m), suporte: 0, prazo: prazos.get(n.marca[e.marca - 1]) ?? 0 });
  }
  return lista;
}

/** Data (AAAA-MM-DD) depois de N dias úteis (seg a sex; feriados não entram). */
export function somarDiasUteis(de: Date, dias: number): string {
  const d = new Date(Date.UTC(de.getUTCFullYear(), de.getUTCMonth(), de.getUTCDate()));
  let faltam = dias;
  while (faltam > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const s = d.getUTCDay();
    if (s !== 0 && s !== 6) faltam--;
  }
  return d.toISOString().slice(0, 10);
}

/** Escolha válida a partir de um JSON guardado (leads.pacote). null se não for um pacote. */
export function escolhaDoJson(j: unknown): Escolha | null {
  const o = j as Partial<Escolha> | null;
  if (!o || !['site', 'loja', 'erp'].includes(o.produto as string)) return null;
  const nivel = (v: unknown) => (v === 1 || v === 2 ? v : 0) as 0 | 1 | 2;
  return {
    produto: o.produto as Escolha['produto'],
    nivel: nivel(o.nivel),
    comGestao: !!o.comGestao && o.produto !== 'erp',
    nivelGestao: nivel(o.nivelGestao),
    marca: ([1, 2, 3].includes(Number(o.marca)) ? Number(o.marca) : 0) as Escolha['marca'],
  };
}

/** Prazos (dias úteis) do catálogo ativo, por nome de serviço. */
export async function prazosDoCatalogo(db: Db): Promise<Map<string, number>> {
  const { data } = await db.from('internal_services').select('name, lead_time_days').eq('active', true);
  return new Map((data ?? []).map((s) => [s.name, Number(s.lead_time_days ?? 0)]));
}

/**
 * Cria o projeto de uma venda (uma vez por lead: chamar de novo devolve o existente).
 * A entrega prevista conta da venda; o prazo do contrato conta do sinal pago e do
 * material completo, então é uma previsão que o Arthur ajusta no painel.
 */
export async function criarProjetoDaVenda(
  db: Db,
  v: {
    leadId: string | null;
    cliente: string;
    responsavel?: string | null;
    vendidoPor: string;
    escolha: Escolha | null;
    moeda?: 'BRL' | 'USD';
    valor?: number | null;
    mensal?: number | null;
  }
): Promise<{ id: string; novo: boolean } | { erro: string }> {
  if (v.leadId) {
    const { data: existe } = await db.from('projetos').select('id').eq('lead_id', v.leadId).maybeSingle();
    if (existe) return { id: existe.id, novo: false };
  }
  const prazos = await prazosDoCatalogo(db);
  const servicos = v.escolha ? servicosDoPacote(v.escolha, prazos) : [];
  const prazo = v.escolha ? prazoDoPacote(v.escolha, prazos) : 0;
  const agora = new Date();
  const { data: p, error } = await db
    .from('projetos')
    .insert({
      lead_id: v.leadId,
      cliente: v.cliente,
      responsavel: v.responsavel ?? null,
      vendido_por: v.vendidoPor,
      vendido_em: agora.toISOString(),
      pacote: v.escolha as unknown as Database['public']['Tables']['projetos']['Insert']['pacote'],
      moeda: v.moeda ?? 'BRL',
      valor: v.valor ?? null,
      mensal: v.mensal ?? null,
      prazo_dias: prazo,
      entrega_prevista: prazo ? somarDiasUteis(agora, prazo) : null,
    })
    .select('id')
    .single();
  if (error || !p) {
    // Corrida (unique por lead): outra execução criou junto.
    if (v.leadId) {
      const { data: existe } = await db.from('projetos').select('id').eq('lead_id', v.leadId).maybeSingle();
      if (existe) return { id: existe.id, novo: false };
    }
    return { erro: error?.message ?? 'não criou o projeto' };
  }
  if (servicos.length) {
    await db.from('projeto_servicos').insert(
      servicos.map((s, i) => ({
        projeto_id: p.id,
        tipo: s.tipo,
        nome: s.nome,
        rodadas_incluidas: s.rodadas,
        suporte_dias: s.suporte,
        prazo_dias: s.prazo,
        posicao: i,
      }))
    );
  }
  return { id: p.id, novo: true };
}

/** Abre uma rodada; acima do que o contrato inclui para o serviço, ela nasce "extra" (vira orçamento). */
export async function abrirRodada(
  db: Db,
  r: { projetoId: string; servicoId: string; pedido: string; atendidoPor: string | null }
): Promise<{ id: string; numero: number; extra: boolean; incluidas: number } | { erro: string }> {
  const [{ data: servico }, { count }] = await Promise.all([
    db.from('projeto_servicos').select('rodadas_incluidas, nome').eq('id', r.servicoId).eq('projeto_id', r.projetoId).maybeSingle(),
    db.from('rodadas').select('id', { count: 'exact', head: true }).eq('servico_id', r.servicoId),
  ]);
  if (!servico) return { erro: 'Serviço não encontrado neste projeto.' };
  const numero = (count ?? 0) + 1;
  const extra = numero > servico.rodadas_incluidas;
  const { data, error } = await db
    .from('rodadas')
    .insert({ projeto_id: r.projetoId, servico_id: r.servicoId, numero, extra, pedido: r.pedido.slice(0, 4000), atendido_por: r.atendidoPor })
    .select('id')
    .single();
  if (error || !data) return { erro: error?.message ?? 'não abriu a rodada' };
  return { id: data.id, numero, extra, incluidas: servico.rodadas_incluidas };
}
