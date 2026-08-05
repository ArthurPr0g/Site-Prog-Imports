import { listTrades } from '@/lib/data/trades';
import { listStockItems } from '@/lib/data/stock';
import { listCustomers } from '@/lib/data/customers';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { TradesTable } from '@/components/admin/TradesTable';

export default async function AdminAvaliacaoTrocaPage() {
  const [trades, stock, customers] = await Promise.all([listTrades(), listStockItems(), listCustomers()]);

  // Só o que está em mãos e livre pode ser o produto principal: reservado é de
  // outro cliente e vendido já saiu.
  const disponiveis = stock
    .filter((s) => s.status === 'Disponível')
    .map((s) => ({ id: s.id, name: s.name, paidAmount: s.paidAmount, saleAmount: s.saleAmount }));

  return (
    <div>
      <AdminPageHeader
        title="Avaliação de Troca"
        subtitle="O cliente entrega produtos usados como parte do pagamento. Só a diferença em dinheiro entra no Financeiro."
      />
      <TradesTable
        trades={trades}
        stockItems={disponiveis}
        customers={customers.map((c) => ({
          id: c.id,
          name: c.name,
          adimplencia: c.adimplencia,
          parcelasAtrasadas: c.parcelasAtrasadas,
        }))}
      />
    </div>
  );
}
