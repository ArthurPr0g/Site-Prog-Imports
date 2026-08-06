// Proposta da loja em imagem: o que o cliente vê do orçamento.
//
// Só o resultado. O orçamento guarda a formação de preço inteira — valor do
// produto, imposto, taxa do viajante, processamento, câmbio, custo total, lucro
// e margem. Nada disso é assunto do cliente: mostrar o custo convida a negociar
// a margem, e mostrar o câmbio transforma cada oscilação do dólar em conversa.

import { PAYMENT_METHODS } from '@/lib/installments';
import { aplicarDesconto, temDesconto, rotuloDoDesconto, type Desconto } from '@/lib/discount';

/** Formas de pagamento que aparecem para o cliente.
 *
 *  O PIX Parcelado fica de fora por decisão do dono: parcelar é concessão caso
 *  a caso, decidida na hora de lançar a venda. Anunciá-lo na proposta faria
 *  todo cliente pedir, e transformaria a exceção em expectativa. */
export const FORMAS_NA_PROPOSTA: readonly string[] = PAYMENT_METHODS.filter((m) => m !== 'PIX Parcelado');

export type PropostaDaLoja = {
  produto: string;
  categoria: string;
  specs: string;
  /** Foto do produto no catálogo. Vazio cai no espaço reservado. */
  fotoUrl: string;
  /** Preço cheio, antes do desconto. */
  precoCheio: number;
  descontoBrl: number;
  rotuloDesconto: string;
  valorFinal: number;
  frete: string;
  formas: readonly string[];
  cliente: string;
  data: string;
  validade: string;
};

/** Como o frete é dito ao cliente.
 *
 *  No orçamento, `shippingBrl` é o que a Prog PAGA para trazer o produto — é
 *  componente de custo, e o preço de venda já o cobre. Repassá-lo como linha
 *  separada faria o cliente somar duas vezes. Por isso a proposta fala em
 *  "incluso", que é o que de fato acontece. */
export function textoDoFrete(freteBrl: number): string {
  return freteBrl > 0 ? 'Incluso no valor' : 'A combinar';
}

/** Aviso de validade. O orçamento acompanha o câmbio até ser aprovado, então
 *  prometer preço fixo por prazo nenhum seria mentira — e prometer nada deixa o
 *  cliente achando que o valor cai do céu. */
export const AVISO_DE_VALIDADE =
  'Valor sujeito à variação do dólar até a confirmação do pedido.';

export type OrcamentoParaProposta = {
  name: string;
  category: string;
  specs: string;
  salePriceBrl: number;
  shippingBrl: number;
  desconto: Desconto;
  customerName: string;
  createdAt: string;
};

export function montarProposta(
  q: OrcamentoParaProposta,
  fotoUrl: string,
  dataFormatada: string
): PropostaDaLoja {
  const final = aplicarDesconto(q.salePriceBrl, q.desconto);
  const tem = temDesconto(q.desconto);

  return {
    produto: q.name.trim(),
    categoria: q.category.trim(),
    specs: q.specs.trim(),
    fotoUrl,
    precoCheio: q.salePriceBrl,
    descontoBrl: tem ? Math.round((q.salePriceBrl - final) * 100) / 100 : 0,
    rotuloDesconto: tem ? rotuloDoDesconto(q.desconto) : '',
    valorFinal: final,
    frete: textoDoFrete(q.shippingBrl),
    formas: FORMAS_NA_PROPOSTA,
    cliente: q.customerName.trim(),
    data: dataFormatada,
    validade: AVISO_DE_VALIDADE,
  };
}

/** Nome do arquivo: sem acento, sem barra, reconhecível na pasta de downloads. */
export function nomeDaProposta(produto: string): string {
  const limpo = produto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 45)
    .toLowerCase();
  return `proposta-${limpo || 'prog-imports'}.png`;
}
