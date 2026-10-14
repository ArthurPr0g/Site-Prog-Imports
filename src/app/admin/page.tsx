import { getPainel } from '@/lib/data/painel';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { PainelDinamico } from '@/components/admin/PainelDinamico';

export default async function AdminDashboardPage() {
  const dados = await getPainel();

  return (
    <div>
      <AdminPageHeader title="Painel" subtitle="Resumo da loja" />
      <PainelDinamico dados={dados} />
    </div>
  );
}
