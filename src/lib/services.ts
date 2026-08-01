// Regras de Serviços internos e Prestação de Serviço. Puro, sem dependência de
// servidor: o formulário calcula ao vivo e a action grava com as mesmas funções.

export const SERVICE_ORDER_STATUSES = ['Em andamento', 'Concluída', 'Cancelada'] as const;
export const SERVICE_PAYMENT_STATUSES = ['Previsto', 'Recebido'] as const;

export type ServiceOrderStatus = (typeof SERVICE_ORDER_STATUSES)[number];
export type ServicePaymentStatus = (typeof SERVICE_PAYMENT_STATUSES)[number];

export type InternalService = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
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
  leadTimeDays: number;
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
  totalAmount: number;
  leadTimeDays: number;
  startDate: string;
  dueDate: string | null;
  items: ServiceOrderItem[];
};

/** Total e prazo de uma prestação.
 *
 *  Prazo é SOMA e não máximo, por decisão do dono: os serviços são executados
 *  em sequência, não em paralelo — quem faz o site depois faz o sistema. Um
 *  prazo por máximo prometeria ao cliente uma entrega que a operação não
 *  consegue cumprir. */
export function totalizarItens(itens: ServiceOrderItem[]): { total: number; prazoDias: number } {
  return itens.reduce(
    (acc, i) => ({
      total: acc.total + (Number.isFinite(i.amount) ? i.amount : 0),
      prazoDias: acc.prazoDias + (Number.isFinite(i.leadTimeDays) ? i.leadTimeDays : 0),
    }),
    { total: 0, prazoDias: 0 }
  );
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

/** O que a prestação deve ter no Financeiro.
 *
 *  Uma receita só por prestação — nunca uma por item —, que é como a contagem
 *  dupla é evitada por construção. Cancelada não gera nada: serviço cancelado
 *  não é dinheiro previsto, e deixar a receita no caixa infla o previsto com
 *  algo que ninguém vai receber.
 *
 *  O status da receita espelha o PAGAMENTO e não a execução: serviço entregue e
 *  não pago continua `Previsto`, que é a verdade do caixa. */
export type LancamentoDaPrestacao =
  | { deveExistir: false }
  | { deveExistir: true; amount: number; status: 'Pago' | 'Previsto'; description: string; entryDate: string };

export function lancamentoDaPrestacao(order: {
  title: string;
  status: ServiceOrderStatus;
  paymentStatus: ServicePaymentStatus;
  totalAmount: number;
  startDate: string;
  dueDate: string | null;
}): LancamentoDaPrestacao {
  if (order.status === 'Cancelada') return { deveExistir: false };
  if (!(order.totalAmount > 0)) return { deveExistir: false };

  return {
    deveExistir: true,
    amount: order.totalAmount,
    status: order.paymentStatus === 'Recebido' ? 'Pago' : 'Previsto',
    description: `Serviço: ${order.title}`,
    // Recebido cai na data de entrega quando ela existe (é quando o dinheiro
    // costuma entrar); sem entrega definida, na data de início.
    entryDate: order.dueDate || order.startDate,
  };
}

export type ServiceIndicators = {
  emAndamento: number;
  concluidas: number;
  receitaRecebida: number;
  receitaPrevista: number;
};

/** Canceladas ficam de fora de toda soma de dinheiro: não são receita nem
 *  previsão. Continuam visíveis na lista, para o histórico não sumir. */
export function computeServiceIndicators(orders: ServiceOrder[]): ServiceIndicators {
  const vivas = orders.filter((o) => o.status !== 'Cancelada');

  return {
    emAndamento: vivas.filter((o) => o.status === 'Em andamento').length,
    concluidas: vivas.filter((o) => o.status === 'Concluída').length,
    receitaRecebida: vivas
      .filter((o) => o.paymentStatus === 'Recebido')
      .reduce((s, o) => s + o.totalAmount, 0),
    receitaPrevista: vivas.reduce((s, o) => s + o.totalAmount, 0),
  };
}

/** Prazo em texto. "0 dias" não diz nada útil num cartão de prestação. */
export function formatPrazo(dias: number): string {
  if (!dias) return 'Sem prazo';
  return dias === 1 ? '1 dia' : `${dias} dias`;
}
