// Condições de pagamento dos serviços da Prog Soluções, as mesmas publicadas na
// página de planos do portfólio (portfolio-arthur-prog.vercel.app/#/planos).
// Puro, sem servidor: a tela mostra a prévia e a action grava com as mesmas
// funções.
//
// Toda condição daqui vira CARNÊ (`payment_installments`): cada pedaço do
// pagamento é uma parcela com valor e vencimento próprios, aparece no
// Financeiro como uma receita prevista e é baixada pelo dono quando o dinheiro
// entra. É o mesmo caminho que o PIX Parcelado já usa, então o acompanhamento
// do cliente e o caixa funcionam sem nada novo.
//
// As formas antigas (PIX à vista, PIX Parcelado, Débito, Transferência e o
// "Cartão de Crédito" sem detalhe) continuam valendo para prestações antigas e
// para casos fora da tabela.

import { somarMeses, calcularEntrega } from '@/lib/services';
import type { Installment } from '@/lib/installments';

/** Pix ou boleto: metade no fechamento, metade na entrega. */
export const METODO_50_50 = 'Pix ou boleto (50% + 50%)';
/** Cartão sem juros, a Prog absorve a taxa da operadora. */
export const METODO_CARTAO_1X = 'Cartão de crédito à vista';
export const METODO_CARTAO_2X = 'Cartão de crédito 2x sem juros';
/** Cartão de 3x a 12x: a taxa do Asaas (e a antecipação) é repassada ao
 *  cliente. O número de parcelas vai no próprio nome da forma de pagamento,
 *  porque é ele que define quanto o cliente paga. */
const PREFIXO_CARTAO_TAXA = 'Cartão de crédito ';
const SUFIXO_CARTAO_TAXA = 'x (taxa repassada)';

export const PARCELAS_CARTAO_TAXA = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export function metodoCartaoComTaxa(parcelas: number): string {
  return `${PREFIXO_CARTAO_TAXA}${parcelas}${SUFIXO_CARTAO_TAXA}`;
}

/** Número de parcelas de um método "cartão com taxa", ou null se não for um. */
export function parcelasDoCartaoComTaxa(metodo: string): number | null {
  if (!metodo.startsWith(PREFIXO_CARTAO_TAXA) || !metodo.endsWith(SUFIXO_CARTAO_TAXA)) return null;
  const n = Number(metodo.slice(PREFIXO_CARTAO_TAXA.length, -SUFIXO_CARTAO_TAXA.length));
  return (PARCELAS_CARTAO_TAXA as readonly number[]).includes(n) ? n : null;
}

/** As condições da tabela, na ordem em que aparecem para o dono. */
export type CondicaoDaTabela = '50-50' | 'cartao-sem-juros' | 'cartao-com-taxa';

export function condicaoDoMetodo(metodo: string): CondicaoDaTabela | null {
  if (metodo === METODO_50_50) return '50-50';
  if (metodo === METODO_CARTAO_1X || metodo === METODO_CARTAO_2X) return 'cartao-sem-juros';
  if (parcelasDoCartaoComTaxa(metodo) !== null) return 'cartao-com-taxa';
  return null;
}

/* ----------------------------------------------- taxa do cartão (Asaas) */

/** Taxas do Asaas por cobrança no cartão (tabela pública, out/2026) e a
 *  antecipação de 1,25% ao mês por parcela. São as mesmas da página de planos;
 *  se a conta tiver taxa negociada, troque aqui e lá. */
const TAXA_FIXA_CARTAO = 0.49;
const ANTECIPACAO_AO_MES = 0.0125;
function taxaDoCartao(parcelas: number): number {
  return parcelas === 1 ? 0.0299 : parcelas <= 6 ? 0.0349 : 0.0399;
}

/** Quanto o cliente paga no cartão em `parcelas` vezes para a Prog receber
 *  `valor` inteiro e antecipado. Divisão, não multiplicação: a taxa incide
 *  sobre o total cobrado. */
export function cartaoComTaxaRepassada(valor: number, parcelas: number): { parcela: number; total: number } {
  const desconto = taxaDoCartao(parcelas) + ANTECIPACAO_AO_MES * ((parcelas + 1) / 2);
  const parcela = Math.ceil(((valor + TAXA_FIXA_CARTAO) / (1 - desconto) / parcelas) * 100) / 100;
  return { parcela, total: Math.round(parcela * parcelas * 100) / 100 };
}

/* ------------------------------------------------------------ o carnê */

function arredondar(v: number): number {
  return Math.round(v * 100) / 100;
}

function parcela(number: number, amount: number, dueDate: string, notes = ''): Installment {
  return { number, amount: arredondar(amount), dueDate, status: 'Pendente', notes, paidAt: null };
}

/** O carnê de uma condição da tabela, ou null se o método não for da tabela.
 *
 *  - **50% + 50%:** entrada no dia do fechamento (início da prestação) e o
 *    restante na data de entrega prevista.
 *  - **Cartão à vista / 2x sem juros:** o Asaas paga cada parcela cerca de 30
 *    dias depois da cobrança, então os vencimentos caem 1 e 2 meses depois do
 *    fechamento.
 *  - **Cartão 3x a 12x:** a Prog antecipa e recebe o valor da tabela de uma vez,
 *    cerca de 2 dias úteis depois do fechamento; o cliente paga a taxa. */
export function carneDaCondicao(
  metodo: string,
  trabalho: number,
  inicio: string,
  entrega: string | null
): Installment[] | null {
  const condicao = condicaoDoMetodo(metodo);
  if (!condicao || !inicio || !(trabalho > 0)) return condicao ? [] : null;

  if (condicao === '50-50') {
    const entrada = arredondar(trabalho / 2);
    return [
      parcela(0, entrada, inicio, '50% no fechamento'),
      parcela(1, trabalho - entrada, entrega || inicio, '50% na entrega'),
    ];
  }

  if (condicao === 'cartao-sem-juros') {
    if (metodo === METODO_CARTAO_1X) {
      return [parcela(1, trabalho, somarMeses(inicio, 1), 'Cartão à vista, repasse do Asaas')];
    }
    const primeira = arredondar(trabalho / 2);
    return [
      parcela(1, primeira, somarMeses(inicio, 1), 'Cartão 1/2, repasse do Asaas'),
      parcela(2, trabalho - primeira, somarMeses(inicio, 2), 'Cartão 2/2, repasse do Asaas'),
    ];
  }

  const n = parcelasDoCartaoComTaxa(metodo) ?? 3;
  const cliente = cartaoComTaxaRepassada(trabalho, n);
  return [
    parcela(
      1,
      trabalho,
      calcularEntrega(inicio, 2) ?? inicio,
      `Cartão ${n}x antecipado: cliente paga ${n}x de R$ ${cliente.parcela.toFixed(2).replace('.', ',')}`
    ),
  ];
}

/** Rótulo de uma parcela no Financeiro e no acompanhamento do cliente. */
export function rotuloDaParcela(metodo: string, numero: number): string {
  const condicao = condicaoDoMetodo(metodo);
  if (condicao === '50-50') return numero === 0 ? '50% no fechamento' : '50% na entrega';
  if (condicao === 'cartao-sem-juros') return metodo === METODO_CARTAO_1X ? 'cartão à vista' : `cartão ${numero}/2`;
  if (condicao === 'cartao-com-taxa') return `cartão ${parcelasDoCartaoComTaxa(metodo)}x antecipado`;
  return numero === 0 ? 'entrada' : `parcela ${numero}`;
}

/** Os campos de condição gravados na prestação, derivados do carnê. São eles
 *  que a tela de Prestação compara para saber se o carnê precisa ser refeito. */
export function condicoesGravadas(carne: Installment[]) {
  const entrada = carne.find((p) => p.number === 0);
  const parcelas = carne.filter((p) => p.number > 0);
  return {
    installment_count: parcelas.length,
    down_payment: entrada ? entrada.amount : 0,
    interest_pct: 0,
    first_due_date: parcelas[0]?.dueDate ?? entrada?.dueDate ?? null,
  };
}
