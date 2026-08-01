import { listServiceQuotes } from '@/lib/data/service-quotes';
import { listInternalServices } from '@/lib/data/internal-services';
import { listCustomers } from '@/lib/data/customers';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { ServiceQuotesTable } from '@/components/admin/ServiceQuotesTable';

export default async function AdminOrcamentosServicosPage() {
  const [quotes, services, customers] = await Promise.all([
    listServiceQuotes(),
    listInternalServices(),
    listCustomers(),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Orçamentos de Serviços"
        subtitle="Propostas dos serviços internos. Ao ser aprovado, o orçamento vira uma Prestação — e é ela que lança no Financeiro."
      />
      <ServiceQuotesTable
        quotes={quotes}
        services={services}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
