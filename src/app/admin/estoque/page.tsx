import { listStockItems } from '@/lib/data/stock';
import { listCustomers } from '@/lib/data/customers';
import { getSiteSettings } from '@/lib/data/content';
import { createClient } from '@/lib/supabase/server';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { StockTable } from '@/components/admin/StockTable';

async function listProductOptions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('products')
    .select('id, name, categories(name)')
    .eq('active', true)
    .order('name');
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.categories?.name ?? '',
  }));
}

export default async function AdminEstoquePage() {
  const [items, customers, products, settings] = await Promise.all([
    listStockItems(),
    listCustomers(),
    listProductOptions(),
    getSiteSettings(),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Estoque"
        subtitle="Unidades físicas em mãos — separado do catálogo do site, que trabalha por encomenda"
      />
      <StockTable
        items={items}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        products={products}
        usdRate={settings.usdRate}
      />
    </div>
  );
}
