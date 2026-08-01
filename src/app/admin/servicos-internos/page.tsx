import { listInternalServices } from '@/lib/data/internal-services';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { InternalServicesTable } from '@/components/admin/InternalServicesTable';

export default async function AdminServicosInternosPage() {
  const services = await listInternalServices();

  return (
    <div>
      <AdminPageHeader
        title="Serviços"
        subtitle="Serviços que a Prog presta fora da loja — sites, sistemas, design. Não aparecem no site público."
      />
      <InternalServicesTable services={services} />
    </div>
  );
}
