import { listSales } from '@/lib/data/sales';
import { listStockItems } from '@/lib/data/stock';
import { listCustomers } from '@/lib/data/customers';
import { listProductOptions } from '@/lib/data/admin';
import { getSiteSettings } from '@/lib/data/content';
import { remetenteDaConfiguracao } from '@/lib/shipping-label';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { SalesTable } from '@/components/admin/SalesTable';

export default async function AdminVendasPage() {
  const [sales, stock, products, customers, settings] = await Promise.all([
    listSales(),
    listStockItems(),
    listProductOptions(),
    listCustomers(),
    getSiteSettings(),
  ]);

  // Só o que está em mãos e livre pode ser vendido: reservado é de outro
  // cliente, e vendido já saiu.
  const disponiveis = stock
    .filter((s) => s.status === 'Disponível')
    .map((s) => ({ id: s.id, name: s.name, paidAmount: s.paidAmount, saleAmount: s.saleAmount }));

  return (
    <div>
      <AdminPageHeader
        title="Vendas"
        subtitle="Vendas do site e lançadas à mão. Cada venda leva receita e custo ao Financeiro — o resultado sai como lucro."
      />
      <SalesTable
        sales={sales}
        products={products.map((p) => ({ id: p.id, name: p.name, price: Number(p.price) }))}
        stockItems={disponiveis}
        clientes={customers.map((c) => ({
          id: c.id,
          name: c.name,
          adimplencia: c.adimplencia,
          parcelasAtrasadas: c.parcelasAtrasadas,
        }))}
        remetente={remetenteDaConfiguracao(settings)}
      />
    </div>
  );
}
