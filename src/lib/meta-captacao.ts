// Meta da Captação: R$ 100 mil de faturamento de 1º/11/2026 a 30/04/2027.
// Mesma conta no painel (/admin/captacao) e na página do vendedor.
//
// Decisões do dono (27/10/2026):
// - Realizado = faturamento do mês: a implantação entra no mês em que o lead
//   vira Fechado; a mensalidade entra em cada mês seguinte, até abril.
//   Fechamento antes de 1º/11 (semana do lançamento) conta em novembro.
// - Meta progressiva = cota com rampa 25/50/75/100% (o formato mais usado para
//   equipe nova, em que a cota cheia só vale a partir do 4º mês), com ajuste
//   dinâmico: no começo de cada mês, o que falta para os R$ 100 mil é
//   redistribuído nos meses restantes com os mesmos pesos da rampa.
// - Sem projeção por "% de chance" (pedido do Arthur, 31/10/2026): só fatos — realizado, meta e
//   mensalidades já fechadas que ainda vão entrar.
//
// Valores pela tabela de preços (os mesmos do card "Dinheiro na mesa").

import { ENCERRADOS, type LeadStatus } from '@/lib/captacao';

export const META = {
  valor: 100_000,
  /** Primeiro mês (0 = janeiro). */
  ano: 2026,
  mes: 10,
  /** Peso de cada mês: 25%, 50%, 75% e depois 100% da cota cheia. */
  rampa: [0.25, 0.5, 0.75, 1, 1, 1],
} as const;

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** 00:00 de Brasília do dia 1º (UTC−3; sem horário de verão desde 2019). */
const inicioDoMes = (ano: number, mes: number) => Date.UTC(ano, mes, 1, 3);

export type LeadDaMeta = {
  status: LeadStatus;
  /** Implantação e mensalidade em reais (0 quando sem cotação). */
  unico: number;
  mensal: number;
  firstContactAt: string | null;
  repliedAt: string | null;
  closedAt: string | null;
};

export type MesDaMeta = {
  rotulo: string;
  inicio: number;
  fim: number;
  /** Meta pela rampa original. */
  metaBase: number;
  /** Meta valendo (ajustada a partir do mês atual). */
  meta: number;
  /** Faturamento do mês até agora. */
  realizado: number;
};

export type ResumoDaMeta = {
  valor: number;
  meses: MesDaMeta[];
  /** Mês atual: −1 antes de começar, 6 depois de terminar. */
  atual: number;
  /** Momento da conta (ms). */
  agora: number;
  realizado: number;
  /** Mensalidades de leads já fechados que ainda vão entrar até abril. */
  contratado: number;
  naMesa: { unico: number; mensal: number; leads: number };
};

export function resumoDaMeta(leads: LeadDaMeta[], agora: number): ResumoDaMeta {
  const meses: MesDaMeta[] = META.rampa.map((_, i) => {
    const mes = (META.mes + i) % 12;
    const ano = META.ano + Math.floor((META.mes + i) / 12);
    return {
      rotulo: MESES_CURTOS[mes],
      inicio: inicioDoMes(ano, mes),
      fim: inicioDoMes(ano + (mes === 11 ? 1 : 0), (mes + 1) % 12),
      metaBase: 0,
      meta: 0,
      realizado: 0,
    };
  });
  const somaRampa = META.rampa.reduce((s, p) => s + p, 0);
  meses.forEach((m, i) => (m.metaBase = (META.valor * META.rampa[i]) / somaRampa));
  const fimDoPeriodo = meses[meses.length - 1].fim;
  const atual = agora < meses[0].inicio ? -1 : agora >= fimDoPeriodo ? meses.length : meses.findIndex((m) => agora < m.fim);

  // Realizado e contratado: implantação no mês do fechamento, mensalidade nos seguintes.
  let contratado = 0;
  for (const l of leads) {
    if (l.status !== 'fechado' || !l.closedAt) continue;
    const quando = Date.parse(l.closedAt);
    if (quando >= fimDoPeriodo) continue;
    const k = Math.max(0, meses.findIndex((m) => quando < m.fim));
    meses[k].realizado += l.unico;
    for (let i = k + 1; i < meses.length; i++) {
      // Mensalidade conta como recebida quando o mês dela começa.
      if (meses[i].inicio <= agora) meses[i].realizado += l.mensal;
      else contratado += l.mensal;
    }
  }
  const realizado = meses.reduce((s, m) => s + m.realizado, 0);

  // Meta ajustada: o que faltou até o mês passado vai para os meses restantes.
  const c = Math.max(0, atual);
  const faltaNoInicioDoMes = Math.max(0, META.valor - meses.slice(0, c).reduce((s, m) => s + m.realizado, 0));
  const pesoRestante = META.rampa.slice(c).reduce((s, p) => s + p, 0);
  meses.forEach((m, i) => {
    m.meta = i < c || atual >= meses.length ? m.metaBase : (faltaNoInicioDoMes * META.rampa[i]) / pesoRestante;
  });

  const abertos = leads.filter((l) => !ENCERRADOS.includes(l.status));
  return {
    valor: META.valor,
    meses,
    atual,
    agora,
    realizado,
    contratado,
    naMesa: {
      unico: abertos.reduce((s, l) => s + l.unico, 0),
      mensal: abertos.reduce((s, l) => s + l.mensal, 0),
      leads: abertos.filter((l) => l.unico > 0).length,
    },
  };
}
