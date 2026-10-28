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
// - Projeção = realizado + mensalidades já contratadas que ainda vão entrar +
//   funil ponderado (valor de cada lead em aberto × chance de fechar na etapa
//   em que está). A chance parte de valores de referência e vai se ajustando
//   à taxa real de conversão conforme os contatos acontecem (média com peso:
//   com poucos contatos vale a referência; com muitos, a taxa real).
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

/** Etapas do funil que entram na projeção. */
export type EtapaDoFunil = 'contatado' | 'respondeu' | 'reuniao' | 'proposta';

// Chance de fechar por etapa, antes de haver histórico. Reunião 20% e
// proposta 60% seguem as probabilidades padrão do HubSpot (reunião marcada e
// apresentação feita); contatado e respondeu são estimativas conservadoras
// para contato frio. Substituídas aos poucos pela taxa real (ver acima).
export const CHANCE_DE_REFERENCIA: Record<EtapaDoFunil, number> = {
  contatado: 0.03,
  respondeu: 0.1,
  reuniao: 0.2,
  proposta: 0.6,
};
/** Peso da referência, em "leads equivalentes", na média com a taxa real. */
const PESO_DA_REFERENCIA = 20;
/** Contato sem desfecho só entra na taxa real depois de tantos dias. */
const DIAS_PARA_DESFECHO = 30;
const DIA = 24 * 3600 * 1000;

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
  funilPonderado: number;
  projecao: number;
  chances: Record<EtapaDoFunil, number>;
  naMesa: { unico: number; mensal: number; leads: number };
};

/** Taxa de conversão com a referência como ponto de partida (média com peso). */
function chanceAjustada(referencia: number, coorte: LeadDaMeta[]): number {
  const fechados = coorte.filter((l) => l.status === 'fechado').length;
  return (fechados + PESO_DA_REFERENCIA * referencia) / (coorte.length + PESO_DA_REFERENCIA);
}

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

  // Chances por etapa: referência + taxa real de quem já teve desfecho.
  const comDesfecho = (l: LeadDaMeta, desde: string | null) =>
    !!desde && (ENCERRADOS.includes(l.status) || agora - Date.parse(desde) >= DIAS_PARA_DESFECHO * DIA);
  const contatados = leads.filter((l) => comDesfecho(l, l.firstContactAt));
  const responderam = leads.filter((l) => comDesfecho(l, l.repliedAt));
  const chances: Record<EtapaDoFunil, number> = {
    contatado: chanceAjustada(CHANCE_DE_REFERENCIA.contatado, contatados),
    respondeu: chanceAjustada(CHANCE_DE_REFERENCIA.respondeu, responderam),
    reuniao: CHANCE_DE_REFERENCIA.reuniao,
    proposta: CHANCE_DE_REFERENCIA.proposta,
  };

  // Funil ponderado: proposta fecha neste mês; as outras etapas, no próximo.
  let funilPonderado = 0;
  if (atual < meses.length) {
    for (const l of leads) {
      if (!(l.status in chances)) continue;
      const mesDoFechamento = Math.min(meses.length - 1, c + (l.status === 'proposta' ? 0 : 1));
      const mensalidades = meses.length - 1 - mesDoFechamento;
      funilPonderado += chances[l.status as EtapaDoFunil] * (l.unico + l.mensal * mensalidades);
    }
  }

  const abertos = leads.filter((l) => !ENCERRADOS.includes(l.status));
  return {
    valor: META.valor,
    meses,
    atual,
    agora,
    realizado,
    contratado,
    funilPonderado,
    projecao: realizado + contratado + funilPonderado,
    chances,
    naMesa: {
      unico: abertos.reduce((s, l) => s + l.unico, 0),
      mensal: abertos.reduce((s, l) => s + l.mensal, 0),
      leads: abertos.filter((l) => l.unico > 0).length,
    },
  };
}
