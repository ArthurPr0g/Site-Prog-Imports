import { listServiceOrders, lancamentosDasPrestacoes } from '@/lib/data/service-orders';
import { listInternalServices } from '@/lib/data/internal-services';
import { listCustomers } from '@/lib/data/customers';
import { atividadesDasPrestacoes, listarModelos } from '@/lib/data/atividades';
import { hojeEmSaoPaulo } from '@/lib/data/painel';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { ServiceOrdersTable } from '@/components/admin/ServiceOrdersTable';
import { ModelosDeTrabalho } from '@/components/admin/ModelosDeTrabalho';

export default async function AdminPrestacaoServicoPage() {
  const [orders, services, customers, modelos] = await Promise.all([
    listServiceOrders(),
    listInternalServices(),
    listCustomers(),
    listarModelos(),
  ]);
  const ids = orders.map((o) => o.id);
  const [lancamentos, atividades] = await Promise.all([lancamentosDasPrestacoes(ids), atividadesDasPrestacoes(ids)]);

  return (
    <div>
      <AdminPageHeader
        title="Prestação de Serviço"
        subtitle="Serviços em execução. Cada prestação lança uma receita no Financeiro — nunca uma por serviço."
        action={<ModelosDeTrabalho modelos={modelos} />}
      />
      <ServiceOrdersTable
        orders={orders}
        services={services}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        lancamentos={lancamentos}
        atividades={atividades}
        modelos={modelos}
        hoje={hojeEmSaoPaulo()}
      />
    </div>
  );
}
