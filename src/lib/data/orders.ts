import { createClient } from '@/lib/supabase/server';
import { STATUS_STYLES, TIMELINE_STEPS, type OrderStatus } from '@/lib/constants';
import { formatBRL, formatDateBR, formatDateTimeBR } from '@/lib/format';

export async function listCustomerOrders(customerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('orders')
    .select('*, order_items(product_name, qty, unit_price)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  return (data ?? []).map(formatOrderSummary);
}

function formatOrderSummary(o: {
  order_number: number;
  status: string;
  total: number;
  payment_method: string;
  created_at: string;
  timeline_stage: number;
  order_items: { product_name: string; qty: number }[];
}) {
  const style = STATUS_STYLES[o.status as OrderStatus] ?? STATUS_STYLES.Pago;
  const itemsLabel = o.order_items.map((i) => (i.qty > 1 ? `${i.qty}x ${i.product_name}` : i.product_name)).join(' + ');
  return {
    id: `#${o.order_number}`,
    orderNumber: o.order_number,
    items: itemsLabel,
    date: formatDateBR(o.created_at),
    total: formatBRL(Number(o.total)),
    payment: o.payment_method,
    status: o.status,
    stage: o.timeline_stage,
    stageLabel: TIMELINE_STEPS[Math.min(o.timeline_stage, 9)],
    stBg: style.bg,
    stBorder: style.border,
    stColor: style.color,
  };
}

export async function getCustomerOrderDetail(customerId: string, orderNumber: number) {
  const supabase = await createClient();
  const { data: order } = await supabase
    .from('orders')
    .select('*, order_items(id, product_name, qty, unit_price), order_events(stage, note, occurred_at)')
    .eq('customer_id', customerId)
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (!order) return null;

  const style = STATUS_STYLES[order.status as OrderStatus] ?? STATUS_STYLES.Pago;
  const eventsByStage = new Map(order.order_events.map((e) => [e.stage, e]));

  const steps = TIMELINE_STEPS.map((title, i) => {
    const done = i < order.timeline_stage;
    const current = i === order.timeline_stage;
    const event = eventsByStage.get(i);
    const isImportOnlyStage = i >= 4 && i <= 6;
    const showImportNote = order.is_import && isImportOnlyStage && (done || current) && !event?.note;
    return {
      title,
      done,
      current,
      when: event ? formatDateTimeBR(event.occurred_at) : null,
      note: event?.note || (showImportNote ? 'Etapa aplicável a produtos importados — 3 a 7 dias úteis.' : null),
    };
  });

  return {
    id: `#${order.order_number}`,
    orderNumber: order.order_number,
    date: formatDateBR(order.created_at),
    payment: order.payment_method,
    status: order.status,
    stBg: style.bg,
    stBorder: style.border,
    stColor: style.color,
    trackingCode: order.tracking_code,
    trackingUrl: order.tracking_url,
    steps,
    lineItems: order.order_items.map((i) => ({
      name: i.qty > 1 ? `${i.qty}x ${i.product_name}` : i.product_name,
      price: formatBRL(Number(i.unit_price) * i.qty),
    })),
    total: formatBRL(Number(order.total)),
    address: order.address_snapshot as {
      rua: string;
      complemento: string;
      bairro: string;
      cidade: string;
      cep: string;
    } | null,
  };
}
