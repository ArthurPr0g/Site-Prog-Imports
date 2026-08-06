import { createClient } from '@/lib/supabase/server';
import { listProductCovers } from '@/lib/data/product-covers';
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

function toItem(r: Row, capas = new Map<string, string>()): StockItem {
  const paid = Number(r.paid_amount ?? 0);
  const sale = Number(r.sale_amount ?? 0);
  // A foto do próprio item vence a do catálogo: ela é a unidade que está na
  // prateleira, com a marca de uso que ela tem. A do catálogo é a genérica.
  const foto = r.photo_url || (r.product_id ? (capas.get(r.product_id) ?? '') : '');
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
    photoUrl: foto,
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

  const linhas = (data ?? []) as Row[];
  const capas = await listProductCovers(linhas.map((r) => r.product_id));

  return linhas.map((r) => toItem(r, capas));
}

/** Deixa o Financeiro coerente com o item de estoque: uma despesa do que foi
 *  pago por ele, na data em que entrou.
 *
 *  Comprar mercadoria é saída de caixa no dia da compra, não no dia da venda —
 *  quem importa paga o fornecedor meses antes de vender. Antes disso, o dinheiro
 *  parado em estoque não aparecia em lugar nenhum do caixa.
 *
 *  A contrapartida está em `sincronizarFinanceiroDaVenda`: item que veio do
 *  estoque não lança custo de novo na venda. Sem isso o mesmo dinheiro sairia
 *  duas vezes.
 *
 *  Item sem valor pago não vira linha: despesa de zero só polui o extrato. */
export async function sincronizarFinanceiroDoEstoque(stockItemId: string): Promise<void> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('stock_items')
    .select('name, paid_amount, entry_date, purchase_date, created_at')
    .eq('id', stockItemId)
    .maybeSingle();

  if (!data) return;

  const valor = Number(data.paid_amount ?? 0);
  // A data do cadastro no estoque, como o dono pediu. `purchase_date` é o
  // segundo melhor palpite quando a entrada não foi preenchida.
  const data_ = data.entry_date || data.purchase_date || data.created_at.slice(0, 10);

  const { data: existente } = await supabase
    .from('finance_entries')
    .select('id')
    .eq('source', 'estoque')
    .eq('reference_id', stockItemId)
    .maybeSingle();

  if (valor <= 0) {
    if (existente) await supabase.from('finance_entries').delete().eq('id', existente.id);
    return;
  }

  const payload = {
    kind: 'despesa' as const,
    description: `Compra de estoque: ${data.name}`,
    amount: valor,
    entry_date: data_,
    source: 'estoque' as const,
    reference_id: stockItemId,
    updated_at: new Date().toISOString(),
  };

  // O status não é reescrito na atualização: o dono pode ter marcado a compra
  // como ainda não paga, e uma edição de nome não deve desfazer isso.
  const { error } = existente
    ? await supabase.from('finance_entries').update(payload).eq('id', existente.id)
    : await supabase.from('finance_entries').insert({ ...payload, status: 'Pago' });

  if (error) console.error('[financeiro/estoque] linha não gravada', { stockItemId, error });
}

/** Tira a despesa junto com o item. A tela do Financeiro recusa excluir linha
 *  gerada, então a ordem inversa deixaria a linha órfã e sem remoção possível. */
export async function removerFinanceiroDoEstoque(stockItemId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('finance_entries').delete().eq('source', 'estoque').eq('reference_id', stockItemId);
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
