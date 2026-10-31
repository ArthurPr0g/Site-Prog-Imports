import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { DecisoesPanel } from '@/components/admin/DecisoesPanel';
import { listarDecisoes } from '@/app/actions/decisoes';

// Central de decisões da Prog Soluções (pedido do Arthur, 31/10/2026, 0117): tudo o que espera uma decisão
// dele, com contexto, botões rápidos (as mesmas ações do WhatsApp) e resposta livre (fila do PC).

export const dynamic = 'force-dynamic';

export default async function AdminDecisoesPage() {
  const dados = await listarDecisoes();
  return (
    <div>
      <div className="tema-apple relative z-[1] [color-scheme:dark]">
        <AdminPageHeader title="Decisões" subtitle="O que espera você: de onde veio, o contexto e as opções. Decidida, sai da lista e fica no histórico." />
      </div>
      <div className="tema-apple relative z-[1] mx-auto max-w-3xl [color-scheme:dark]">
        {dados ? <DecisoesPanel abertas={dados.abertas} historico={dados.historico} /> : <div className="text-fg-tertiary">Sem permissão.</div>}
      </div>
    </div>
  );
}
