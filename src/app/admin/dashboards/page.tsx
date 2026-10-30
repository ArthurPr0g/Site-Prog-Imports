import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { CaptacaoPanel } from '@/components/admin/CaptacaoPanel';
import { dadosDaCaptacao } from '../captacao/dados';

// Menu novo da Prog Soluções (30/10/2026): cada página mostra a sua parte do painel da Captação.

export default async function AdminDashboardsPage() {
  const dados = await dadosDaCaptacao();
  return (
    <div>
      {/* Cabeçalho dentro do tema "Noite azul": o céu fixo do painel (z -1) era pintado por cima dele; z-[1] o põe à frente. */}
      <div className="tema-apple relative z-[1] [color-scheme:dark]">
        <AdminPageHeader title="Dashboards" subtitle="Tudo em números: dinheiro na mesa, meta, funil, placar de quem converte e resultados da Lia." />
      </div>
      <CaptacaoPanel {...dados} pagina="dashboards" />
    </div>
  );
}
