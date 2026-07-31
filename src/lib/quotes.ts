// Motor de cálculo dos orçamentos de importação. Puro, sem dependência de
// servidor: o formulário do admin é client component e precisa recalcular a
// cada tecla digitada, e a action revalida no servidor com a mesma função —
// duas implementações do mesmo cálculo divergiriam com o tempo.

export const QUOTE_STATUSES = [
  'Em elaboração',
  'Enviado',
  'Aguardando Cliente',
  'Aprovado',
  'Reprovado',
  'Convertido em Estoque',
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

/** Componentes digitados em dólar. O frete fica de fora de propósito: ele é
 *  cobrado localmente em reais e segue o caminho inverso. */
export type QuoteUsdInputs = {
  productValue: number;
  tax: number;
  travelerFee: number;
  grabrFee: number;
  processing: number;
};

export type QuoteInputs = QuoteUsdInputs & {
  /** Frete em BRL — único componente com origem em reais. */
  shippingBrl: number;
  salePriceBrl: number;
};

export type QuoteTotals = {
  usd: QuoteUsdInputs & { shipping: number; total: number };
  brl: QuoteUsdInputs & { shipping: number; total: number };
  profitBrl: number;
  marginPct: number;
};

const USD_KEYS = ['productValue', 'tax', 'travelerFee', 'grabrFee', 'processing'] as const;

function arredondar(v: number): number {
  return Math.round((Number.isFinite(v) ? v : 0) * 100) / 100;
}

/** Converte e totaliza. `usdRate` precisa ser maior que zero — sem cotação
 *  configurada o cálculo não deve acontecer, e quem chama é responsável por
 *  barrar antes. Aqui devolvemos zeros em vez de dividir por zero e propagar
 *  Infinity para dentro do banco. */
export function calculateQuote(inputs: QuoteInputs, usdRate: number): QuoteTotals {
  const taxaValida = Number.isFinite(usdRate) && usdRate > 0;
  const taxa = taxaValida ? usdRate : 0;

  const usd = {} as QuoteUsdInputs;
  const brl = {} as QuoteUsdInputs;
  for (const chave of USD_KEYS) {
    const valorUsd = arredondar(inputs[chave]);
    usd[chave] = valorUsd;
    brl[chave] = arredondar(valorUsd * taxa);
  }

  // Frete: o valor real é o de reais; o dólar é só informativo, para a coluna
  // USD fechar. Sem cotação não há como derivar, então fica zero.
  const shippingBrl = arredondar(inputs.shippingBrl);
  const shippingUsd = taxaValida ? arredondar(shippingBrl / taxa) : 0;

  const totalUsd = arredondar(USD_KEYS.reduce((s, k) => s + usd[k], 0) + shippingUsd);
  const totalBrl = arredondar(USD_KEYS.reduce((s, k) => s + brl[k], 0) + shippingBrl);

  const salePrice = arredondar(inputs.salePriceBrl);
  const profitBrl = arredondar(salePrice - totalBrl);
  // Margem sobre o preço de venda, não sobre o custo. Venda zero não tem
  // margem definida — devolver 0 evita NaN aparecendo na tela e no banco.
  const marginPct = salePrice > 0 ? arredondar((profitBrl / salePrice) * 100) : 0;

  return {
    usd: { ...usd, shipping: shippingUsd, total: totalUsd },
    brl: { ...brl, shipping: shippingBrl, total: totalBrl },
    profitBrl,
    marginPct,
  };
}

/** Orçamento já convertido em estoque tem histórico congelado: recalcular
 *  mudaria retroativamente o custo de um item que já entrou no patrimônio. */
export function podeRecalcular(status: QuoteStatus): boolean {
  return status !== 'Convertido em Estoque';
}
