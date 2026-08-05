import { createClient } from '@/lib/supabase/server';
import type { Trade, TradeItem, CondicaoItem } from '@/lib/trades';

type ItemRow = {
  id: string;
  name: string;
  category: string;
  specs: string;
  condition: string;
  market_value: number;
  paid_value: number;
  resale_value: number;
  notes: string;
  position: number;
  stock_item_id: string | null;
};

type TradeRow = {
  id: string;
  customer_id: string | null;
  stock_item_id: string | null;
  main_product_name: string;
  main_sale_price: number;
  main_cost: number;
  total_received: number;
  difference_to_pay: number;
  total_profit: number;
  margin_pct: number;
  payment_method: string;
  installment_count: number;
  down_payment: number;
  interest_pct: number;
  first_due_date: string | null;
  installment_notes: string;
  notes: string;
  trade_date: string;
  order_id: string | null;
  customers: { name: string } | null;
  orders: { order_number: number } | null;
  trade_items: ItemRow[] | null;
};

function toTrade(r: TradeRow): Trade {
  return {
    id: r.id,
    customerId: r.customer_id,
    customerName: r.customers?.name ?? '',
    stockItemId: r.stock_item_id,
    mainProductName: r.main_product_name,
    mainSalePrice: Number(r.main_sale_price),
    mainCost: Number(r.main_cost),
    totalReceived: Number(r.total_received),
    differenceToPay: Number(r.difference_to_pay),
    totalProfit: Number(r.total_profit),
    marginPct: Number(r.margin_pct),
    paymentMethod: r.payment_method,
    installmentCount: r.installment_count,
    downPayment: Number(r.down_payment),
    interestPct: Number(r.interest_pct),
    firstDueDate: r.first_due_date,
    installmentNotes: r.installment_notes,
    notes: r.notes,
    tradeDate: r.trade_date,
    orderId: r.order_id,
    orderNumber: r.orders?.order_number ?? null,
    items: (r.trade_items ?? [])
      .sort((a, b) => a.position - b.position)
      .map(
        (i): TradeItem => ({
          id: i.id,
          name: i.name,
          category: i.category,
          specs: i.specs,
          condition: i.condition as CondicaoItem,
          marketValue: Number(i.market_value),
          paidValue: Number(i.paid_value),
          resaleValue: Number(i.resale_value),
          notes: i.notes,
          stockItemId: i.stock_item_id,
        })
      ),
  };
}

// `orders!trades_order_id_fkey` nomeia a chave de propósito: existem DUAS
// ligações entre as tabelas — `trades.order_id` e `orders.trade_id` — e sem
// dizer qual usar o PostgREST recusa a consulta por ambiguidade. A recusa vinha
// como `data: null`, então a tela mostrava "nenhuma negociação" com o banco
// cheio, sem erro em lugar nenhum.
export async function listTrades(): Promise<Trade[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('trades')
    .select('*, customers(name), orders!trades_order_id_fkey(order_number), trade_items(*)')
    .order('trade_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) console.error('[trocas] listagem falhou', error);

  return (data ?? []).map((r) => toTrade(r as unknown as TradeRow));
}

export async function getTrade(id: string): Promise<Trade | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('trades')
    .select('*, customers(name), orders!trades_order_id_fkey(order_number), trade_items(*)')
    .eq('id', id)
    .maybeSingle();
  return data ? toTrade(data as unknown as TradeRow) : null;
}
