import { listLeads } from '@/lib/data/leads';
import { listInternalServices } from '@/lib/data/internal-services';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { CaptacaoPanel } from '@/components/admin/CaptacaoPanel';

export default async function AdminCaptacaoPage() {
  const [leads, servicos] = await Promise.all([listLeads(), listInternalServices()]);
  // Só o preço por nome: é o que o painel usa para estimar o valor de cada lead.
  const precos = servicos.filter((s) => s.billingType === 'unico').map((s) => [s.name, s.price] as [string, number]);

  return (
    <div>
      <AdminPageHeader
        title="Captação"
        subtitle="Empresas do Google Maps (Brasil e EUA) com chance de fechar site, loja, sistema ou marca."
      />
      <CaptacaoPanel leads={leads} precos={precos} />
    </div>
  );
}
