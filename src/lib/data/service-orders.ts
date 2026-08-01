import { createClient } from '@/lib/supabase/server';
import {
  lancamentoDaPrestacao,
  type ServiceOrder,
  type ServiceOrderItem,
  type ServiceOrderStatus,
  type ServicePaymentStatus,
} from '@/lib/services';

type ItemRow = {
  id: string;
  internal_service_id: string | null;
  name: string;
  description: string;
  amount: number;
  lead_time_days: number;
  position: number;
};

type OrderRow = {
  id: string;
  customer_id: string | null;
  quote_id: string | null;
  title: string;
  notes: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total_amount: number;
  lead_time_days: number;
  start_date: string;
  due_date: string | null;
  customers: { name: string } | null;
  service_order_items: ItemRow[] | null;
};

function toItem(r: ItemRow): ServiceOrderItem {
  return {
    id: r.id,
    internalServiceId: r.internal_service_id,
    name: r.name,
    description: r.description,
    amount: Number(r.amount),
    leadTimeDays: r.lead_time_days,
  };
}

function toOrder(r: OrderRow): ServiceOrder {
  return {
    id: r.id,
    customerId: r.customer_id,
    customerName: r.customers?.name ?? '',
    quoteId: r.quote_id,
    title: r.title,
    notes: r.notes,
    status: r.status as ServiceOrderStatus,
    paymentStatus: r.payment_status as ServicePaymentStatus,
    paymentMethod: r.payment_method,
    totalAmount: Number(r.total_amount),
    leadTimeDays: r.lead_time_days,
    startDate: r.start_date,
    dueDate: r.due_date,
    items: (r.service_order_items ?? []).sort((a, b) => a.position - b.position).map(toItem),
  };
}

export async function listServiceOrders(): Promise<ServiceOrder[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('service_orders')
    .select('*, customers(name), service_order_items(*)')
    .order('start_date', { ascending: false })
    .order('created_at', { ascending: false });
  return (data ?? []).map((r) => toOrder(r as unknown as OrderRow));
}

/** Deixa o Financeiro coerente com a prestação: cria, atualiza ou remove a
 *  ÚNICA receita que a representa.
 *
 *  Roda depois de todo salvamento em vez de na criação apenas, porque o
 *  lançamento depende de campos que mudam ao longo da vida da prestação —
 *  valor, prazo, status e pagamento. Sincronizar sempre torna impossível o
 *  caixa divergir do serviço; sincronizar só na criação transformaria toda
 *  edição posterior numa fonte silenciosa de erro.
 *
 *  Não é transacional: se o Financeiro falhar, a prestação continua salva. A
 *  alternativa seria uma função no banco, que é mais peso do que o volume aqui
 *  justifica — e uma nova chamada a esta função conserta a divergência. */
export async function sincronizarFinanceiroDaPrestacao(orderId: string): Promise<void> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('service_orders')
    .select('title, status, payment_status, total_amount, start_date, due_date')
    .eq('id', orderId)
    .maybeSingle();

  if (!data) return;

  const alvo = lancamentoDaPrestacao({
    title: data.title,
    status: data.status as ServiceOrderStatus,
    paymentStatus: data.payment_status as ServicePaymentStatus,
    totalAmount: Number(data.total_amount),
    startDate: data.start_date,
    dueDate: data.due_date,
  });

  const { data: existente } = await supabase
    .from('finance_entries')
    .select('id')
    .eq('source', 'servico')
    .eq('reference_id', orderId)
    .maybeSingle();

  if (!alvo.deveExistir) {
    if (existente) await supabase.from('finance_entries').delete().eq('id', existente.id);
    return;
  }

  const payload = {
    kind: 'receita' as const,
    description: alvo.description,
    amount: alvo.amount,
    entry_date: alvo.entryDate,
    status: alvo.status,
    source: 'servico' as const,
    reference_id: orderId,
    updated_at: new Date().toISOString(),
  };

  if (existente) {
    await supabase.from('finance_entries').update(payload).eq('id', existente.id);
  } else {
    await supabase.from('finance_entries').insert(payload);
  }
}

/** Apaga o lançamento junto com a prestação. Sem isso, o caixa continuaria
 *  afirmando uma receita cuja origem não existe mais — e a tela do Financeiro
 *  recusaria a exclusão, deixando a linha órfã para sempre. */
export async function removerFinanceiroDaPrestacao(orderId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('finance_entries').delete().eq('source', 'servico').eq('reference_id', orderId);
}
