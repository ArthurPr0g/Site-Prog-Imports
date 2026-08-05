// Desconto dos orçamentos, em porcentagem ou em reais. Compartilhado pela loja
// e por serviços: são a mesma conta, e duas implementações divergiriam.

export const DISCOUNT_TYPES = ['percentual', 'valor'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export type Desconto = {
  tipo: DiscountType;
  /** Em `percentual`, de 0 a 100. Em `valor`, reais. */
  valor: number;
  /** Motivo, que sai no PDF ao lado da linha de desconto. */
  descricao: string;
};

export const SEM_DESCONTO: Desconto = { tipo: 'valor', valor: 0, descricao: '' };

function arredondar(v: number): number {
  return Math.round((Number.isFinite(v) ? v : 0) * 100) / 100;
}

/** Quanto o desconto vale em reais sobre uma base.
 *
 *  Nunca passa da base nem fica negativo: um desconto de R$ 5.000 sobre R$ 800
 *  viraria um preço negativo, e um percentual de 150% faria o cliente receber
 *  dinheiro para comprar. Limitar aqui é mais seguro que validar em cada tela —
 *  a conta é a mesma nos dois orçamentos e no PDF. */
export function valorDoDesconto(base: number, desconto: Desconto): number {
  const b = arredondar(base);
  if (b <= 0) return 0;

  const bruto =
    desconto.tipo === 'percentual'
      ? (b * Math.min(Math.max(arredondar(desconto.valor), 0), 100)) / 100
      : arredondar(desconto.valor);

  return arredondar(Math.min(Math.max(bruto, 0), b));
}

/** Base menos o desconto. */
export function aplicarDesconto(base: number, desconto: Desconto): number {
  return arredondar(arredondar(base) - valorDoDesconto(base, desconto));
}

export function temDesconto(desconto: Desconto): boolean {
  return desconto.valor > 0;
}

/** Rótulo para a tela e para o PDF: "10%" ou "R$ 200,00". O percentual mostra a
 *  taxa, não o valor calculado — é o que foi combinado com o cliente. */
export function rotuloDoDesconto(desconto: Desconto): string {
  if (desconto.tipo === 'percentual') {
    const pct = Math.min(Math.max(arredondar(desconto.valor), 0), 100);
    // Sem casas decimais quando é inteiro: "10%" e não "10,00%".
    return `${pct % 1 === 0 ? pct : pct.toFixed(2).replace('.', ',')}%`;
  }
  return arredondar(desconto.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
