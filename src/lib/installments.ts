// Parcelamento via PIX. Puro, sem dependência de servidor: a tela recalcula a
// cada tecla e a action grava com as mesmas funções.

import { somarMeses } from '@/lib/services';

export const PAYMENT_METHODS = [
  'PIX',
  'PIX Parcelado',
  'Cartão de Crédito',
  'Débito',
  'Transferência',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Só o PIX Parcelado gera parcelas. No cartão a operadora repassa o valor
 *  cheio, então para o caixa da Prog é uma entrada só — o parcelamento é
 *  problema do cliente com o banco dele. */
export function geraParcelas(metodo: string): boolean {
  return metodo === 'PIX Parcelado';
}

export const MAX_JUROS_PCT = 20;

/** Deslocamento das parcelas de PIX dentro de `finance_entries.installment_number`.
 *
 *  Uma prestação pode ter as duas coisas ao mesmo tempo: as mensalidades do
 *  plano (1..N) e o trabalho parcelado no PIX. Sem separar a faixa, a parcela 1
 *  do PIX e a mensalidade 1 colidiriam na hora de casar alvo com existente, e
 *  uma sobrescreveria a outra. */
export const OFFSET_PARCELA_PIX = 1000;

/** Status gravado. 'Atrasada' fica de fora de propósito: é derivado da data,
 *  não um estado que alguém marca. Gravá-lo exigiria uma rotina diária, e
 *  qualquer falha dela deixaria o painel mentindo. */
export const INSTALLMENT_STATUSES = ['Pendente', 'Recebida', 'Cancelada'] as const;
export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number];

/** O que a tela mostra, já com o atraso calculado. */
export type InstallmentStatusExibido = InstallmentStatus | 'Atrasada';

export type Installment = {
  id?: string;
  /** 0 é a entrada. */
  number: number;
  amount: number;
  dueDate: string;
  status: InstallmentStatus;
  notes: string;
};

export type CondicoesParcelamento = {
  /** Valor total a parcelar, antes da entrada. */
  total: number;
  parcelas: number;
  entrada: number;
  jurosPct: number;
  primeiroVencimento: string;
};

export type ResumoParcelamento = {
  /** Total menos a entrada. É sobre isto que o juros incide. */
  financiado: number;
  juros: number;
  /** Total + juros: o que o cliente desembolsa no fim. */
  totalComJuros: number;
  valorParcela: number;
  /** A última pode diferir em centavos do valor cheio. */
  valorUltimaParcela: number;
  entrada: number;
};

function arredondar(v: number): number {
  return Math.round((Number.isFinite(v) ? v : 0) * 100) / 100;
}

function limitar(v: number, min: number, max: number): number {
  return Math.min(Math.max(Number.isFinite(v) ? v : min, min), max);
}

/** Resumo do parcelamento, com juros SIMPLES sobre o valor financiado.
 *
 *  Simples e não composto por decisão de simplicidade: é o que se combina num
 *  parcelamento informal por PIX, e é o único que o cliente consegue conferir
 *  de cabeça — 10% de R$ 1.000 é R$ 100, e o total é R$ 1.100.
 *
 *  A entrada sai da base: quem paga R$ 500 na hora não deve juros sobre eles. */
export function calcularParcelamento(c: CondicoesParcelamento): ResumoParcelamento {
  const total = arredondar(c.total);
  const entrada = limitar(arredondar(c.entrada), 0, total);
  const financiado = arredondar(total - entrada);

  const taxa = limitar(c.jurosPct, 0, MAX_JUROS_PCT);
  const juros = arredondar(financiado * (taxa / 100));

  const aParcelar = arredondar(financiado + juros);
  const n = Math.max(1, Math.floor(c.parcelas) || 1);

  // Trunca ao centavo e joga a sobra na última: assim N parcelas somam
  // exatamente o valor devido. Arredondar todas para cima faria o cliente pagar
  // centavos a mais, e para baixo faria a Prog receber menos.
  const parcelaBase = Math.floor((aParcelar * 100) / n) / 100;
  const ultima = arredondar(aParcelar - parcelaBase * (n - 1));

  return {
    financiado,
    juros,
    totalComJuros: arredondar(total + juros),
    valorParcela: parcelaBase,
    valorUltimaParcela: ultima,
    entrada,
  };
}

/** Gera as parcelas a partir das condições.
 *
 *  A entrada, quando existe, vira a parcela 0 vencendo na data da primeira —
 *  ela também precisa de status próprio, porque combinar entrada não é o mesmo
 *  que tê-la recebido.
 *
 *  Data retroativa funciona sem tratamento especial: o que for informado é o
 *  vencimento da primeira parcela, e as demais caem no mesmo dia dos meses
 *  seguintes. Uma venda lançada hoje com primeira parcela em março já nasce com
 *  as vencidas marcadas como atrasadas na tela. */
export function gerarParcelas(c: CondicoesParcelamento): Installment[] {
  const resumo = calcularParcelamento(c);
  if (!c.primeiroVencimento) return [];

  const n = Math.max(1, Math.floor(c.parcelas) || 1);
  const lista: Installment[] = [];

  if (resumo.entrada > 0) {
    lista.push({
      number: 0,
      amount: resumo.entrada,
      dueDate: c.primeiroVencimento,
      status: 'Pendente',
      notes: '',
    });
  }

  for (let i = 0; i < n; i++) {
    lista.push({
      number: i + 1,
      amount: i === n - 1 ? resumo.valorUltimaParcela : resumo.valorParcela,
      dueDate: somarMeses(c.primeiroVencimento, i),
      status: 'Pendente',
      notes: '',
    });
  }

  return lista;
}

/** Status para exibição: uma parcela pendente com vencimento passado está
 *  atrasada, sem que ninguém precise marcar. */
export function statusExibido(p: Installment, hojeISO: string): InstallmentStatusExibido {
  if (p.status === 'Pendente' && p.dueDate < hojeISO) return 'Atrasada';
  return p.status;
}

export function rotuloDaParcela(p: Installment, totalParcelas: number): string {
  return p.number === 0 ? 'Entrada' : `${p.number}/${totalParcelas}`;
}

export type ResumoDasParcelas = {
  recebido: number;
  aReceber: number;
  atrasado: number;
  cancelado: number;
  qtdAtrasadas: number;
  /** Próxima a vencer entre as pendentes. */
  proximoVencimento: string | null;
};

/** Situação do carnê. Canceladas ficam fora de "a receber": não são dinheiro
 *  esperado, e somá-las inflaria a previsão. */
export function resumirParcelas(parcelas: Installment[], hojeISO: string): ResumoDasParcelas {
  let recebido = 0;
  let aReceber = 0;
  let atrasado = 0;
  let cancelado = 0;
  let qtdAtrasadas = 0;
  let proximo: string | null = null;

  for (const p of parcelas) {
    const s = statusExibido(p, hojeISO);
    if (s === 'Recebida') recebido += p.amount;
    else if (s === 'Cancelada') cancelado += p.amount;
    else {
      aReceber += p.amount;
      if (s === 'Atrasada') {
        atrasado += p.amount;
        qtdAtrasadas++;
      } else if (!proximo || p.dueDate < proximo) {
        proximo = p.dueDate;
      }
    }
  }

  return {
    recebido: arredondar(recebido),
    aReceber: arredondar(aReceber),
    atrasado: arredondar(atrasado),
    cancelado: arredondar(cancelado),
    qtdAtrasadas,
    proximoVencimento: proximo,
  };
}
