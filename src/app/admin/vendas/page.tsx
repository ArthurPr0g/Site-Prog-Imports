import { listSales } from '@/lib/data/sales';
import { listStockItems } from '@/lib/data/stock';
import { listProductOptions } from '@/lib/data/admin';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { SalesTable } from '@/components/admin/SalesTable';

export default async function AdminVendasPage() {
  const [sales, stock, products] = await Promise.all([
    listSales(),
    listStockItems(),
    listProductOptions(),
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
      />
    </div>
  );
}
