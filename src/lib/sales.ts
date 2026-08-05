// Regras de Vendas (M4). Puro, sem dependência de servidor.

export const SALE_ORIGINS = ['Site', 'Manual', 'Orçamento', 'Troca'] as const;
export type SaleOrigin = (typeof SALE_ORIGINS)[number];

/** Status que o dono escolhe. 'Cancelado' é a saída negativa. */
export const SALE_STATUSES = [
  'Aguardando pagamento',
  'Pago',
  'Enviado',
  'Entregue',
  'Cancelado',
] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

/** A partir daqui o dinheiro entrou. Antes disso a venda é promessa. */
const STATUS_PAGOS: readonly SaleStatus[] = ['Pago', 'Enviado', 'Entregue'];

export function vendaFoiPaga(status: SaleStatus): boolean {
  return STATUS_PAGOS.includes(status);
}

export type SaleItem = {
  id?: string;
  productId: string | null;
  stockItemId: string | null;
  productName: string;
  qty: number;
  unitPrice: number;
  unitCost: number;
};

export type Sale = {
  id: string;
  orderNumber: number;
  customerId: string | null;
  customerName: string;
  origin: SaleOrigin;
  status: SaleStatus;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  costTotal: number;
  budgetId: string | null;
  createdAt: string;
  items: SaleItem[];
};

function arredondar(v: number): number {
  return Math.round((Number.isFinite(v) ? v : 0) * 100) / 100;
}

export type TotaisDaVenda = {
  subtotal: number;
  custo: number;
  /** O que o cliente paga: subtotal − desconto + frete. */
  total: number;
  lucro: number;
  margemPct: number;
};

/** Totais de uma venda a partir dos itens.
 *
 *  O frete entra no total mas NÃO no lucro: ele é repasse, não margem. Somá-lo
 *  ao lucro faria um frete caro parecer venda lucrativa. */
export function totalizarVenda(
  itens: SaleItem[],
  desconto: number,
  frete: number
): TotaisDaVenda {
  const subtotal = arredondar(itens.reduce((s, i) => s + arredondar(i.unitPrice) * (i.qty || 0), 0));
  const custo = arredondar(itens.reduce((s, i) => s + arredondar(i.unitCost) * (i.qty || 0), 0));

  const desc = Math.min(Math.max(arredondar(desconto), 0), subtotal);
  const total = arredondar(subtotal - desc + arredondar(frete));

  const lucro = arredondar(subtotal - desc - custo);
  // Margem sobre a mercadoria, não sobre o total: o frete infla o denominador
  // e faria a mesma venda parecer menos lucrativa só por ter frete maior.
  const base = arredondar(subtotal - desc);
  const margemPct = base > 0 ? arredondar((lucro / base) * 100) : 0;

  return { subtotal, custo, total, lucro, margemPct };
}

export type LancamentoDaVenda = {
  kind: 'receita' | 'despesa';
  amount: number;
  status: 'Pago' | 'Previsto';
  description: string;
  entryDate: string;
};

/** O que a venda deve ter no Financeiro: uma RECEITA do total e uma DESPESA do
 *  custo.
 *
 *  É assim que a ressalva do M5 se resolve sem mudar a fórmula do resultado:
 *  receita menos despesa vira o lucro por construção, e o fluxo de caixa mostra
 *  as duas pontas reais — o dinheiro que entrou do cliente e o que saiu para o
 *  fornecedor. Lançar só o lucro esconderia o faturamento; lançar só a receita
 *  inflaria o resultado com um custo que existe.
 *
 *  Venda cancelada não lança nada: não houve dinheiro em nenhuma direção.
 *
 *  O status segue o da venda — enquanto está "Aguardando pagamento" as duas
 *  linhas são `Previsto`, porque nem a entrada nem a saída aconteceram. */
export function lancamentosDaVenda(venda: {
  orderNumber: number;
  status: SaleStatus;
  total: number;
  costTotal: number;
  createdAt: string;
}): LancamentoDaVenda[] {
  if (venda.status === 'Cancelado') return [];

  const status = vendaFoiPaga(venda.status) ? 'Pago' : 'Previsto';
  const data = venda.createdAt.slice(0, 10);
  const alvos: LancamentoDaVenda[] = [];

  if (venda.total > 0) {
    alvos.push({
      kind: 'receita',
      amount: arredondar(venda.total),
      status,
      description: `Venda #${venda.orderNumber}`,
      entryDate: data,
    });
  }

  if (venda.costTotal > 0) {
    alvos.push({
      kind: 'despesa',
      amount: arredondar(venda.costTotal),
      status,
      description: `Custo da venda #${venda.orderNumber}`,
      entryDate: data,
    });
  }

  return alvos;
}

export type SaleIndicators = {
  vendas: number;
  faturamento: number;
  custo: number;
  lucro: number;
  margemPct: number;
  aguardandoPagamento: number;
};

/** Canceladas ficam de fora de toda soma: não são faturamento nem custo.
 *  Continuam na lista, para o histórico não sumir. */
export function computeSaleIndicators(vendas: Sale[]): SaleIndicators {
  const vivas = vendas.filter((v) => v.status !== 'Cancelado');

  const faturamento = arredondar(vivas.reduce((s, v) => s + v.total, 0));
  const custo = arredondar(vivas.reduce((s, v) => s + v.costTotal, 0));
  const lucro = arredondar(faturamento - custo);

  return {
    vendas: vivas.length,
    faturamento,
    custo,
    lucro,
    margemPct: faturamento > 0 ? arredondar((lucro / faturamento) * 100) : 0,
    aguardandoPagamento: vivas.filter((v) => v.status === 'Aguardando pagamento').length,
  };
}
