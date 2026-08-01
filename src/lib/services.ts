// Regras de Serviços internos e Prestação de Serviço. Puro, sem dependência de
// servidor: o formulário calcula ao vivo e a action grava com as mesmas funções.

export const SERVICE_ORDER_STATUSES = ['Em andamento', 'Concluída', 'Cancelada'] as const;
export const SERVICE_PAYMENT_STATUSES = ['Previsto', 'Recebido'] as const;

/** Espelha o fluxo da loja. 'Convertido em Prestação' é estado final atingido
 *  pela conversão, nunca escolhido à mão no formulário — senão o orçamento
 *  diria que virou prestação sem que nenhuma exista. */
export const SERVICE_QUOTE_STATUSES = [
  'Em elaboração',
  'Enviado',
  'Aguardando Cliente',
  'Aprovado',
  'Convertido em Prestação',
  'Reprovado',
] as const;

export type ServiceOrderStatus = (typeof SERVICE_ORDER_STATUSES)[number];
export type ServicePaymentStatus = (typeof SERVICE_PAYMENT_STATUSES)[number];
export type ServiceQuoteStatus = (typeof SERVICE_QUOTE_STATUSES)[number];

/** Status que o dono escolhe no formulário. A conversão é a única porta para
 *  'Convertido em Prestação'. */
export const SERVICE_QUOTE_STATUSES_EDITAVEIS = SERVICE_QUOTE_STATUSES.filter(
  (s) => s !== 'Convertido em Prestação'
);

/** Só orçamento aprovado vira prestação. Antes disso não há acordo com o
 *  cliente, e converter criaria trabalho a executar que ninguém contratou. */
export function podeConverterEmPrestacao(status: ServiceQuoteStatus): boolean {
  return status === 'Aprovado';
}

export const BILLING_TYPES = ['unico', 'mensal'] as const;
export type BillingType = (typeof BILLING_TYPES)[number];

/** Durações de contrato oferecidas. 12 é o padrão do dono. */
export const PLAN_MONTHS_OPTIONS = [6, 12, 24] as const;
export const PLAN_MONTHS_DEFAULT = 12;

export type InternalService = {
  id: string;
  name: string;
  description: string;
  category: string;
  /** Em `unico`, o valor do trabalho. Em `mensal`, a MENSALIDADE. */
  price: number;
  billingType: BillingType;
  leadTimeDays: number;
  active: boolean;
  position: number;
};

export type ServiceOrderItem = {
  id?: string;
  internalServiceId: string | null;
  name: string;
  description: string;
  amount: number;
  billingType: BillingType;
  leadTimeDays: number;
};

export type ServiceQuote = {
  id: string;
  customerId: string | null;
  customerName: string;
  title: string;
  notes: string;
  status: ServiceQuoteStatus;
  totalAmount: number;
  monthlyAmount: number;
  planMonths: number | null;
  leadTimeDays: number;
  createdAt: string;
  /** Anexa o contrato ao PDF da proposta. */
  includeContract: boolean;
  /** Move "Domínio" de incluso para não incluso na Cláusula 2. */
  clientHasDomain: boolean;
  /** Prestação gerada a partir deste orçamento, se já houve conversão. */
  orderId: string | null;
  items: ServiceOrderItem[];
};

export type ServiceOrder = {
  id: string;
  customerId: string | null;
  customerName: string;
  quoteId: string | null;
  title: string;
  notes: string;
  status: ServiceOrderStatus;
  paymentStatus: ServicePaymentStatus;
  paymentMethod: string;
  /** Só os serviços de cobrança única. A mensalidade fica em `monthlyAmount`. */
  totalAmount: number;
  monthlyAmount: number;
  planMonths: number | null;
  planStartDate: string | null;
  leadTimeDays: number;
  startDate: string;
  dueDate: string | null;
  items: ServiceOrderItem[];
};

export type TotaisDosItens = {
  /** Serviços cobrados uma vez. */
  total: number;
  /** Soma das mensalidades — valor de UM mês, não do contrato inteiro. */
  mensal: number;
  prazoDias: number;
  temPlano: boolean;
};

const num = (v: number) => (Number.isFinite(v) ? v : 0);

/** Totais de uma prestação ou orçamento.
 *
 *  Valor único e mensalidade ficam SEPARADOS, por decisão do dono: é como o
 *  contrato é lido ("R$ 4.500 + R$ 149/mês") e somar os dois apagaria a
 *  informação de quanto é recorrente.
 *
 *  Prazo é SOMA e não máximo: os serviços são executados em sequência, não em
 *  paralelo — quem faz o site depois faz o sistema. Um prazo por máximo
 *  prometeria ao cliente uma entrega que a operação não cumpre.
 *
 *  Serviço mensal NÃO entra na soma do prazo: hospedagem e manutenção são
 *  contínuas, não têm data de entrega, e somar o "prazo" delas empurraria a
 *  entrega do trabalho real para meses à frente. */
export function totalizarItens(itens: ServiceOrderItem[]): TotaisDosItens {
  const totais = itens.reduce(
    (acc, i) =>
      i.billingType === 'mensal'
        ? { ...acc, mensal: acc.mensal + num(i.amount) }
        : { ...acc, total: acc.total + num(i.amount), prazoDias: acc.prazoDias + num(i.leadTimeDays) },
    { total: 0, mensal: 0, prazoDias: 0 }
  );

  return { ...totais, temPlano: totais.mensal > 0 };
}

/** Valor do contrato inteiro: o trabalho mais todas as mensalidades. Só para
 *  exibição — o Financeiro nunca recebe este número de uma vez. */
export function valorDoContrato(totais: TotaisDosItens, meses: number | null): number {
  return totais.total + totais.mensal * (meses ?? 0);
}

/** Data de entrega = início + prazo, em dias de calendário.
 *
 *  Construída pelos componentes locais da data, não por `new Date(iso)`, que
 *  interpreta "2026-08-01" como meia-noite UTC e no Brasil devolve 31/07. */
export function calcularEntrega(startDate: string, prazoDias: number): string | null {
  if (!startDate) return null;
  const [ano, mes, dia] = startDate.split('-').map(Number);
  if (!ano || !mes || !dia) return null;

  const d = new Date(ano, mes - 1, dia + prazoDias);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Soma meses a uma data de calendário, prendendo no último dia quando o dia
 *  original não existe no mês de destino.
 *
 *  Sem o clamp, um plano que começa em 31/01 pularia fevereiro inteiro: o
 *  JavaScript transborda `new Date(2026, 1, 31)` para 3 de março, e a parcela
 *  de fevereiro apareceria em março junto da de março. Contrato mensal cobra
 *  "todo dia 31, ou o último se o mês não tiver". */
export function somarMeses(dataISO: string, meses: number): string {
  const [ano, mes, dia] = dataISO.split('-').map(Number);
  const alvo = new Date(ano, mes - 1 + meses, 1);
  const ultimoDiaDoMes = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  const d = new Date(alvo.getFullYear(), alvo.getMonth(), Math.min(dia, ultimoDiaDoMes));

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export type LancamentoAlvo = {
  /** `null` no lançamento do trabalho; preenchido nas parcelas do plano, que
   *  compartilham o mesmo valor para poderem ser agrupadas. */
  parcela: number | null;
  amount: number;
  status: 'Pago' | 'Previsto';
  description: string;
  entryDate: string;
};

/** O que a prestação deve ter no Financeiro.
 *
 *  Um lançamento para o trabalho — nunca um por serviço —, que é como a
 *  contagem dupla é evitada por construção, mais UMA PARCELA POR MÊS do plano
 *  quando existe mensalidade.
 *
 *  As parcelas são lançadas todas de uma vez, por decisão do dono: é o que faz
 *  o gráfico de fluxo de caixa mostrar o que entra em cada mês. Um lançamento
 *  único com o total do contrato criaria um pico num mês que nunca acontece.
 *
 *  Cancelada não gera nada e apaga o que havia: serviço cancelado não é
 *  dinheiro previsto, e deixá-lo no caixa infla o previsto com algo que ninguém
 *  vai receber — nas 24 parcelas de um plano, o estrago seria grande.
 *
 *  O status do trabalho espelha o PAGAMENTO e não a execução: serviço entregue
 *  e não pago continua `Previsto`, que é a verdade do caixa. As parcelas nascem
 *  sempre `Previsto` e são baixadas uma a uma, porque cada mês é um
 *  recebimento independente. */
export function lancamentosDaPrestacao(order: {
  title: string;
  status: ServiceOrderStatus;
  paymentStatus: ServicePaymentStatus;
  totalAmount: number;
  monthlyAmount: number;
  planMonths: number | null;
  planStartDate: string | null;
  startDate: string;
  dueDate: string | null;
}): LancamentoAlvo[] {
  if (order.status === 'Cancelada') return [];

  const alvos: LancamentoAlvo[] = [];

  if (order.totalAmount > 0) {
    alvos.push({
      parcela: null,
      amount: order.totalAmount,
      status: order.paymentStatus === 'Recebido' ? 'Pago' : 'Previsto',
      description: `Serviço: ${order.title}`,
      // Cai na data de entrega quando ela existe (é quando o dinheiro costuma
      // entrar); sem entrega definida, na data de início.
      entryDate: order.dueDate || order.startDate,
    });
  }

  const meses = order.planMonths ?? 0;
  const inicio = order.planStartDate || order.startDate;

  if (order.monthlyAmount > 0 && meses > 0 && inicio) {
    for (let i = 0; i < meses; i++) {
      alvos.push({
        parcela: i + 1,
        amount: order.monthlyAmount,
        status: 'Previsto',
        description: `Plano: ${order.title} (${i + 1}/${meses})`,
        entryDate: somarMeses(inicio, i),
      });
    }
  }

  return alvos;
}

export type ServiceIndicators = {
  emAndamento: number;
  concluidas: number;
  receitaRecebida: number;
  receitaPrevista: number;
  /** Soma das mensalidades ativas — quanto entra por mês enquanto os planos
   *  correm. É o número que diz o tamanho da receita recorrente. */
  recorrenteMensal: number;
  planosAtivos: number;
};

/** Canceladas ficam de fora de toda soma de dinheiro: não são receita nem
 *  previsão. Continuam visíveis na lista, para o histórico não sumir.
 *
 *  "Receita prevista" é o valor de CONTRATO: o trabalho mais todas as
 *  mensalidades combinadas. "Recorrente/mês" é o de um mês só. Os dois juntos
 *  respondem perguntas diferentes — quanto o contrato vale e quanto entra por
 *  mês — e nenhum deles sozinho responde as duas. */
export function computeServiceIndicators(orders: ServiceOrder[]): ServiceIndicators {
  const vivas = orders.filter((o) => o.status !== 'Cancelada');
  const comPlano = vivas.filter((o) => o.monthlyAmount > 0 && (o.planMonths ?? 0) > 0);

  return {
    emAndamento: vivas.filter((o) => o.status === 'Em andamento').length,
    concluidas: vivas.filter((o) => o.status === 'Concluída').length,
    receitaRecebida: vivas
      .filter((o) => o.paymentStatus === 'Recebido')
      .reduce((s, o) => s + o.totalAmount, 0),
    receitaPrevista: vivas.reduce(
      (s, o) => s + o.totalAmount + o.monthlyAmount * (o.planMonths ?? 0),
      0
    ),
    recorrenteMensal: comPlano.reduce((s, o) => s + o.monthlyAmount, 0),
    planosAtivos: comPlano.length,
  };
}

export type ServiceQuoteIndicators = {
  emAberto: number;
  aprovados: number;
  valorEmAberto: number;
  valorAprovado: number;
};

/** Indicadores dos orçamentos.
 *
 *  "Em aberto" é o que ainda pode virar sim: elaboração, enviado e aguardando.
 *  Reprovado e já convertido saem da conta — o primeiro morreu, o segundo já é
 *  prestação e contá-lo aqui somaria o mesmo dinheiro duas vezes no painel.
 *
 *  "Aprovado" conta só o que está aprovado e AINDA NÃO convertido: é a fila de
 *  trabalho a converter. Zero aqui com orçamentos aprovados na lista significa
 *  que todos já viraram prestação. */
export function computeServiceQuoteIndicators(quotes: ServiceQuote[]): ServiceQuoteIndicators {
  const emAberto = quotes.filter((q) =>
    ['Em elaboração', 'Enviado', 'Aguardando Cliente'].includes(q.status)
  );
  const aprovados = quotes.filter((q) => q.status === 'Aprovado');

  return {
    emAberto: emAberto.length,
    aprovados: aprovados.length,
    valorEmAberto: emAberto.reduce((s, q) => s + q.totalAmount, 0),
    valorAprovado: aprovados.reduce((s, q) => s + q.totalAmount, 0),
  };
}

/** Prazo em texto. "0 dias" não diz nada útil num cartão de prestação. */
export function formatPrazo(dias: number): string {
  if (!dias) return 'Sem prazo';
  return dias === 1 ? '1 dia' : `${dias} dias`;
}
