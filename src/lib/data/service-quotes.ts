import { createClient } from '@/lib/supabase/server';
import type { BillingType, ServiceQuote, ServiceOrderItem, ServiceQuoteStatus } from '@/lib/services';

type ItemRow = {
  id: string;
  internal_service_id: string | null;
  name: string;
  description: string;
  amount: number;
  billing_type: string;
  lead_time_days: number;
  position: number;
};

type QuoteRow = {
  id: string;
  customer_id: string | null;
  title: string;
  notes: string;
  status: string;
  total_amount: number;
  monthly_amount: number;
  plan_months: number | null;
  lead_time_days: number;
  created_at: string;
  include_contract: boolean;
  client_has_domain: boolean;
  customers: { name: string } | null;
  service_quote_items: ItemRow[] | null;
  service_orders: { id: string }[] | null;
};

function toItem(r: ItemRow): ServiceOrderItem {
  return {
    id: r.id,
    internalServiceId: r.internal_service_id,
    name: r.name,
    description: r.description,
    amount: Number(r.amount),
    billingType: r.billing_type as BillingType,
    leadTimeDays: r.lead_time_days,
  };
}

export async function listServiceQuotes(): Promise<ServiceQuote[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('service_quotes')
    // service_orders vem junto para a tela saber, sem consulta extra, se este
    // orçamento já virou prestação e poder linkar para ela.
    .select('*, customers(name), service_quote_items(*), service_orders(id)')
    .order('created_at', { ascending: false });

  return (data ?? []).map((r) => {
    const row = r as unknown as QuoteRow;
    return {
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customers?.name ?? '',
      title: row.title,
      notes: row.notes,
      status: row.status as ServiceQuoteStatus,
      totalAmount: Number(row.total_amount),
      monthlyAmount: Number(row.monthly_amount),
      planMonths: row.plan_months,
      leadTimeDays: row.lead_time_days,
      createdAt: row.created_at,
      includeContract: row.include_contract,
      clientHasDomain: row.client_has_domain,
      orderId: row.service_orders?.[0]?.id ?? null,
      items: (row.service_quote_items ?? []).sort((a, b) => a.position - b.position).map(toItem),
    };
  });
}
