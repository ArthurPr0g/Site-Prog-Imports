// Tipos, constantes e cálculos do estoque — sem nenhuma dependência de
// servidor. Fica separado de `lib/data/stock.ts` porque a tabela do admin é
// client component: importar de lá arrastaria `next/headers` para o bundle do
// navegador, e o build quebra.

export const STOCK_STATUSES = ['Disponível', 'Reservado', 'Em Transporte', 'Vendido'] as const;
export const STOCK_ORIGINS = ['Manual', 'Orçamento', 'Troca'] as const;

export type StockStatus = (typeof STOCK_STATUSES)[number];
export type StockOrigin = (typeof STOCK_ORIGINS)[number];

export type StockItem = {
  id: string;
  origin: StockOrigin;
  status: StockStatus;
  productId: string | null;
  reservedCustomerId: string | null;
  reservedCustomerName: string;
  name: string;
  category: string;
  specs: string;
  productLink: string;
  photoUrl: string;
  purchaseDate: string;
  entryDate: string;
  usdRate: number | null;
  paidAmount: number;
  saleAmount: number;
  notes: string;
  /** Sempre calculado, nunca persistido: valor de venda menos o que foi pago. */
  expectedProfit: number;
};

export type StockIndicators = {
  totalSaleValue: number;
  totalCostValue: number;
  soldCount: number;
  inTransitCount: number;
};

/** Indicadores do topo. Calculados sobre a lista inteira, sem filtro de
 *  período: representam o que existe agora, não o que aconteceu num intervalo.
 *  Os valores somam só o que ainda está em estoque, porque item vendido já
 *  saiu do patrimônio — contá-lo inflaria o total sem lastro. */
export function computeIndicators(items: StockItem[]): StockIndicators {
  const emEstoque = items.filter((i) => i.status !== 'Vendido');
  return {
    totalSaleValue: emEstoque.reduce((soma, i) => soma + i.saleAmount, 0),
    totalCostValue: emEstoque.reduce((soma, i) => soma + i.paidAmount, 0),
    soldCount: items.filter((i) => i.status === 'Vendido').length,
    inTransitCount: items.filter((i) => i.status === 'Em Transporte').length,
  };
}
