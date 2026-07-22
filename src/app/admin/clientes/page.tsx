import { listAdminClients } from '@/lib/data/admin';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';

export default async function AdminClientsPage() {
  const clients = await listAdminClients();

  return (
    <div>
      <AdminPageHeader title="Clientes" subtitle="Clientes cadastrados na loja" />
      <div className="overflow-x-auto rounded-[18px] border border-border bg-card p-6">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[1.4fr_1.6fr_1fr_110px_120px] gap-3 border-b border-border pb-2.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
            <div>Cliente</div>
            <div>E-mail</div>
            <div>Cidade</div>
            <div>Pedidos</div>
            <div>Total gasto</div>
          </div>
          {clients.length === 0 && <div className="py-6 text-sm text-fg-tertiary">Nenhum cliente cadastrado ainda.</div>}
          {clients.map((c) => (
            <div key={c.id} className="grid grid-cols-[1.4fr_1.6fr_1fr_110px_120px] items-center gap-3 border-b border-divider py-3 text-[13.5px] last:border-b-0">
              <div className="flex items-center gap-2.5">
                <div className="grid h-7.5 w-7.5 place-items-center rounded-full border border-border-hover bg-[#1c1c21] text-xs font-extrabold text-accent">
                  {c.initial}
                </div>
                <span className="font-bold">{c.name}</span>
              </div>
              <div className="text-[13px] text-fg-secondary">{c.email}</div>
              <div className="text-[13px] text-fg-secondary">{c.city}</div>
              <div className="font-bold">{c.orders}</div>
              <div className="font-bold text-accent">{c.spent}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
