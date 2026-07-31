import { listStoreQuotes } from '@/lib/data/quotes';
import { listCustomers } from '@/lib/data/customers';
import { getSiteSettings } from '@/lib/data/content';
import { createClient } from '@/lib/supabase/server';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { QuotesTable } from '@/components/admin/QuotesTable';

async function listProductOptions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('products')
    .select('id, name, categories(name)')
    .eq('active', true)
    .order('name');
  return (data ?? []).map((p) => ({ id: p.id, name: p.name, category: p.categories?.name ?? '' }));
}

export default async function AdminOrcamentosLojaPage() {
  const [quotes, customers, products, settings] = await Promise.all([
    listStoreQuotes(),
    listCustomers(),
    listProductOptions(),
    getSiteSettings(),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Orçamentos Loja"
        subtitle="Cotação de importação EUA → Brasil, antes de virar estoque"
      />
      <QuotesTable
        quotes={quotes}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        products={products}
        usdRate={settings.usdRate}
      />
    </div>
  );
}
