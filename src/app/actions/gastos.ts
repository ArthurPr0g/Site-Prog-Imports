'use server';
// Página de Gastos (pedido do Arthur em 30/10/2026; migration 0099): tudo o que a operação da Lia gasta,
// onde e com o quê, e os parâmetros editáveis. Gasto de IA é fato (ia_usage); Meta e transcrição são
// contagem real de mensagens/áudios × o preço configurado; custos fixos são os que o Arthur cadastra.
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';
import { buscarCotacaoMercado } from '@/lib/usd-rate';
import type { Json } from '@/lib/supabase/database.types';
import { MODELOS } from '@/lib/atendente/modelos';
import { TIME, type ChaveDoAgente } from '@/lib/agentes/time';
import { dbDoAtendente } from '@/lib/atendente/db';

export type CustoFixo = { id: string; nome: string; valor_brl: number; periodo: 'mensal' | 'anual'; categoria: string };
/**
 * Recarga de créditos da API da Anthropic (pedido do Arthur, 30/10/2026). A Anthropic não tem API de saldo e a
 * de custos exige chave de administrador (só para organizações), então as recargas são lançadas aqui.
 * dolar = cotação do dia da recarga (congela o valor em reais); brl_pago = o que veio na fatura (IOF e câmbio do
 * banco), quando o Arthur informar.
 */
export type RecargaDeCredito = { id: string; data: string; usd: number; dolar: number | null; brl_pago: number | null; /** Hora da recarga (ISO); sem ela, conta desde 0h do dia. */ desde?: string | null };
export type ConfigDeCustos = {
  dolar: number | null;
  meta_utilidade_usd: number;
  meta_marketing_usd: number;
  meta_servico_gratis_mes: number;
  meta_servico_usd: number;
  transcricao_usd_hora: number;
  minutos_por_audio: number;
  respostas_por_projeto: number;
  pesquisas_por_projeto: number;
  modelos_por_projeto: number;
  fixos: CustoFixo[];
  recargas: RecargaDeCredito[];
};
export type Periodo = 'mes' | '7d' | '30d' | 'tudo';
type Fatia = { nome: string; usd: number };

export type Gastos = {
  periodo: Periodo;
  desde: string;
  dolar: number;
  dolarDoDia: boolean;
  config: ConfigDeCustos;
  tetoUsd: number;
  iaMesUsd: number;
  totalBrl: number;
  partes: { nome: string; brl: number; detalhe: string }[];
  ia: { usd: number; chamadas: number; tokens: { entrada: number; saida: number; cache: number }; porFinalidade: Fatia[]; porModelo: Fatia[] };
  meta: { modelos: number; servico: number; servicoGratisRestante: number; usd: number };
  transcricao: { audios: number; usd: number };
  porDia: { dia: string; ia: number; meta: number }[];
  vendas: { fechadas: number; custoPorVendaBrl: number | null; iaDasFechadasUsd: number };
  estimativa: { usd: number; partes: { nome: string; usd: number }[]; base: { porResposta: number; porPesquisa: number; medidoPorResposta: boolean; medidoPorPesquisa: boolean } };
  leads: { id: string; nome: string; status: string; usd: number }[];
  /**
   * Gasto por agente (pedido do Arthur, 30/10/2026; 0110). A Lia é API de verdade (ia_usage). Os agentes do
   * Claude Code rodam pela assinatura do Claude: o valor é o equivalente em preço de API que o claude -p
   * informa em cada execução (não é cobrado à parte). Execuções da nuvem e anteriores a 30/10 não têm medição.
   */
  agentes: { chave: string; nome: string; papel: string; cobranca: 'api' | 'assinatura'; usd: number; execucoes: number; semMedicao: number; tokens: number }[];
  /** Créditos da API: total recarregado, gasto medido da Lia desde a 1ª recarga e o saldo estimado. */
  creditos: { recargas: (RecargaDeCredito & { brl: number })[]; totalUsd: number; totalBrl: number; gastoUsd: number; saldoUsd: number; desde: string | null };
};

const PADRAO: ConfigDeCustos = {
  dolar: null,
  meta_utilidade_usd: 0.0068,
  meta_marketing_usd: 0.0625,
  meta_servico_gratis_mes: 1000,
  meta_servico_usd: 0,
  transcricao_usd_hora: 0,
  minutos_por_audio: 1,
  respostas_por_projeto: 40,
  pesquisas_por_projeto: 2,
  modelos_por_projeto: 5,
  fixos: [],
  recargas: [],
};

const FINALIDADE: Record<string, string> = {
  atendimento: 'Atendimento da Lia',
  pesquisa_lead: 'Pesquisa do lead',
  interpretar_encomenda: 'Ler pedidos do Arthur',
  assunto_encomenda: 'Ler pedidos do Arthur',
  organizar_ideia: 'Organizar ideias',
  organizar_prompt: 'Organizar prompts',
  aprender: 'Lia aprendendo',
};

async function admin() {
  const a = await requireAdmin();
  return a ? createClient() : null;
}

function inicio(p: Periodo): Date {
  const agora = new Date();
  if (p === '7d') return new Date(agora.getTime() - 7 * 86400_000);
  if (p === '30d') return new Date(agora.getTime() - 30 * 86400_000);
  if (p === 'tudo') return new Date('2026-01-01T00:00:00Z');
  // Mês corrente no horário de Brasília.
  const br = new Date(agora.getTime() - 3 * 3600_000);
  return new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), 1, 3));
}
const diaBr = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 10);

export async function gastosAction(periodo: Periodo = 'mes'): Promise<Gastos | null> {
  const db = await admin();
  if (!db) return null;
  const desde = inicio(periodo).toISOString();
  const mes = inicio('mes').toISOString();
  // ideias não tem política de RLS para admin (só o atendente lê/escreve): lê pela chave do servidor, já com o admin conferido acima.
  const fila = dbDoAtendente();

  const [{ data: cfgRow }, { data: usos }, { data: msgs }, { data: avisos }, { data: audiosIdeias }, cot, { count: fechadas }, { data: execucoes }] = await Promise.all([
    db.from('ia_config').select('custos, monthly_budget_usd, modelos_categoria').eq('id', true).maybeSingle(),
    db.from('ia_usage').select('created_at, model, cost_usd, finalidade, conversation_id, lead_id, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens').gte('created_at', desde < mes ? desde : mes).limit(50000),
    db.from('ia_messages').select('created_at, direction, author, body, media_type, status').gte('created_at', desde).limit(50000),
    db.from('ia_avisos').select('created_at, via, status').gte('created_at', desde).limit(20000),
    fila.from('ideias').select('criado_em').eq('origem', 'whatsapp_audio').gte('criado_em', desde).limit(20000),
    buscarCotacaoMercado(),
    db.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'fechado'),
    fila.from('ideias').select('agente, custo_usd, tokens_entrada, tokens_saida').eq('tipo', 'prompt').in('status', ['feito', 'parcial']).gte('atualizado_em', desde).limit(20000),
  ]);
  const config: ConfigDeCustos = { ...PADRAO, ...((cfgRow?.custos ?? {}) as Partial<ConfigDeCustos>) };
  const dolarDoDia = config.dolar === null || !(Number(config.dolar) > 0);
  const dolar = dolarDoDia ? (cot.ok ? cot.cotacao.valor : 5.5) : Number(config.dolar);

  const todos = usos ?? [];
  const noPeriodo = todos.filter((u) => u.created_at >= desde);
  const soma = (xs: { cost_usd: number }[]) => xs.reduce((s, x) => s + Number(x.cost_usd), 0);
  const agrupar = (xs: typeof todos, chave: (u: (typeof todos)[number]) => string): Fatia[] => {
    const m = new Map<string, number>();
    for (const u of xs) m.set(chave(u), (m.get(chave(u)) ?? 0) + Number(u.cost_usd));
    return [...m].map(([nome, usd]) => ({ nome, usd })).sort((a, b) => b.usd - a.usd);
  };
  const iaUsd = soma(noPeriodo);

  // Mensagens da Meta: modelos (cobrados por entrega) e serviço (texto livre na janela de 24 h).
  const enviadas = (msgs ?? []).filter((m) => m.direction === 'out' && m.author !== 'sistema' && m.status !== 'failed');
  // Preço pela categoria REAL de cada modelo na Meta (0104): a Meta reclassificou parte deles como marketing.
  const categorias = (cfgRow?.modelos_categoria ?? {}) as Record<string, string>;
  const precoDe = (nome: string | null) =>
    nome && categorias[nome] === 'MARKETING' ? Number(config.meta_marketing_usd) : Number(config.meta_utilidade_usd);
  const modeloDaMensagem = (body: string) => MODELOS.find((m) => body.endsWith(`[botões: ${m.botoes.join(' | ')}]`))?.nome ?? null;
  const msgsModelo = enviadas.filter((m) => m.body.includes('\n[botões:'));
  const modelosCliente = msgsModelo.length;
  const modelosArthur = (avisos ?? []).filter((a) => a.via === 'modelo' && a.status !== 'failed').length;
  const modelos = modelosCliente + modelosArthur;
  const servico = enviadas.length - modelosCliente + (avisos ?? []).filter((a) => a.via === 'texto' && a.status !== 'failed').length;
  const gratis = Number(config.meta_servico_gratis_mes);
  const servicoPago = Math.max(0, servico - gratis);
  const metaUsd =
    msgsModelo.reduce((s, m) => s + precoDe(modeloDaMensagem(m.body)), 0) +
    modelosArthur * precoDe('aviso_ao_arthur') +
    servicoPago * Number(config.meta_servico_usd);

  const audios = (msgs ?? []).filter((m) => m.direction === 'in' && m.media_type === 'audio').length + (audiosIdeias?.length ?? 0);
  const transcricaoUsd = (audios * Number(config.minutos_por_audio) * Number(config.transcricao_usd_hora)) / 60;

  // Custos fixos proporcionais ao período (mês = 30 dias).
  const dias = periodo === 'mes' ? 30 : periodo === '7d' ? 7 : periodo === '30d' ? 30 : Math.max(1, (Date.now() - new Date(todos[0]?.created_at ?? Date.now()).getTime()) / 86400_000);
  const fixoMes = config.fixos.reduce((s, f) => s + (f.periodo === 'anual' ? Number(f.valor_brl) / 12 : Number(f.valor_brl)), 0);
  const fixoPeriodo = periodo === 'mes' ? fixoMes : (fixoMes * dias) / 30;

  const partes = [
    { nome: 'Inteligência artificial', brl: iaUsd * dolar, detalhe: `US$ ${iaUsd.toFixed(2)} · ${noPeriodo.length} chamadas` },
    { nome: 'Mensagens da Meta', brl: metaUsd * dolar, detalhe: `${modelos} modelo(s) · ${servico} de serviço` },
    { nome: 'Transcrição de áudio', brl: transcricaoUsd * dolar, detalhe: `${audios} áudio(s)` },
    { nome: 'Custos fixos', brl: fixoPeriodo, detalhe: `${config.fixos.length} item(ns)` },
  ];

  // Por dia: IA e Meta (modelos) no período.
  const porDiaMap = new Map<string, { ia: number; meta: number }>();
  for (const u of noPeriodo) {
    const d = diaBr(u.created_at);
    const v = porDiaMap.get(d) ?? { ia: 0, meta: 0 };
    v.ia += Number(u.cost_usd);
    porDiaMap.set(d, v);
  }
  for (const m of msgsModelo) {
    const d = diaBr(m.created_at);
    const v = porDiaMap.get(d) ?? { ia: 0, meta: 0 };
    v.meta += precoDe(modeloDaMensagem(m.body));
    porDiaMap.set(d, v);
  }

  // Leads que mais gastaram (simulador fora).
  const convIds = [...new Set(noPeriodo.map((u) => u.conversation_id).filter(Boolean))] as string[];
  const { data: convs } = convIds.length ? await db.from('ia_conversations').select('id, contact_id, lead_id').in('id', convIds) : { data: [] };
  const conv = new Map((convs ?? []).map((c) => [c.id, c]));
  const porLead = new Map<string, number>();
  for (const u of noPeriodo) {
    const c = u.conversation_id ? conv.get(u.conversation_id) : null;
    if (c?.contact_id.startsWith('simulador:')) continue;
    const l = u.lead_id ?? c?.lead_id;
    if (l) porLead.set(l, (porLead.get(l) ?? 0) + Number(u.cost_usd));
  }
  const ids = [...porLead.keys()];
  const { data: leads } = ids.length ? await db.from('leads').select('id, name, status').in('id', ids) : { data: [] };
  const listaLeads = (leads ?? []).map((l) => ({ id: l.id, nome: l.name, status: l.status, usd: porLead.get(l.id) ?? 0 })).sort((a, b) => b.usd - a.usd);

  // Estimativa por projeto indicado: custo medido por resposta e por pesquisa (ou referência inicial).
  const atend = noPeriodo.filter((u) => (u.finalidade ?? 'atendimento') === 'atendimento' && u.conversation_id);
  const respostasDaLia = enviadas.filter((m) => m.author === 'ia').length;
  const medidoResp = respostasDaLia > 5 && atend.length > 0;
  const porResposta = medidoResp ? soma(atend) / respostasDaLia : 0.03;
  const pesq = noPeriodo.filter((u) => u.finalidade === 'pesquisa_lead');
  const leadsPesq = new Set(pesq.map((u) => u.lead_id)).size;
  const medidoPesq = leadsPesq > 0;
  const porPesquisa = medidoPesq ? soma(pesq) / leadsPesq : 0.2;
  const estPartes = [
    { nome: `${config.respostas_por_projeto} respostas da Lia`, usd: porResposta * config.respostas_por_projeto },
    { nome: `${config.pesquisas_por_projeto} pesquisa(s) do lead`, usd: porPesquisa * config.pesquisas_por_projeto },
    // Média dos modelos que a Lia usa num projeto, pela categoria que a Meta deu a cada um.
    { nome: `${config.modelos_por_projeto} mensagens modelo`, usd: config.modelos_por_projeto * (MODELOS.reduce((s, m) => s + precoDe(m.nome), 0) / MODELOS.length) },
  ];

  const totalBrl = partes.reduce((s, p) => s + p.brl, 0);
  const iaDasFechadas = listaLeads.filter((l) => l.status === 'fechado').reduce((s, l) => s + l.usd, 0);

  return {
    periodo,
    desde,
    dolar,
    dolarDoDia,
    config,
    tetoUsd: Number(cfgRow?.monthly_budget_usd ?? 0),
    iaMesUsd: soma(todos.filter((u) => u.created_at >= mes)),
    totalBrl,
    partes,
    ia: {
      usd: iaUsd,
      chamadas: noPeriodo.length,
      tokens: {
        entrada: noPeriodo.reduce((s, u) => s + u.input_tokens, 0),
        saida: noPeriodo.reduce((s, u) => s + u.output_tokens, 0),
        cache: noPeriodo.reduce((s, u) => s + u.cache_read_tokens + u.cache_write_tokens, 0),
      },
      porFinalidade: agrupar(noPeriodo, (u) => FINALIDADE[u.finalidade ?? 'atendimento'] ?? u.finalidade ?? 'Outros'),
      porModelo: agrupar(noPeriodo, (u) => u.model.replace('claude-', '').replace(/-(\d)-(\d)$/, ' $1.$2').replace(/^./, (c) => c.toUpperCase())),
    },
    meta: { modelos, servico, servicoGratisRestante: Math.max(0, gratis - servico), usd: metaUsd },
    transcricao: { audios, usd: transcricaoUsd },
    porDia: [...porDiaMap].map(([dia, v]) => ({ dia, ...v })).sort((a, b) => a.dia.localeCompare(b.dia)).slice(-45),
    vendas: { fechadas: fechadas ?? 0, custoPorVendaBrl: fechadas ? totalBrl / fechadas : null, iaDasFechadasUsd: iaDasFechadas },
    estimativa: { usd: estPartes.reduce((s, p) => s + p.usd, 0), partes: estPartes, base: { porResposta, porPesquisa, medidoPorResposta: medidoResp, medidoPorPesquisa: medidoPesq } },
    leads: listaLeads.slice(0, 10),
    creditos: await creditosDaApi(db, config.recargas ?? [], dolar),
    agentes: gastoPorAgente(iaUsd, noPeriodo.length, noPeriodo.reduce((s, u) => s + u.input_tokens + u.output_tokens + u.cache_read_tokens + u.cache_write_tokens, 0), execucoes ?? []),
  };
}

/** Saldo estimado dos créditos: recargas lançadas menos o gasto da Lia medido (ia_usage) desde a 1ª recarga. */
async function creditosDaApi(db: NonNullable<Awaited<ReturnType<typeof admin>>>, recargas: RecargaDeCredito[], dolarHoje: number): Promise<Gastos['creditos']> {
  const lista = [...recargas]
    .sort((a, b) => b.data.localeCompare(a.data))
    .map((r) => ({ ...r, brl: r.brl_pago ?? r.usd * (r.dolar ?? dolarHoje) }));
  const inicios = lista.map((r) => r.desde || `${r.data}T03:00:00Z`).sort();
  const desde = inicios[0] ?? null;
  let gastoUsd = 0;
  if (desde) {
    // Desde a hora da 1ª recarga (ou 00h de Brasília do dia), em páginas de 1000 linhas.
    for (let de = 0; de < 200_000; de += 1000) {
      const { data } = await db.from('ia_usage').select('cost_usd').gte('created_at', desde).order('created_at').range(de, de + 999);
      gastoUsd += (data ?? []).reduce((s, u) => s + Number(u.cost_usd), 0);
      if (!data || data.length < 1000) break;
    }
  }
  const totalUsd = lista.reduce((s, r) => s + r.usd, 0);
  return { recargas: lista, totalUsd, totalBrl: lista.reduce((s, r) => s + r.brl, 0), gastoUsd, saldoUsd: totalUsd - gastoUsd, desde };
}

/** Lia (API real) primeiro; depois os agentes do Claude Code pelo custo equivalente, do maior para o menor. */
function gastoPorAgente(
  liaUsd: number,
  liaChamadas: number,
  liaTokens: number,
  execucoes: { agente: string | null; custo_usd: number | null; tokens_entrada: number | null; tokens_saida: number | null }[]
): Gastos['agentes'] {
  const mapa = new Map<string, Gastos['agentes'][number]>();
  for (const e of execucoes) {
    const chave = e.agente && e.agente in TIME ? e.agente : 'arthur';
    const a = TIME[chave as ChaveDoAgente];
    const v = mapa.get(chave) ?? {
      chave,
      nome: a?.nome ?? 'Pedidos seus',
      papel: a?.papel ?? 'o que você pede ao Claude pelo WhatsApp',
      cobranca: 'assinatura' as const,
      usd: 0,
      execucoes: 0,
      semMedicao: 0,
      tokens: 0,
    };
    v.execucoes += 1;
    if (e.custo_usd === null) v.semMedicao += 1;
    v.usd += Number(e.custo_usd ?? 0);
    v.tokens += Number(e.tokens_entrada ?? 0) + Number(e.tokens_saida ?? 0);
    mapa.set(chave, v);
  }
  const lia = { chave: 'lia', nome: 'Lia', papel: TIME.lia.papel, cobranca: 'api' as const, usd: liaUsd, execucoes: liaChamadas, semMedicao: 0, tokens: liaTokens };
  return [lia, ...[...mapa.values()].sort((a, b) => b.usd - a.usd || b.execucoes - a.execucoes)];
}

const num = (v: unknown, min: number, max: number, padrao: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao;
};

export async function salvarCustosAction(c: ConfigDeCustos, tetoUsd: number): Promise<ActionResult> {
  const db = await admin();
  if (!db) return errResult('Sem permissão.');
  const limpo: ConfigDeCustos = {
    dolar: c.dolar === null || !(Number(c.dolar) > 0) ? null : num(c.dolar, 1, 20, 5.5),
    meta_utilidade_usd: num(c.meta_utilidade_usd, 0, 1, PADRAO.meta_utilidade_usd),
    meta_marketing_usd: num(c.meta_marketing_usd, 0, 1, PADRAO.meta_marketing_usd),
    meta_servico_gratis_mes: Math.round(num(c.meta_servico_gratis_mes, 0, 100000, 1000)),
    meta_servico_usd: num(c.meta_servico_usd, 0, 1, 0),
    transcricao_usd_hora: num(c.transcricao_usd_hora, 0, 50, 0),
    minutos_por_audio: num(c.minutos_por_audio, 0.1, 60, 1),
    respostas_por_projeto: Math.round(num(c.respostas_por_projeto, 1, 1000, 40)),
    pesquisas_por_projeto: Math.round(num(c.pesquisas_por_projeto, 0, 20, 2)),
    modelos_por_projeto: Math.round(num(c.modelos_por_projeto, 0, 100, 5)),
    fixos: (c.fixos ?? [])
      .filter((f) => f.nome?.trim())
      .slice(0, 50)
      .map((f) => ({
        id: f.id || crypto.randomUUID(),
        nome: f.nome.trim().slice(0, 80),
        valor_brl: num(f.valor_brl, 0, 1_000_000, 0),
        periodo: f.periodo === 'anual' ? 'anual' : 'mensal',
        categoria: (f.categoria ?? '').trim().slice(0, 40) || 'Outros',
      })),
    recargas: [],
  };
  // Recarga sem cotação ganha o dólar de hoje ao salvar: o valor em reais fica congelado no dia lançado.
  const cot = (c.recargas ?? []).some((r) => !(Number(r.dolar) > 0)) ? await buscarCotacaoMercado() : null;
  limpo.recargas = (c.recargas ?? [])
    .filter((r) => Number(r.usd) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.data ?? ''))
    .slice(0, 200)
    .map((r) => ({
      id: r.id || crypto.randomUUID(),
      data: r.data,
      usd: num(r.usd, 0, 100_000, 0),
      dolar: Number(r.dolar) > 0 ? num(r.dolar, 1, 20, 5.5) : cot?.ok ? cot.cotacao.valor : null,
      brl_pago: Number(r.brl_pago) > 0 ? num(r.brl_pago, 0, 1_000_000, 0) : null,
      desde: r.desde && !Number.isNaN(Date.parse(r.desde)) && r.desde.slice(0, 10) <= r.data ? r.desde : null,
    }));
  const teto = num(tetoUsd, 1, 10000, 30);
  const { error } = await db.from('ia_config').update({ custos: limpo as unknown as Json, monthly_budget_usd: teto }).eq('id', true);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar.'));
  revalidatePath('/admin/gastos');
  return okResult('Salvo: os números já usam os novos valores.');
}
