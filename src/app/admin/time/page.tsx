import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { TimeEFluxo } from '@/components/admin/TimeEFluxo';

// Time e fluxo (pedido do Arthur em 30/10/2026): quem é cada agente, o fluxograma do processo inteiro e o
// catálogo de funções, para ele não esquecer o que o sistema já faz. Conteúdo estático (TimeEFluxo.tsx).

export default function AdminTimePage() {
  return (
    <div>
      <div className="tema-apple relative z-[1] [color-scheme:dark]">
        <AdminPageHeader title="Time e fluxo" subtitle="Quem é cada agente, como o processo anda do lead ao pós-venda e tudo o que você pode pedir." />
      </div>
      <TimeEFluxo />
    </div>
  );
}
