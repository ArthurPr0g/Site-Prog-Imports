import { listAdminOrders, listProductOptions } from '@/lib/data/admin';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { OrdersTable } from '@/components/admin/OrdersTable';

export default async function AdminOrdersPage() {
  const [orders, products] = await Promise.all([listAdminOrders(), listProductOptions()]);

  return (
    <div>
      <AdminPageHeader title="Pedidos" subtitle={`${orders.length} pedidos`} />
      <OrdersTable orders={orders} products={products.map((p) => ({ id: p.id, name: p.name, price: Number(p.price) }))} />
    </div>
  );
}
