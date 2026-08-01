import { listServiceOrders } from '@/lib/data/service-orders';
import { listInternalServices } from '@/lib/data/internal-services';
import { listCustomers } from '@/lib/data/customers';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { ServiceOrdersTable } from '@/components/admin/ServiceOrdersTable';

export default async function AdminPrestacaoServicoPage() {
  const [orders, services, customers] = await Promise.all([
    listServiceOrders(),
    listInternalServices(),
    listCustomers(),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Prestação de Serviço"
        subtitle="Serviços em execução. Cada prestação lança uma receita no Financeiro — nunca uma por serviço."
      />
      <ServiceOrdersTable
        orders={orders}
        services={services}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
