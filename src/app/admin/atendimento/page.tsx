import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { CaptacaoPanel } from '@/components/admin/CaptacaoPanel';
import { dadosDaCaptacao } from '../captacao/dados';

// Menu novo da Prog Soluções (30/10/2026): cada página mostra a sua parte do painel da Captação.
// Responder e "Orientar a Lia" rodam a resposta da IA dentro da ação (várias chamadas ao Claude).
export const maxDuration = 60;

export default async function AdminAtendimentoPage() {
  const dados = await dadosDaCaptacao();
  return (
    <div>
      {/* Cabeçalho dentro do tema "Noite azul": o céu fixo do painel (z -1) era pintado por cima dele; z-[1] o põe à frente. */}
      <div className="tema-apple relative z-[1] [color-scheme:dark]">
        <AdminPageHeader title="Atendimento" subtitle="Conversas da Lia no WhatsApp: responda, assuma ou oriente, sem sair desta tela." />
      </div>
      <CaptacaoPanel {...dados} pagina="atendimento" />
    </div>
  );
}
