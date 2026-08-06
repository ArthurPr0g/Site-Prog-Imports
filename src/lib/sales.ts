// Regras de Vendas (M4). Puro, sem dependência de servidor.

import type { Installment } from '@/lib/installments';
import type { EnderecoDaVenda, ClienteDaVenda } from '@/lib/shipping-label';

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
  /** Apelido dado pelo dono. Vazio significa "derive dos itens". */
  name: string;
  /** Conta do site (`profiles`), quando a venda veio do checkout. */
  customerId: string | null;
  /** Cliente do ERP (`customers`). É por ele que a venda entra no histórico. */
  erpCustomerId: string | null;
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
  /** Condições do PIX parcelado. `installmentCount` 0 significa à vista. */
  installmentCount: number;
  downPayment: number;
  interestPct: number;
  firstDueDate: string | null;
  installmentNotes: string;
  /** O carnê. Vazio quando a venda não é parcelada. */
  installments: Installment[];
  /** Endereço escolhido no checkout, congelado na hora da compra. Null nas
   *  vendas lançadas à mão — nelas o endereço vem do cadastro do cliente. */
  shippingAddress: EnderecoDaVenda | null;
  /** Cadastro do cliente do ERP. É de onde saem documento, telefone e o
   *  endereço das vendas manuais na etiqueta de transporte. */
  customer: ClienteDaVenda | null;
};

function arredondar(v: number): number {
  return Math.round((Number.isFinite(v) ? v : 0) * 100) / 100;
}

type VendaComNome = {
  name?: string;
  items: { productName: string; qty: number }[];
};

/** Como a venda se chama nas telas.
 *
 *  Ordem: o apelido que o dono deu; senão os produtos; senão nada — e aí quem
 *  chama cai no número. Derivar dos itens é o que faz a maioria das vendas ter
 *  nome útil sem ninguém digitar nada.
 *
 *  Com vários itens mostra o primeiro e conta o resto: a lista inteira estoura
 *  qualquer coluna, e o primeiro item já é o que o dono lembra da venda. */
export function nomeDaVenda(v: VendaComNome): string {
  const apelido = (v.name ?? '').trim();
  if (apelido) return apelido;

  const itens = v.items.filter((i) => i.productName.trim());
  if (itens.length === 0) return '';

  const primeiro = itens[0].qty > 1 ? `${itens[0].qty}× ${itens[0].productName}` : itens[0].productName;
  return itens.length === 1 ? primeiro : `${primeiro} +${itens.length - 1}`;
}

/** Nome com o número junto, para listas e para o Financeiro: o número continua
 *  sendo a identidade da venda, o nome é o que a torna reconhecível. */
export function etiquetaDaVenda(v: VendaComNome & { orderNumber: number }): string {
  const nome = nomeDaVenda(v);
  return nome ? `#${v.orderNumber} · ${nome}` : `Venda #${v.orderNumber}`;
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
  /** Já pronto: `descricaoDaVenda` decide entre apelido, itens e número. */
  descricao?: string;
  status: SaleStatus;
  total: number;
  costTotal: number;
  createdAt: string;
}): LancamentoDaVenda[] {
  if (venda.status === 'Cancelado') return [];

  const status = vendaFoiPaga(venda.status) ? 'Pago' : 'Previsto';
  const data = venda.createdAt.slice(0, 10);
  const rotulo = venda.descricao || `Venda #${venda.orderNumber}`;
  const alvos: LancamentoDaVenda[] = [];

  if (venda.total > 0) {
    alvos.push({
      kind: 'receita',
      amount: arredondar(venda.total),
      status,
      description: rotulo,
      entryDate: data,
    });
  }

  if (venda.costTotal > 0) {
    alvos.push({
      kind: 'despesa',
      amount: arredondar(venda.costTotal),
      status,
      description: `Custo da ${rotulo.replace(/^Venda /, 'venda ')}`,
      entryDate: data,
    });
  }

  return alvos;
}

/** Descrição da venda no Financeiro: número sempre, nome quando houver.
 *
 *  O número fica na frente porque é o que liga a linha do caixa à venda; o nome
 *  vem depois para o extrato ser legível sem abrir a venda. Cortado porque a
 *  coluna do Financeiro é estreita e um nome longo empurraria o valor para fora. */
export function descricaoDaVenda(v: VendaComNome & { orderNumber: number }): string {
  const nome = nomeDaVenda(v);
  if (!nome) return `Venda #${v.orderNumber}`;
  const curto = nome.length > 46 ? `${nome.slice(0, 45)}…` : nome;
  return `Venda #${v.orderNumber} — ${curto}`;
}

export type SaleIndicators = {
  vendas: number;
  faturamento: number;
  custo: number;
  lucro: number;
  margemPct: number;
  aguardandoPagamento: number;
  /** Vendas sem custo preenchido. Enquanto houver alguma, o lucro acima está
   *  superestimado — a venda inteira entra como ganho. */
  semCusto: number;
};

/** Canceladas ficam de fora de toda soma: não são faturamento nem custo.
 *  Continuam na lista, para o histórico não sumir.
 *
 *  `semCusto` existe porque o lucro agregado engana em silêncio: uma venda do
 *  site sem custo lançado conta como lucro integral, e a margem sobe para perto
 *  de 100% sem nada na tela indicando que o número não é confiável. */
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
    semCusto: vivas.filter((v) => v.total > 0 && v.costTotal === 0).length,
  };
}
