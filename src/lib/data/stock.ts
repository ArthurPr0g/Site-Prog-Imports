import { createClient } from '@/lib/supabase/server';
import type { StockItem, StockOrigin, StockStatus } from '@/lib/stock';

// Consultas do estoque. Tipos, constantes e cálculos ficam em `lib/stock.ts`,
// que não importa nada de servidor — a tabela do admin é client component e
// precisa deles sem arrastar `next/headers` para o bundle do navegador.

type Row = {
  id: string;
  origin: string;
  status: string;
  product_id: string | null;
  reserved_customer_id: string | null;
  name: string;
  category: string | null;
  specs: string | null;
  product_link: string | null;
  photo_url: string | null;
  purchase_date: string | null;
  entry_date: string | null;
  usd_rate: number | null;
  paid_amount: number;
  sale_amount: number;
  notes: string | null;
  customers?: { name: string } | null;
};

function toItem(r: Row): StockItem {
  const paid = Number(r.paid_amount ?? 0);
  const sale = Number(r.sale_amount ?? 0);
  return {
    id: r.id,
    origin: r.origin as StockOrigin,
    status: r.status as StockStatus,
    productId: r.product_id,
    reservedCustomerId: r.reserved_customer_id,
    reservedCustomerName: r.customers?.name ?? '',
    name: r.name,
    category: r.category ?? '',
    specs: r.specs ?? '',
    productLink: r.product_link ?? '',
    photoUrl: r.photo_url ?? '',
    purchaseDate: r.purchase_date ?? '',
    entryDate: r.entry_date ?? '',
    usdRate: r.usd_rate !== null && r.usd_rate !== undefined ? Number(r.usd_rate) : null,
    paidAmount: paid,
    saleAmount: sale,
    notes: r.notes ?? '',
    expectedProfit: sale - paid,
  };
}

export async function listStockItems(): Promise<StockItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('stock_items')
    .select('*, customers(name)')
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });

  return (data ?? []).map((r) => toItem(r as Row));
}

/** Unidades disponíveis por produto do catálogo, para o selo de pronta entrega
 *  na loja. Vem de uma função `security definer` que devolve só a contagem — a
 *  tabela de estoque tem custo e margem, e nada disso pode chegar ao visitante. */
export async function getReadyStockCounts(): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('ready_stock_counts');
  const mapa = new Map<string, number>();
  for (const linha of data ?? []) {
    if (linha.product_id) mapa.set(linha.product_id, Number(linha.qty));
  }
  return mapa;
}
