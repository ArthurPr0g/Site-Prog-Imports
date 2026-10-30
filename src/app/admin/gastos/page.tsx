import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { GastosPanel } from '@/components/admin/GastosPanel';

// Gastos (pedido do dono em 30/10/2026): tudo o que a operação da Lia e da captação custa (IA, mensagens
// da Meta, transcrição e custos fixos), onde e com o quê, com os parâmetros editáveis. Os dados são lidos
// pelo próprio painel (ações do servidor, migration 0099).

export default function AdminGastosPage() {
  return (
    <div>
      {/* Cabeçalho dentro do tema "Noite azul": fora dele o título ficava escuro sobre o céu escuro. */}
      <div className="tema-apple [color-scheme:dark]">
        <AdminPageHeader title="Gastos" subtitle="Quanto custa a operação: IA, mensagens da Meta, transcrição e custos fixos, e quanto custou cada venda." />
      </div>
      <GastosPanel />
    </div>
  );
}
