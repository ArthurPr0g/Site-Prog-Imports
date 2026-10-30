import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { PosVendaPanel } from '@/components/admin/PosVendaPanel';

// Pós-venda da Prog Soluções (pedido do dono em 28/10/2026): projetos vendidos,
// rodadas de ajuste, reuniões e prazos. Os dados são lidos pelo próprio painel
// (ações do servidor) e relidos ao voltar para a aba.

export default function AdminPosVendaPage() {
  return (
    <div>
      {/* Cabeçalho dentro do tema "Noite azul": fora dele o título ficava escuro sobre o céu escuro. */}
      <div className="tema-apple [color-scheme:dark]">
        <AdminPageHeader
          title="Pós-venda"
          subtitle="Projetos vendidos da Prog Soluções: rodadas de ajuste, reuniões, prazos e entregas."
        />
      </div>
      <PosVendaPanel />
    </div>
  );
}
