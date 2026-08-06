'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';
import {
  totalizarItens,
  calcularEntrega,
  PLAN_MONTHS_OPTIONS,
  SERVICE_ORDER_STATUSES,
  SERVICE_PAYMENT_STATUSES,
  type ServiceOrderItem,
  type ServiceOrderStatus,
  type ServicePaymentStatus,
} from '@/lib/services';
import { sincronizarFinanceiroDaPrestacao, removerFinanceiroDaPrestacao } from '@/lib/data/service-orders';
import { DISCOUNT_TYPES, aplicarDesconto, type Desconto } from '@/lib/discount';
import { salvarParcelas, removerParcelas } from '@/lib/data/installments';
import { geraParcelas, gerarParcelas, MAX_JUROS_PCT } from '@/lib/installments';

export type ServiceOrderInput = {
  id?: string;
  customerId: string | null;
  title: string;
  notes: string;
  status: ServiceOrderStatus;
  paymentStatus: ServicePaymentStatus;
  paymentMethod: string;
  startDate: string;
  /** Duração do plano. Só vale quando há algum serviço mensal. */
  planMonths: number | null;
  /** Data da primeira mensalidade. Vazio cai na data de início. */
  planStartDate: string;
  /** Incide sobre o valor único, não sobre a mensalidade. */
  desconto: Desconto;
  /** Condições do PIX parcelado do trabalho. O plano mensal é independente. */
  installmentCount: number;
  downPayment: number;
  interestPct: number;
  firstDueDate: string;
  installmentNotes: string;
  items: ServiceOrderItem[];
};

async function adminClient() {
  const admin = await requireAdmin();
  if (!admin) return null;
  return createClient();
}

function revalidar() {
  revalidatePath('/admin/prestacao-servico');
  revalidatePath('/admin/financeiro');
}

export async function saveServiceOrderAction(input: ServiceOrderInput): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const title = input.title.trim();
  if (!title) return errResult('Informe o título da prestação.');
  if (!SERVICE_ORDER_STATUSES.includes(input.status)) return errResult('Status inválido.');
  if (!SERVICE_PAYMENT_STATUSES.includes(input.paymentStatus)) return errResult('Situação de pagamento inválida.');
  if (!input.startDate) return errResult('Informe a data de início.');

  const itens = input.items.filter((i) => i.name.trim());
  if (itens.length === 0) return errResult('Adicione ao menos um serviço à prestação.');
  if (itens.some((i) => !Number.isFinite(i.amount) || i.amount < 0)) {
    return errResult('Todos os valores precisam ser números iguais ou maiores que zero.');
  }

  // Totais e prazo são derivados dos itens e gravados: o histórico não pode
  // mudar se o preço do catálogo mudar depois.
  const { total, mensal, prazoDias, temPlano } = totalizarItens(itens);

  if (temPlano && !PLAN_MONTHS_OPTIONS.includes(input.planMonths as 6 | 12 | 24)) {
    return errResult('Escolha a duração do plano: 6, 12 ou 24 meses.');
  }
  if (!DISCOUNT_TYPES.includes(input.desconto.tipo)) return errResult('Tipo de desconto inválido.');
  if (!Number.isFinite(input.desconto.valor) || input.desconto.valor < 0) {
    return errResult('O desconto precisa ser um número igual ou maior que zero.');
  }
  if (input.desconto.tipo === 'percentual' && input.desconto.valor > 100) {
    return errResult('O desconto em porcentagem não pode passar de 100%.');
  }

  // O trabalho já com desconto é o que vai para o carnê — parcelar o preço
  // cheio cobraria do cliente um valor que ninguém combinou.
  const trabalho = aplicarDesconto(total, input.desconto);

  const parcelado = geraParcelas(input.paymentMethod);
  if (parcelado) {
    if (!input.firstDueDate) return errResult('Informe a data da primeira parcela.');
    if (!Number.isInteger(input.installmentCount) || input.installmentCount < 1) {
      return errResult('Informe a quantidade de parcelas.');
    }
    if (!Number.isFinite(input.interestPct) || input.interestPct < 0 || input.interestPct > MAX_JUROS_PCT) {
      return errResult(`A taxa de juros precisa ficar entre 0% e ${MAX_JUROS_PCT}%.`);
    }
    if (input.downPayment > trabalho) {
      return errResult('A entrada não pode ser maior que o valor dos serviços.');
    }
  }

  const payload = {
    customer_id: input.customerId,
    title,
    notes: input.notes.trim(),
    status: input.status,
    payment_status: input.paymentStatus,
    payment_method: input.paymentMethod.trim(),
    total_amount: total,
    monthly_amount: mensal,
    discount_type: input.desconto.tipo,
    discount_value: input.desconto.valor,
    discount_note: input.desconto.descricao.trim(),
    installment_count: parcelado ? input.installmentCount : 0,
    down_payment: parcelado ? input.downPayment : 0,
    interest_pct: parcelado ? input.interestPct : 0,
    first_due_date: parcelado ? input.firstDueDate : null,
    installment_notes: parcelado ? input.installmentNotes.trim() : '',
    // Sem serviço mensal não há plano. Zerar aqui evita que uma duração
    // esquecida de uma edição anterior continue gerando parcelas de nada.
    plan_months: temPlano ? input.planMonths : null,
    plan_start_date: temPlano ? input.planStartDate || input.startDate : null,
    lead_time_days: prazoDias,
    start_date: input.startDate,
    due_date: calcularEntrega(input.startDate, prazoDias),
    updated_at: new Date().toISOString(),
  };

  let orderId = input.id;

  // Condições de antes, para decidir se o carnê precisa ser refeito. Lido agora
  // porque o update abaixo já apaga esse estado.
  const { data: anterior } = orderId
    ? await supabase
        .from('service_orders')
        .select(
          'total_amount, discount_type, discount_value, installment_count, down_payment, interest_pct, first_due_date'
        )
        .eq('id', orderId)
        .maybeSingle()
    : { data: null };

  if (orderId) {
    const { error } = await supabase.from('service_orders').update(payload).eq('id', orderId);
    if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar a prestação.'));
    // Substitui os itens em bloco: casar linha a linha exigiria rastrear quais
    // foram removidas na tela, e o ganho não paga a complexidade neste volume.
    await supabase.from('service_order_items').delete().eq('order_id', orderId);
  } else {
    const { data, error } = await supabase.from('service_orders').insert(payload).select('id').single();
    if (error || !data) return errResult(friendlyDbError(error, 'Não foi possível criar a prestação.'));
    orderId = data.id;
  }

  const { error: erroItens } = await supabase.from('service_order_items').insert(
    itens.map((i, indice) => ({
      order_id: orderId,
      internal_service_id: i.internalServiceId,
      name: i.name.trim(),
      description: i.description.trim(),
      amount: i.amount,
      billing_type: i.billingType,
      lead_time_days: i.billingType === 'mensal' ? 0 : Number.isFinite(i.leadTimeDays) ? i.leadTimeDays : 0,
      position: indice,
    }))
  );
  if (erroItens) return errResult(friendlyDbError(erroItens, 'A prestação foi salva, mas os serviços não.'));

  // Só refaz o carnê quando o valor ou as condições mudaram: o dono ajusta
  // parcelas uma a uma pela página do cliente, e regerar a cada salvamento
  // desfaria esse trabalho em silêncio.
  if (parcelado) {
    const trabalhoAnterior = anterior
      ? aplicarDesconto(Number(anterior.total_amount), {
          tipo: anterior.discount_type as Desconto['tipo'],
          valor: Number(anterior.discount_value),
          descricao: '',
        })
      : null;

    const condicoesIguais =
      !!anterior &&
      trabalhoAnterior === trabalho &&
      anterior.installment_count === input.installmentCount &&
      Number(anterior.down_payment) === input.downPayment &&
      Number(anterior.interest_pct) === input.interestPct &&
      (anterior.first_due_date ?? '') === input.firstDueDate;

    if (!condicoesIguais) {
      await salvarParcelas(
        'servico',
        orderId,
        gerarParcelas({
          total: trabalho,
          parcelas: input.installmentCount,
          entrada: input.downPayment,
          jurosPct: input.interestPct,
          primeiroVencimento: input.firstDueDate,
        })
      );
    }
  } else {
    await removerParcelas('servico', orderId);
  }

  await sincronizarFinanceiroDaPrestacao(orderId);

  revalidar();
  return okResult(input.id ? 'Prestação atualizada.' : 'Prestação criada.');
}

export async function deleteServiceOrderAction(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  // Guarda a origem antes de apagar: depois do delete o vínculo some e não há
  // como saber de qual orçamento esta prestação veio.
  const { data: prestacao } = await supabase
    .from('service_orders')
    .select('quote_id')
    .eq('id', id)
    .maybeSingle();

  // O lançamento sai primeiro: a tela do Financeiro recusa excluir linha de
  // origem 'servico', então apagar a prestação antes deixaria a receita órfã
  // e impossível de remover pela interface.
  await removerFinanceiroDaPrestacao(id);
  await removerParcelas('servico', id);

  const { error } = await supabase.from('service_orders').delete().eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível excluir a prestação.'));

  // Devolve o orçamento para 'Aprovado'. Sem isto ele fica preso em
  // 'Convertido em Prestação' sem prestação nenhuma: não pode ser editado (a
  // action bloqueia convertidos) nem reconvertido (só 'Aprovado' converte) —
  // um beco sem saída, e exatamente o oposto do que a mensagem de exclusão do
  // orçamento promete ao mandar apagar a prestação primeiro.
  if (prestacao?.quote_id) {
    await supabase
      .from('service_quotes')
      .update({ status: 'Aprovado', updated_at: new Date().toISOString() })
      .eq('id', prestacao.quote_id);
    revalidatePath('/admin/orcamentos-servicos');
  }

  revalidar();
  return okResult(
    prestacao?.quote_id
      ? 'Prestação excluída. O orçamento de origem voltou para Aprovado e pode ser convertido de novo.'
      : 'Prestação excluída.'
  );
}
