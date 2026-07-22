import { listServices } from '@/lib/data/content';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { ServicesPanel } from '@/components/admin/ServicesPanel';

export default async function AdminServicesPage() {
  const services = await listServices();

  return (
    <div>
      <AdminPageHeader title="Serviços" subtitle="Serviços técnicos oferecidos" />
      <ServicesPanel services={services} />
    </div>
  );
}
