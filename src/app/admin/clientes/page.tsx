import { listCustomers } from '@/lib/data/customers';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { CustomersTable } from '@/components/admin/CustomersTable';

export default async function AdminClientsPage() {
  const customers = await listCustomers();

  return (
    <div>
      <AdminPageHeader
        title="Clientes"
        subtitle="Cadastro único — inclui quem comprou fora da loja e nunca criou conta no site"
      />
      <CustomersTable customers={customers} />
    </div>
  );
}
