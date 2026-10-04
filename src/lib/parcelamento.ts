// Parcelamento no cartão, do jeito que a loja realmente vende.
//
// Nada aqui tem a ver com o carnê do ERP (`lib/installments.ts`), que é o PIX
// parcelado da própria loja. Isto é o cartão, cobrado por link de pagamento da
// InfinitePay.
//
// A regra do negócio, em uma frase: **a loja banca os juros até 3×; daí para
// frente quem paga é o cliente.** O site anunciava "12x sem juros" em nove
// lugares, o que custaria 16,66% do valor da venda numa compra de 12 vezes —
// numa máquina de R$ 20 mil, R$ 3.332 de margem que não existia.

/* -------------------------------------------------------------- as taxas */

/** Taxas da InfinitePay para **link de pagamento e venda online**, plano de
 *  recebimento "em 1 dia útil" — que é como a conta da loja está configurada,
 *  confirmado pelo dono em 03/10/2026. Conferidas em infinitepay.io/taxas na
 *  mesma data.
 *
 *  Se o plano virar "na hora" (o Nitro), esta tabela fica errada e barata: lá o
 *  crédito à vista é 5,99% e o 12× é 18,79%. Trocar o plano no aplicativo
 *  **sem trocar esta tabela** faz o site prometer uma parcela que a operadora
 *  não vai cobrar — e a diferença sai do bolso da loja.
 *
 *  Duas armadilhas que já quase entraram aqui:
 *
 *  1. **A tabela da maquininha é outra.** Lá o crédito à vista vai de 2,69% a
 *     3,15% conforme o faturamento do mês; aqui é 4,20% fixo. Usar a tabela
 *     errada mostraria ao cliente uma parcela menor do que ele vai pagar.
 *  2. **O salto do 7×.** De 6× para 7× a taxa pula de 9,67% para 12,59% — quase
 *     três pontos de uma vez, enquanto os outros degraus andam de nove décimos.
 *     Não é erro de digitação: é onde a InfinitePay muda a faixa. Uma fórmula
 *     linear "taxa = n × 0,9%" erraria feio daí para frente, e é por isso que
 *     isto é tabela e não conta. */
const TAXA_POR_PARCELA: Record<number, number> = {
  1: 0.042,
  2: 0.0609,
  3: 0.0701,
  4: 0.0791,
  5: 0.088,
  6: 0.0967,
  7: 0.1259,
  8: 0.1342,
  9: 0.1425,
  10: 0.1506,
  11: 0.1587,
  12: 0.1666,
};

/** Até quantas vezes a loja absorve a taxa. */
export const PARCELAS_SEM_JUROS = 3;

/** Teto que a InfinitePay oferece no link de pagamento. */
export const PARCELAS_MAXIMAS = 12;

/* ------------------------------------------------------------- a conta */

/** O valor que o cliente paga para a loja receber `liquido` inteiro.
 *
 *  Divisão, e não multiplicação. Somar a taxa ao preço (`valor × 1,1666`)
 *  deixa a loja recebendo a menos, porque a taxa incide sobre o total cobrado e
 *  não sobre o preço de tabela: numa venda de R$ 20.000 em 12×, somar devolve
 *  R$ 19.444 e dividir devolve os R$ 20.000. A diferença de R$ 556 é
 *  exatamente o buraco que esse erro abre em silêncio. */
function comTaxaRepassada(liquido: number, taxa: number): number {
  return liquido / (1 - taxa);
}

export type Simulacao = {
  parcelas: number;
  /** Valor de cada parcela, já arredondado para o centavo. */
  valorDaParcela: number;
  /** Total que o cliente paga. */
  total: number;
  /** `true` quando a loja banca a taxa e o cliente paga o preço de tabela. */
  semJuros: boolean;
};

/** A tabela de parcelas de um preço, de 1× ao teto.
 *
 *  Até `PARCELAS_SEM_JUROS` o cliente paga o preço de tabela dividido. Acima
 *  disso, o total sobe pela taxa da InfinitePay daquela quantidade de parcelas
 *  — é o "repassar taxas" do painel deles, com a mesma conta. */
export function simularParcelamento(preco: number): Simulacao[] {
  const linhas: Simulacao[] = [];
  for (let n = 1; n <= PARCELAS_MAXIMAS; n++) {
    const taxa = TAXA_POR_PARCELA[n];
    if (taxa === undefined) continue;
    const semJuros = n <= PARCELAS_SEM_JUROS;
    const total = semJuros ? preco : comTaxaRepassada(preco, taxa);
    linhas.push({
      parcelas: n,
      valorDaParcela: Math.round((total / n) * 100) / 100,
      total: Math.round(total * 100) / 100,
      semJuros,
    });
  }
  return linhas;
}

/** O valor da maior parcela sem juros — é o número que aparece embaixo do preço
 *  na vitrine, no carrinho e no card do produto. */
export function parcelaSemJuros(preco: number): number {
  return preco / PARCELAS_SEM_JUROS;
}
