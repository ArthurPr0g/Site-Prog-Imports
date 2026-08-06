// Regras da Avaliação de Troca (M8). Puro, sem dependência de servidor.

export const CONDICOES = [
  'Novo',
  'Seminovo - Excelente',
  'Seminovo - Bom',
  'Usado - Regular',
  'Usado - Com avarias',
] as const;
export type CondicaoItem = (typeof CONDICOES)[number];

/** Limite do documento original. Fica na tela, não no banco: um caso
 *  excepcional não deveria esbarrar numa restrição de schema. */
export const MAX_ITENS_RECEBIDOS = 10;

export type TradeItem = {
  id?: string;
  name: string;
  category: string;
  specs: string;
  condition: CondicaoItem;
  /** Quanto o produto vale no mercado — referência de negociação. */
  marketValue: number;
  /** Quanto a loja aceitou abater do preço por ele. */
  paidValue: number;
  /** Por quanto a loja espera revendê-lo. */
  resaleValue: number;
  notes: string;
  stockItemId?: string | null;
};

export type Trade = {
  id: string;
  customerId: string | null;
  customerName: string;
  stockItemId: string | null;
  mainProductName: string;
  /** Foto do item de estoque que saiu na negociação. */
  mainPhotoUrl: string;
  mainSalePrice: number;
  mainCost: number;
  totalReceived: number;
  differenceToPay: number;
  totalProfit: number;
  marginPct: number;
  paymentMethod: string;
  installmentCount: number;
  downPayment: number;
  interestPct: number;
  firstDueDate: string | null;
  installmentNotes: string;
  notes: string;
  tradeDate: string;
  orderId: string | null;
  orderNumber: number | null;
  items: TradeItem[];
};

function arredondar(v: number): number {
  return Math.round((Number.isFinite(v) ? v : 0) * 100) / 100;
}

/** Lucro esperado de um produto recebido: o que a loja espera tirar dele menos
 *  o que abateu por ele. Só se realiza quando o item for revendido. */
export function lucroDoItem(item: TradeItem): number {
  return arredondar(arredondar(item.resaleValue) - arredondar(item.paidValue));
}

export type TotaisDaTroca = {
  /** Soma do que a loja abateu pelos produtos recebidos. */
  totalRecebido: number;
  /** O que o cliente ainda paga em dinheiro. */
  diferenca: number;
  /** Venda do principal menos o custo dele. */
  lucroPrincipal: number;
  /** Lucro do principal mais o esperado dos recebidos. */
  lucroTotal: number;
  margemPct: number;
  /** Quanto os produtos recebidos passam do preço do principal, quando passam.
   *  Nesse caso a loja "deve" ao cliente — o negócio precisa de outro acerto. */
  excedente: number;
};

/** Totais da negociação.
 *
 *  A diferença nunca fica negativa: se os produtos recebidos valem mais que o
 *  principal, o cliente não paga nada em dinheiro e a sobra aparece em
 *  `excedente`, para a tela avisar em vez de esconder um número impossível. */
export function totalizarTroca(
  itens: TradeItem[],
  precoPrincipal: number,
  custoPrincipal: number
): TotaisDaTroca {
  const totalRecebido = arredondar(itens.reduce((s, i) => s + arredondar(i.paidValue), 0));
  const preco = arredondar(precoPrincipal);

  const bruto = arredondar(preco - totalRecebido);
  const diferenca = Math.max(bruto, 0);
  const excedente = Math.max(arredondar(-bruto), 0);

  const lucroPrincipal = arredondar(preco - arredondar(custoPrincipal));
  const lucroItens = arredondar(itens.reduce((s, i) => s + lucroDoItem(i), 0));
  const lucroTotal = arredondar(lucroPrincipal + lucroItens);

  return {
    totalRecebido,
    diferenca,
    lucroPrincipal,
    lucroTotal,
    margemPct: preco > 0 ? arredondar((lucroTotal / preco) * 100) : 0,
    excedente,
  };
}

/** Status com que a venda gerada nasce.
 *
 *  Só fica pendente quando há diferença a pagar E ela foi parcelada: nesse caso
 *  o dinheiro entra ao longo dos meses. Diferença zero (produtos cobriram tudo)
 *  ou paga à vista já nasce quitada — não há o que esperar. */
export function statusDaVendaGerada(diferenca: number, formaPagamento: string): 'Aguardando pagamento' | 'Pago' {
  return diferenca > 0 && formaPagamento === 'PIX Parcelado' ? 'Aguardando pagamento' : 'Pago';
}

/** O que a troca leva ao Financeiro, pela venda gerada.
 *
 *  **Produto recebido não é caixa.** Ele vira item de estoque — um ativo — e só
 *  vira dinheiro quando for revendido. Lançar o valor abatido como receita
 *  inventaria uma entrada que nunca aconteceu.
 *
 *  Então a receita é apenas a **diferença em dinheiro**, e a despesa é o **custo
 *  do principal** inteiro — o mesmo critério do M4, onde o custo é reconhecido
 *  na venda e não na compra do estoque.
 *
 *  Consequência que a tela precisa avisar: numa troca em que os produtos cobrem
 *  boa parte do preço, o resultado do mês fica pequeno ou negativo. Está certo —
 *  o valor que faltou não desapareceu, está nos itens recebidos, esperando
 *  revenda. Esconder isso somando o valor dos produtos como receita seria pior:
 *  o caixa passaria a afirmar uma entrada que não houve. */
export function valorDaVendaGerada(
  totais: TotaisDaTroca,
  custoPrincipal: number
): { total: number; custo: number } {
  return { total: totais.diferenca, custo: arredondar(custoPrincipal) };
}

/** O resultado imediato no caixa: o que entra em dinheiro menos o custo do que
 *  saiu do estoque. Serve para a tela mostrar o número antes de concluir, em vez
 *  de o dono descobrir no Financeiro depois. */
export function efeitoNoCaixa(totais: TotaisDaTroca, custoPrincipal: number): number {
  return arredondar(totais.diferenca - arredondar(custoPrincipal));
}
