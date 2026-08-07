'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';
import {
  totalizarItens,
  calcularEntrega,
  podeConverterEmPrestacao,
  PLAN_MONTHS_OPTIONS,
  SERVICE_QUOTE_STATUSES,
  type ServiceOrderItem,
  type ServiceQuoteStatus,
} from '@/lib/services';
import { sincronizarFinanceiroDaPrestacao } from '@/lib/data/service-orders';
import { salvarParcelas } from '@/lib/data/installments';
import { geraParcelas, gerarParcelas, MAX_JUROS_PCT } from '@/lib/installments';
import { DISCOUNT_TYPES, aplicarDesconto, type Desconto } from '@/lib/discount';

export type ServiceQuoteInput = {
  id?: string;
  customerId: string | null;
  title: string;
  notes: string;
  status: ServiceQuoteStatus;
  /** Duração proposta do plano. Só vale quando há serviço mensal. */
  planMonths: number | null;
  /** Anexa o contrato ao PDF da proposta. */
  includeContract: boolean;
  /** Cliente já tem domínio: muda a Cláusula 2 do contrato. */
  clientHasDomain: boolean;
  /** Incide sobre o valor único, não sobre a mensalidade. */
  desconto: Desconto;
  items: ServiceOrderItem[];
};

/** O que só é perguntado na aprovação, nunca no orçamento (decisão do dono). */
export type ConversaoInput = {
  quoteId: string;
  paymentMethod: string;
  startDate: string;
  /** Primeira mensalidade. Vazio cai na data de início da execução. */
  planStartDate: string;
  /** Condições do PIX parcelado, iguais às de Vendas e Prestação. Ignoradas
   *  nas outras formas de pagamento. */
  installmentCount: number;
  downPayment: number;
  interestPct: number;
  firstDueDate: string;
  installmentNotes: string;
};

async function adminClient() {
  const admin = await requireAdmin();
  if (!admin) return null;
  return createClient();
}

function revalidar() {
  revalidatePath('/admin/orcamentos-servicos');
  revalidatePath('/admin/prestacao-servico');
  revalidatePath('/admin/financeiro');
}

export async function saveServiceQuoteAction(input: ServiceQuoteInput): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const title = input.title.trim();
  if (!title) return errResult('Informe o título do orçamento.');
  if (!SERVICE_QUOTE_STATUSES.includes(input.status)) return errResult('Status inválido.');

  const itens = input.items.filter((i) => i.name.trim());
  if (itens.length === 0) return errResult('Adicione ao menos um serviço ao orçamento.');
  if (itens.some((i) => !Number.isFinite(i.amount) || i.amount < 0)) {
    return errResult('Todos os valores precisam ser números iguais ou maiores que zero.');
  }

  // Orçamento já convertido é histórico: mexer nele faria a proposta divergir
  // da prestação que dela nasceu, e o cliente tem a versão antiga em mãos.
  if (input.id) {
    const { data: atual } = await supabase
      .from('service_quotes')
      .select('status')
      .eq('id', input.id)
      .maybeSingle();

    if (atual?.status === 'Convertido em Prestação') {
      return errResult(
        'Este orçamento já virou prestação e não pode mais ser alterado. Ajuste a prestação em vez dele.'
      );
    }
  }

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

  const payload = {
    customer_id: input.customerId,
    title,
    notes: input.notes.trim(),
    status: input.status,
    total_amount: total,
    monthly_amount: mensal,
    plan_months: temPlano ? input.planMonths : null,
    lead_time_days: prazoDias,
    include_contract: input.includeContract,
    // Só faz sentido com o contrato anexado — é ele que tem a Cláusula 2.
    client_has_domain: input.includeContract && input.clientHasDomain,
    discount_type: input.desconto.tipo,
    discount_value: input.desconto.valor,
    discount_note: input.desconto.descricao.trim(),
    updated_at: new Date().toISOString(),
  };

  let quoteId = input.id;

  if (quoteId) {
    const { error } = await supabase.from('service_quotes').update(payload).eq('id', quoteId);
    if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar o orçamento.'));
    await supabase.from('service_quote_items').delete().eq('quote_id', quoteId);
  } else {
    const { data, error } = await supabase.from('service_quotes').insert(payload).select('id').single();
    if (error || !data) return errResult(friendlyDbError(error, 'Não foi possível criar o orçamento.'));
    quoteId = data.id;
  }

  const { error: erroItens } = await supabase.from('service_quote_items').insert(
    itens.map((i, indice) => ({
      quote_id: quoteId,
      internal_service_id: i.internalServiceId,
      name: i.name.trim(),
      description: i.description.trim(),
      amount: i.amount,
      billing_type: i.billingType,
      lead_time_days: i.billingType === 'mensal' ? 0 : Number.isFinite(i.leadTimeDays) ? i.leadTimeDays : 0,
      position: indice,
    }))
  );
  if (erroItens) return errResult(friendlyDbError(erroItens, 'O orçamento foi salvo, mas os serviços não.'));

  revalidar();
  return okResult(input.id ? 'Orçamento atualizado.' : 'Orçamento criado.');
}

export async function deleteServiceQuoteAction(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  // Prestação já criada aponta para este orçamento. Apagar aqui deixaria o
  // trabalho em execução sem rastro do que foi acordado e por quanto.
  const { data: vinculada } = await supabase
    .from('service_orders')
    .select('id')
    .eq('quote_id', id)
    .limit(1)
    .maybeSingle();

  if (vinculada) {
    return errResult(
      'Este orçamento já virou prestação. Exclua a prestação primeiro — isso reabre o orçamento para nova conversão.'
    );
  }

  const { error } = await supabase.from('service_quotes').delete().eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível excluir o orçamento.'));

  revalidar();
  return okResult('Orçamento excluído.');
}

/** Converte o orçamento aprovado numa Prestação de Serviço.
 *
 *  Espelha `sendQuoteToStockAction` da loja. Os itens são COPIADOS, não
 *  movidos: o orçamento continua sendo o registro do que foi proposto, e a
 *  prestação passa a ser o do que está sendo executado. Editar uma não mexe na
 *  outra, que é o que permite comparar prometido com entregue.
 *
 *  Quem lança no Financeiro é a prestação, nunca o orçamento — é assim que a
 *  contagem dupla fica impedida por construção. */
export async function convertServiceQuoteAction(input: ConversaoInput): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  if (!input.startDate) return errResult('Informe a data de início da execução.');

  const { data: q } = await supabase
    .from('service_quotes')
    .select('*, service_quote_items(*)')
    .eq('id', input.quoteId)
    .single();

  if (!q) return errResult('Não foi possível ler o orçamento.');

  // As mesmas validações de Vendas e Prestação: a conta é a mesma, e uma tela
  // que aceita o que a outra recusa gera carnê impossível de conferir.
  const parcelado = geraParcelas(input.paymentMethod);
  if (parcelado) {
    if (!input.firstDueDate) return errResult('Informe a data da primeira parcela.');
    if (!Number.isInteger(input.installmentCount) || input.installmentCount < 1) {
      return errResult('Informe a quantidade de parcelas.');
    }
    if (!Number.isFinite(input.interestPct) || input.interestPct < 0 || input.interestPct > MAX_JUROS_PCT) {
      return errResult(`A taxa de juros precisa ficar entre 0% e ${MAX_JUROS_PCT}%.`);
    }
  }

  if (q.status === 'Convertido em Prestação') {
    return errResult('Este orçamento já foi convertido em prestação.');
  }
  if (!podeConverterEmPrestacao(q.status as ServiceQuoteStatus)) {
    return errResult('Só orçamento aprovado vira prestação. Marque como Aprovado antes de converter.');
  }

  const itens = (q.service_quote_items ?? []) as {
    internal_service_id: string | null;
    name: string;
    description: string;
    amount: number;
    billing_type: string;
    lead_time_days: number;
    position: number;
  }[];

  if (itens.length === 0) return errResult('Este orçamento não tem serviços para converter.');

  // Serviço mensal não tem entrega: somar o prazo dele empurraria a data de
  // conclusão do trabalho real para meses à frente.
  const prazoDias = itens
    .filter((i) => i.billing_type !== 'mensal')
    .reduce((s, i) => s + i.lead_time_days, 0);

  const temPlano = Number(q.monthly_amount) > 0 && (q.plan_months ?? 0) > 0;

  // O carnê cobre o TRABALHO já com desconto — nunca a mensalidade, que tem
  // ciclo próprio e vira parcela por conta dela. Mesma regra da tela de
  // Prestação.
  const trabalho = aplicarDesconto(Number(q.total_amount), {
    tipo: q.discount_type as Desconto['tipo'],
    valor: Number(q.discount_value),
    descricao: '',
  });

  if (parcelado && input.downPayment > trabalho) {
    return errResult('A entrada não pode ser maior que o valor dos serviços.');
  }

  const { data: order, error: erroOrder } = await supabase
    .from('service_orders')
    .insert({
      customer_id: q.customer_id,
      quote_id: q.id,
      title: q.title,
      notes: q.notes,
      status: 'Em andamento',
      // Nasce como Previsto: aprovar é acordo, não recebimento. O dono marca
      // Recebido na prestação quando o dinheiro entra.
      payment_status: 'Previsto',
      payment_method: input.paymentMethod.trim(),
      total_amount: q.total_amount,
      monthly_amount: q.monthly_amount,
      // O desconto vem junto: sem ele a prestação passaria a valer o preço
      // cheio e o Financeiro esperaria mais do que foi combinado.
      discount_type: q.discount_type,
      discount_value: q.discount_value,
      discount_note: q.discount_note,
      plan_months: temPlano ? q.plan_months : null,
      plan_start_date: temPlano ? input.planStartDate || input.startDate : null,
      // Condições do carnê. Zeradas fora do PIX Parcelado, como na tela de
      // Prestação: condição esquecida continuaria gerando parcelas depois.
      installment_count: parcelado ? input.installmentCount : 0,
      down_payment: parcelado ? input.downPayment : 0,
      interest_pct: parcelado ? input.interestPct : 0,
      first_due_date: parcelado ? input.firstDueDate : null,
      installment_notes: parcelado ? input.installmentNotes.trim() : '',
      lead_time_days: prazoDias,
      start_date: input.startDate,
      due_date: calcularEntrega(input.startDate, prazoDias),
    })
    .select('id')
    .single();

  if (erroOrder || !order) {
    return errResult(friendlyDbError(erroOrder, 'Não foi possível criar a prestação.'));
  }

  const { error: erroItens } = await supabase.from('service_order_items').insert(
    itens
      .sort((a, b) => a.position - b.position)
      .map((i, indice) => ({
        order_id: order.id,
        internal_service_id: i.internal_service_id,
        name: i.name,
        description: i.description,
        amount: i.amount,
        billing_type: i.billing_type,
        lead_time_days: i.lead_time_days,
        position: indice,
      }))
  );
  if (erroItens) {
    return errResult('A prestação foi criada, mas os serviços não vieram junto. Ajuste na tela de Prestação.');
  }

  // O carnê vem antes da sincronização: com PIX parcelado é dele que sai a
  // receita do trabalho no caixa, no lugar da linha única.
  if (parcelado) {
    await salvarParcelas(
      'servico',
      order.id,
      gerarParcelas({
        total: trabalho,
        parcelas: input.installmentCount,
        entrada: input.downPayment,
        jurosPct: input.interestPct,
        primeiroVencimento: input.firstDueDate,
      })
    );
  }

  await sincronizarFinanceiroDaPrestacao(order.id);

  const { error: erroStatus } = await supabase
    .from('service_quotes')
    .update({ status: 'Convertido em Prestação', updated_at: new Date().toISOString() })
    .eq('id', q.id);

  if (erroStatus) {
    return errResult('A prestação foi criada, mas o status do orçamento não mudou. Ajuste manualmente.');
  }

  revalidar();
  return okResult(
    parcelado
      ? `Prestação criada com carnê de ${input.installmentCount}× no PIX. As parcelas já estão no Financeiro como previstas.`
      : 'Prestação criada e orçamento marcado como convertido.'
  );
}
