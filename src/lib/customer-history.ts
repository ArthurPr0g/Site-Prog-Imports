// Histórico e adimplência do cliente. Puro, sem dependência de servidor.

import { statusExibido, type Installment } from '@/lib/installments';

export const ADIMPLENCIA = ['Adimplente', 'Possui parcelas pendentes', 'Inadimplente'] as const;
export type Adimplencia = (typeof ADIMPLENCIA)[number];

/** Situação do cliente, derivada das parcelas em aberto.
 *
 *  Derivada e não gravada: um campo no cadastro envelheceria em silêncio — a
 *  parcela vence sozinha, ninguém vai lá marcar. Aqui a resposta é sempre a de
 *  hoje.
 *
 *  Ordem de prioridade: uma parcela atrasada torna o cliente inadimplente mesmo
 *  que todas as outras estejam em dia; é o pior caso que define a situação. */
export function calcularAdimplencia(parcelas: Installment[], hojeISO: string): Adimplencia {
  let temPendente = false;

  for (const p of parcelas) {
    const s = statusExibido(p, hojeISO);
    if (s === 'Atrasada') return 'Inadimplente';
    if (s === 'Pendente') temPendente = true;
  }

  return temPendente ? 'Possui parcelas pendentes' : 'Adimplente';
}

export type CompraDoCliente = {
  id: string;
  orderNumber: number;
  /** Como a venda se chama: o apelido do dono ou o nome derivado dos itens. */
  nome: string;
  /** Só quando o dono apelidou a venda — aí os itens viram subtítulo. */
  apelidada: boolean;
  data: string;
  itens: string;
  origem: string;
  status: string;
  total: number;
  /** Parcelas desta compra, quando parcelada. */
  parcelas: Installment[];
};

export type ServicoDoCliente = {
  id: string;
  titulo: string;
  status: string;
  pagamento: string;
  inicio: string;
  entrega: string | null;
  total: number;
  mensal: number;
  planoMeses: number | null;
  parcelas: Installment[];
};

/** Uma mensalidade do plano de hospedagem.
 *
 *  Ela não vive em `payment_installments`: o plano é gerado direto no
 *  Financeiro, uma linha por mês, e é lá que o dono dá baixa. Mas para o
 *  cliente ela é dívida igual às outras — e ficava fora do "em aberto", do
 *  "atrasado" e da adimplência, que é como um contrato de 12 × R$ 149 não
 *  aparecia como nada devido. */
export type MensalidadeDoCliente = {
  /** Id do lançamento no Financeiro — é ele que se dá baixa. */
  id: string;
  servico: string;
  numero: number;
  totalDeMeses: number;
  valor: number;
  vencimento: string;
  paga: boolean;
};

/** A mensalidade vista como parcela, para as contas que perguntam "o que o
 *  cliente deve". Converter aqui, num lugar só, é o que faz o carnê, o resumo e
 *  a adimplência enxergarem a mesma dívida sem duplicar regra. */
export function mensalidadeComoParcela(m: MensalidadeDoCliente): Installment {
  return {
    id: m.id,
    number: m.numero,
    amount: m.valor,
    dueDate: m.vencimento,
    status: m.paga ? 'Recebida' : 'Pendente',
    notes: '',
    // A baixa da mensalidade é só uma troca de status no Financeiro; não há
    // registro de em que dia entrou. O vencimento é o melhor que se tem.
    paidAt: m.paga ? m.vencimento : null,
  };
}

export type OrcamentoDoCliente = {
  id: string;
  tipo: 'Loja' | 'Serviços';
  titulo: string;
  status: string;
  criadoEm: string;
  valor: number;
};

export type ItemEmTransporte = {
  id: string;
  nome: string;
  status: string;
  entrada: string | null;
};

export type HistoricoDoCliente = {
  compras: CompraDoCliente[];
  servicos: ServicoDoCliente[];
  orcamentos: OrcamentoDoCliente[];
  emTransporte: ItemEmTransporte[];
  /** Mensalidades dos planos de hospedagem, vindas do Financeiro. */
  mensalidades: MensalidadeDoCliente[];
};

export type ResumoFinanceiroDoCliente = {
  /** Soma das compras e serviços não cancelados. */
  totalComprado: number;
  /** O que já entrou: parcelas recebidas mais o que foi pago à vista. */
  totalPago: number;
  /** O que falta receber. */
  emAberto: number;
  atrasado: number;
  qtdParcelas: number;
  qtdPagas: number;
  qtdPendentes: number;
  qtdAtrasadas: number;
  adimplencia: Adimplencia;
  /** Todas as parcelas do cliente, de compras e serviços. */
  parcelas: Installment[];
};

function arredondar(v: number): number {
  return Math.round((Number.isFinite(v) ? v : 0) * 100) / 100;
}

/** Uma parcela com o registro de onde ela veio.
 *
 *  A lista consolidada do cliente mistura carnês de vendas e de serviços, e uma
 *  parcela solta não diz de onde saiu — nem quantas irmãs ela tem, que é o que
 *  faz o rótulo "3/6" existir. */
export type ParcelaComOrigem = {
  parcela: Installment;
  origem: string;
  totalDoGrupo: number;
};

/** Todas as parcelas do cliente em ordem de vencimento, cada uma sabendo sua
 *  origem. Em ordem de vencimento porque a pergunta que essa lista responde é
 *  "o que vence a seguir", não "de qual venda veio". */
export function parcelasComOrigem(historico: HistoricoDoCliente): ParcelaComOrigem[] {
  const linhas: ParcelaComOrigem[] = [];

  const acrescentar = (parcelas: Installment[], origem: string) => {
    const totalDoGrupo = parcelas.filter((p) => p.number > 0).length;
    for (const parcela of parcelas) linhas.push({ parcela, origem, totalDoGrupo });
  };

  for (const c of historico.compras) {
    if (c.status === 'Cancelado') continue;
    acrescentar(c.parcelas, c.nome ? `#${c.orderNumber} · ${c.nome}` : `Venda #${c.orderNumber}`);
  }
  for (const s of historico.servicos) {
    if (s.status === 'Cancelada') continue;
    acrescentar(s.parcelas, s.titulo);
  }

  return linhas.sort((a, b) => a.parcela.dueDate.localeCompare(b.parcela.dueDate));
}

/** Consolida o financeiro do cliente.
 *
 *  Compras e serviços parcelados contam pelas parcelas; os não parcelados,
 *  pelo status do próprio registro. Misturar os dois critérios seria contar
 *  duas vezes o mesmo dinheiro.
 *
 *  Cancelados ficam fora de tudo: não são compra, não são dívida. */
export function resumirFinanceiroDoCliente(
  historico: HistoricoDoCliente,
  hojeISO: string
): ResumoFinanceiroDoCliente {
  const parcelas: Installment[] = [];
  let totalComprado = 0;
  let totalPago = 0;

  for (const c of historico.compras) {
    if (c.status === 'Cancelado') continue;
    totalComprado += c.total;

    if (c.parcelas.length > 0) {
      parcelas.push(...c.parcelas);
    } else if (['Pago', 'Enviado', 'Entregue'].includes(c.status)) {
      // Venda à vista já quitada: entra como paga sem passar por parcela.
      totalPago += c.total;
    }
  }

  for (const s of historico.servicos) {
    if (s.status === 'Cancelada') continue;
    const valorContrato = s.total + s.mensal * (s.planoMeses ?? 0);
    totalComprado += valorContrato;

    if (s.parcelas.length > 0) {
      parcelas.push(...s.parcelas);
    } else if (s.pagamento === 'Recebido') {
      totalPago += s.total;
    }
  }

  // As mensalidades do plano entram como parcelas daqui para baixo. Elas são
  // cobradas mês a mês e baixadas no Financeiro, mas para o cliente são dívida
  // igual — deixá-las de fora fazia um contrato de 12 × R$ 149 não aparecer
  // como nada devido, nem contar na adimplência.
  parcelas.push(...historico.mensalidades.map(mensalidadeComoParcela));

  let emAberto = 0;
  let atrasado = 0;
  let qtdPagas = 0;
  let qtdPendentes = 0;
  let qtdAtrasadas = 0;

  for (const p of parcelas) {
    const s = statusExibido(p, hojeISO);
    if (s === 'Recebida') {
      totalPago += p.amount;
      qtdPagas++;
    } else if (s === 'Cancelada') {
      continue;
    } else {
      emAberto += p.amount;
      if (s === 'Atrasada') {
        atrasado += p.amount;
        qtdAtrasadas++;
      } else {
        qtdPendentes++;
      }
    }
  }

  return {
    totalComprado: arredondar(totalComprado),
    totalPago: arredondar(totalPago),
    emAberto: arredondar(emAberto),
    atrasado: arredondar(atrasado),
    qtdParcelas: parcelas.filter((p) => p.status !== 'Cancelada').length,
    qtdPagas,
    qtdPendentes,
    qtdAtrasadas,
    adimplencia: calcularAdimplencia(parcelas, hojeISO),
    parcelas,
  };
}

/** Cor semântica do selo. Verde só quando não há nada em aberto. */
export function corDaAdimplencia(a: Adimplencia): string {
  if (a === 'Inadimplente') return '#e05555';
  if (a === 'Possui parcelas pendentes') return '#d9a441';
  return '#4ade80';
}
