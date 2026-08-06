// Regras do livro-caixa. Puro, sem dependência de servidor: a tela filtra ao
// vivo e o servidor usa as mesmas funções.

export const FINANCE_KINDS = ['receita', 'despesa'] as const;
export const FINANCE_STATUSES = ['Pago', 'Previsto'] as const;

export type FinanceKind = (typeof FINANCE_KINDS)[number];
export type FinanceStatus = (typeof FINANCE_STATUSES)[number];
export type FinanceSource = 'manual' | 'venda' | 'servico' | 'estoque';

/** Como cada origem é apresentada no extrato. Linha gerada não é editável em
 *  valor nem data: quem manda é o módulo que a criou. */
export const ROTULO_DA_ORIGEM: Record<FinanceSource, string> = {
  manual: 'lançamento manual',
  venda: 'gerado por venda',
  servico: 'gerado por serviço',
  estoque: 'compra de estoque',
};

export type FinanceEntry = {
  id: string;
  kind: FinanceKind;
  description: string;
  amount: number;
  entryDate: string;
  status: FinanceStatus;
  source: FinanceSource;
  referenceId: string | null;
};

export type Periodo = { inicio: string; fim: string; rotulo: string };

export type FiltroPeriodo = {
  /** Desde a primeira movimentação até hoje. Vence todos os outros. */
  tudo?: boolean;
  ano?: number | null;
  mes?: number | null;
  inicio?: string;
  fim?: string;
};

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** Formata a data pelos componentes LOCAIS.
 *
 *  `toISOString()` converte para UTC antes de cortar, o que no Brasil (UTC−3)
 *  devolve o dia anterior para qualquer horário antes das 21h. Como as datas
 *  aqui são dias de calendário — "1º de agosto" é 1º de agosto, não um instante
 *  —, misturar os dois fusos fazia o período padrão começar no mês errado no
 *  primeiro dia de cada mês. */
function iso(d: Date): string {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/** Último dia do mês, em horário local. Dia 0 do mês seguinte é o último do
 *  mês pedido — resolve fevereiro bissexto sem tabela de dias. */
function ultimoDia(ano: number, mes: number): Date {
  return new Date(ano, mes, 0);
}

/** Extremos do livro, para o filtro "Tudo" saber onde começa e onde termina. */
export type LimitesDoLivro = { primeira?: string; ultima?: string };

/** Resolve o período com prioridade fixa, para que dois filtros preenchidos ao
 *  mesmo tempo nunca deem resultado ambíguo:
 *  1) "tudo"  2) ano (com mês opcional dentro dele)  3) mês no ano corrente
 *  4) datas manuais, com padrão no mês corrente inteiro.
 *
 *  O padrão cobre o MÊS INTEIRO, não até hoje: lançamento 'Previsto' é por
 *  definição futuro, e cortar em hoje deixaria os indicadores de previsto
 *  sempre zerados na abertura da tela — justamente a informação que eles
 *  existem para dar. Pelo mesmo motivo "Tudo" vai até a última movimentação,
 *  e não até hoje. */
export function resolverPeriodo(filtro: FiltroPeriodo, hoje: Date, limites?: LimitesDoLivro): Periodo {
  const anoAtual = hoje.getFullYear();

  if (filtro.tudo) {
    // Sem lançamento nenhum, cai no ano corrente em vez de numa data arbitrária.
    return {
      inicio: limites?.primeira || `${anoAtual}-01-01`,
      fim: limites?.ultima || `${anoAtual}-12-31`,
      rotulo: 'Tudo',
    };
  }

  if (filtro.ano) {
    if (filtro.mes) {
      const inicio = new Date(filtro.ano, filtro.mes - 1, 1);
      return {
        inicio: iso(inicio),
        fim: iso(ultimoDia(filtro.ano, filtro.mes)),
        rotulo: `${MESES[filtro.mes - 1]} de ${filtro.ano}`,
      };
    }
    return { inicio: `${filtro.ano}-01-01`, fim: `${filtro.ano}-12-31`, rotulo: String(filtro.ano) };
  }

  if (filtro.mes) {
    const inicio = new Date(anoAtual, filtro.mes - 1, 1);
    return {
      inicio: iso(inicio),
      fim: iso(ultimoDia(anoAtual, filtro.mes)),
      rotulo: `${MESES[filtro.mes - 1]} de ${anoAtual}`,
    };
  }

  const mesCorrente = hoje.getMonth() + 1;
  return {
    inicio: filtro.inicio || iso(new Date(anoAtual, mesCorrente - 1, 1)),
    fim: filtro.fim || iso(ultimoDia(anoAtual, mesCorrente)),
    rotulo: filtro.inicio || filtro.fim ? 'Período personalizado' : `${MESES[mesCorrente - 1]} de ${anoAtual}`,
  };
}

export function dentroDoPeriodo(entry: FinanceEntry, periodo: Periodo): boolean {
  return entry.entryDate >= periodo.inicio && entry.entryDate <= periodo.fim;
}

export type FinanceIndicators = {
  receitaReal: number;
  despesaReal: number;
  receitaPrevista: number;
  despesaPrevista: number;
  resultadoReal: number;
  resultadoPrevisto: number;
};

/** Soma por tipo. Sem `status`, soma tudo daquele tipo no período. */
function somar(entries: FinanceEntry[], kind: FinanceKind, status?: FinanceStatus): number {
  return entries
    .filter((e) => e.kind === kind && (status === undefined || e.status === status))
    .reduce((s, e) => s + e.amount, 0);
}

/** Indicadores do período, em duas leituras do mesmo filtro.
 *
 *  **Real** é só o que já movimentou dinheiro (status `Pago`). **Previsto** é
 *  TUDO que foi lançado no período, movimentado ou não — é o total esperado do
 *  período, não "o que falta". Lido junto com o real, a diferença entre os dois
 *  é justamente o que ainda está por acontecer: previsto R$ 10.000 com real
 *  R$ 6.900 significa R$ 3.100 a entrar. Se o previsto excluísse o já pago, os
 *  dois cards não seriam comparáveis e o total do período não apareceria em
 *  lugar nenhum.
 *
 *  Uma ressalva importante sobre "resultado": enquanto Vendas (M4) e Prestação
 *  (M6) não existem, ele é receita menos despesa. Quando existirem, a receita
 *  de venda precisa entrar pelo LUCRO e não pelo faturamento — senão o preço
 *  cheio de um produto conta como ganho e o custo de aquisição some da conta,
 *  inflando o resultado. Lançamento manual continua entrando integral, porque
 *  não tem custo atrelado: quem lança R$ 500 recebidos e não lança o custo
 *  está declarando que não houve custo. */
export function computeFinanceIndicators(entries: FinanceEntry[]): FinanceIndicators {
  const receitaReal = somar(entries, 'receita', 'Pago');
  const despesaReal = somar(entries, 'despesa', 'Pago');
  const receitaPrevista = somar(entries, 'receita');
  const despesaPrevista = somar(entries, 'despesa');

  return {
    receitaReal,
    despesaReal,
    receitaPrevista,
    despesaPrevista,
    resultadoReal: receitaReal - despesaReal,
    resultadoPrevisto: receitaPrevista - despesaPrevista,
  };
}

export type PontoFluxo = { mes: string; entradas: number; saidas: number };

/** Fluxo de caixa mensal de UM ano. Mistura de anos não faz sentido num gráfico
 *  com granularidade de mês: "março" apareceria duas vezes sem distinção. */
export function fluxoMensal(entries: FinanceEntry[], ano: number): PontoFluxo[] {
  const pontos: PontoFluxo[] = MESES.map((m) => ({ mes: m.slice(0, 3), entradas: 0, saidas: 0 }));

  for (const e of entries) {
    if (e.status !== 'Pago') continue;
    const [a, m] = e.entryDate.split('-').map(Number);
    if (a !== ano || !m) continue;
    if (e.kind === 'receita') pontos[m - 1].entradas += e.amount;
    else pontos[m - 1].saidas += e.amount;
  }

  return pontos;
}

/** Rótulo do status conforme o tipo: quem recebe uma receita não "pagou" nada.
 *  O dado guarda um valor só; a diferença é só de linguagem. */
export function rotuloStatus(kind: FinanceKind, status: FinanceStatus): string {
  if (status === 'Previsto') return 'Previsto';
  return kind === 'receita' ? 'Recebido' : 'Pago';
}
