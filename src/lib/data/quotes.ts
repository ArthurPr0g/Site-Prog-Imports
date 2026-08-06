import { createClient } from '@/lib/supabase/server';
import { listProductCovers } from '@/lib/data/product-covers';
import type { QuoteStatus } from '@/lib/quotes';
import type { Desconto } from '@/lib/discount';

export type StoreQuote = {
  id: string;
  customerId: string | null;
  customerName: string;
  productId: string | null;
  name: string;
  category: string;
  specs: string;
  productLink: string;
  usdRate: number;
  productValueUsd: number;
  taxUsd: number;
  travelerFeeUsd: number;
  grabrFeeUsd: number;
  processingUsd: number;
  shippingBrl: number;
  totalUsd: number;
  totalBrl: number;
  /** Preço cheio, antes do desconto. */
  salePriceBrl: number;
  desconto: Desconto;
  profitBrl: number;
  marginPct: number;
  notes: string;
  status: QuoteStatus;
  createdAt: string;
  /** Capa do produto no catálogo. Vazio quando o orçamento não está ligado a um
   *  produto, ou quando o produto ainda não tem foto. */
  coverUrl: string;
};

type Row = {
  id: string;
  customer_id: string | null;
  product_id: string | null;
  name: string;
  category: string | null;
  specs: string | null;
  product_link: string | null;
  usd_rate: number;
  product_value_usd: number;
  tax_usd: number;
  traveler_fee_usd: number;
  grabr_fee_usd: number;
  processing_usd: number;
  shipping_brl: number;
  total_usd: number;
  total_brl: number;
  sale_price_brl: number;
  discount_type: string;
  discount_value: number;
  discount_note: string | null;
  profit_brl: number;
  margin_pct: number;
  notes: string | null;
  status: string;
  created_at: string;
  customers?: { name: string } | null;
};

function toQuote(r: Row, capa = ''): StoreQuote {
  return {
    id: r.id,
    customerId: r.customer_id,
    customerName: r.customers?.name ?? '',
    productId: r.product_id,
    name: r.name,
    category: r.category ?? '',
    specs: r.specs ?? '',
    productLink: r.product_link ?? '',
    usdRate: Number(r.usd_rate),
    productValueUsd: Number(r.product_value_usd),
    taxUsd: Number(r.tax_usd),
    travelerFeeUsd: Number(r.traveler_fee_usd),
    grabrFeeUsd: Number(r.grabr_fee_usd),
    processingUsd: Number(r.processing_usd),
    shippingBrl: Number(r.shipping_brl),
    totalUsd: Number(r.total_usd),
    totalBrl: Number(r.total_brl),
    salePriceBrl: Number(r.sale_price_brl),
    desconto: {
      tipo: r.discount_type as Desconto['tipo'],
      valor: Number(r.discount_value),
      descricao: r.discount_note ?? '',
    },
    profitBrl: Number(r.profit_brl),
    marginPct: Number(r.margin_pct),
    notes: r.notes ?? '',
    status: r.status as QuoteStatus,
    createdAt: r.created_at,
    coverUrl: capa,
  };
}

export async function listStoreQuotes(): Promise<StoreQuote[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('store_quotes')
    .select('*, customers(name)')
    .order('created_at', { ascending: false });

  const linhas = (data ?? []) as Row[];
  const capas = await listProductCovers(linhas.map((r) => r.product_id));

  return linhas.map((r) => toQuote(r, r.product_id ? (capas.get(r.product_id) ?? '') : ''));
}
