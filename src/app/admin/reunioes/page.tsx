import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { ListaDeReunioes } from '@/components/reunioes/ListaDeReunioes';

// Reuniões (sala de reunião da Prog Soluções, Fase 1, 31/10/2026; migration 0113): as que a Lia marca e as
// criadas aqui, cada uma com a sala própria (Daily) ou o Meet como plano B.
export const maxDuration = 60;

export default function AdminReunioesPage() {
  return (
    <div>
      <div className="tema-apple relative z-[1] [color-scheme:dark]">
        <AdminPageHeader title="Reuniões" subtitle="Sala própria com vídeo, gravação e transcrição. No fim, a negociação se atualiza sozinha." />
      </div>
      <ListaDeReunioes />
    </div>
  );
}
