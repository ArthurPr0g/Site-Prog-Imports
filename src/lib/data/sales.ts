import { createClient } from '@/lib/supabase/server';
import { lancamentosDaVenda, type Sale, type SaleItem, type SaleOrigin, type SaleStatus } from '@/lib/sales';

type ItemRow = {
  id: string;
  product_id: string | null;
  stock_item_id: string | null;
  product_name: string;
  qty: number;
  unit_price: number;
  unit_cost: number;
};

type SaleRow = {
  id: string;
  order_number: number;
  customer_id: string | null;
  customer_name: string;
  origin: string;
  status: string;
  payment_method: string;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  cost_total: number;
  budget_id: string | null;
  created_at: string;
  order_items: ItemRow[] | null;
};

function toSale(r: SaleRow): Sale {
  return {
    id: r.id,
    orderNumber: r.order_number,
    customerId: r.customer_id,
    customerName: r.customer_name,
    origin: r.origin as SaleOrigin,
    status: r.status as SaleStatus,
    paymentMethod: r.payment_method,
    subtotal: Number(r.subtotal),
    discount: Number(r.discount),
    shipping: Number(r.shipping),
    total: Number(r.total),
    costTotal: Number(r.cost_total),
    budgetId: r.budget_id,
    createdAt: r.created_at,
    items: (r.order_items ?? []).map(
      (i): SaleItem => ({
        id: i.id,
        productId: i.product_id,
        stockItemId: i.stock_item_id,
        productName: i.product_name,
        qty: i.qty,
        unitPrice: Number(i.unit_price),
        unitCost: Number(i.unit_cost),
      })
    ),
  };
}

export async function listSales(): Promise<Sale[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false });
  return (data ?? []).map((r) => toSale(r as unknown as SaleRow));
}

/** Deixa o Financeiro coerente com a venda: uma receita do total e uma despesa
 *  do custo.
 *
 *  Casa alvo com existente pelo `kind` — uma venda tem no máximo uma linha de
 *  cada tipo. É o que preserva uma baixa manual e evita duplicar a cada
 *  salvamento.
 *
 *  Roda depois de todo salvamento porque valor, custo e status mudam ao longo
 *  da vida da venda. Não é transacional: se o Financeiro falhar, a venda
 *  continua salva e um novo salvamento conserta. */
export async function sincronizarFinanceiroDaVenda(orderId: string): Promise<void> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('orders')
    .select('order_number, status, total, cost_total, created_at')
    .eq('id', orderId)
    .maybeSingle();

  if (!data) return;

  const alvos = lancamentosDaVenda({
    orderNumber: data.order_number,
    status: data.status as SaleStatus,
    total: Number(data.total),
    costTotal: Number(data.cost_total),
    createdAt: data.created_at,
  });

  const { data: existentes } = await supabase
    .from('finance_entries')
    .select('id, kind')
    .eq('source', 'venda')
    .eq('reference_id', orderId);

  const atuais = existentes ?? [];
  const porKind = new Map(atuais.map((e) => [e.kind, e]));
  const kindsAlvo = new Set(alvos.map((a) => a.kind));
  const agora = new Date().toISOString();

  for (const alvo of alvos) {
    const payload = {
      kind: alvo.kind,
      description: alvo.description,
      amount: alvo.amount,
      entry_date: alvo.entryDate,
      status: alvo.status,
      source: 'venda' as const,
      reference_id: orderId,
      updated_at: agora,
    };

    const existente = porKind.get(alvo.kind);
    if (existente) {
      await supabase.from('finance_entries').update(payload).eq('id', existente.id);
    } else {
      await supabase.from('finance_entries').insert(payload);
    }
  }

  // Sobras: venda cancelada, ou custo zerado depois de ter existido.
  const sobras = atuais.filter((e) => !kindsAlvo.has(e.kind as 'receita' | 'despesa'));
  if (sobras.length > 0) {
    await supabase.from('finance_entries').delete().in('id', sobras.map((e) => e.id));
  }
}

/** Apaga os lançamentos junto com a venda: a tela do Financeiro recusa excluir
 *  linha de origem 'venda', então a ordem inversa deixaria as linhas órfãs e
 *  impossíveis de remover pela interface. */
export async function removerFinanceiroDaVenda(orderId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('finance_entries').delete().eq('source', 'venda').eq('reference_id', orderId);
}
