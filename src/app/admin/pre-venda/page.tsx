import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { PreVendaPanel } from '@/components/admin/PreVendaPanel';

// Pré-venda da Prog Soluções (pedido do Arthur, 31/10/2026): os leads sendo contatados ou em negociação,
// com briefing, protótipo, proposta e o que falta. Nada vai para o Pós-venda antes do sinal.
// Os dados são lidos pelo próprio painel (ações do servidor, migration 0114).

export default function AdminPreVendaPage() {
  return (
    <div>
      {/* Cabeçalho dentro do tema "Noite azul": o céu fixo do painel (z -1) era pintado por cima dele; z-[1] o põe à frente. */}
      <div className="tema-apple relative z-[1] [color-scheme:dark]">
        <AdminPageHeader
          title="Pré-venda"
          subtitle="Quem está sendo contatado ou negociando: passos, pendências, links, valores e o próximo passo de cada um."
        />
      </div>
      <PreVendaPanel />
    </div>
  );
}
