import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { listCustomerOrders } from '@/lib/data/orders';
import { createClient } from '@/lib/supabase/server';
import { TIMELINE_STEPS } from '@/lib/constants';

export default async function AccountSummaryPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const [orders, { count: favCount }] = await Promise.all([
    listCustomerOrders(user.id),
    supabase.from('favorites').select('*', { count: 'exact', head: true }).eq('customer_id', user.id),
  ]);

  const delivered = orders.filter((o) => o.status === 'Entregue').length;
  const inProgress = orders.filter((o) => o.status !== 'Entregue' && o.status !== 'Cancelado');
  const activeOrder = inProgress[0];
  const firstName = user.name.split(' ')[0];

  return (
    <div>
      <h1 className="mb-1 font-display text-[26px] font-bold tracking-[-.02em]">Olá, {firstName}</h1>
      <div className="mb-6 text-sm text-fg-tertiary">Acompanhe seus pedidos e gerencie sua conta.</div>

      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3.5">
        <div className="rounded-[18px] border border-border bg-card p-5.5">
          <div className="mb-2 text-xs font-bold uppercase tracking-[.08em] text-fg-tertiary">Pedidos</div>
          <div className="font-display text-[28px] font-bold">{orders.length}</div>
        </div>
        <div className="rounded-[18px] border border-accent/35 bg-card p-5.5">
          <div className="mb-2 text-xs font-bold uppercase tracking-[.08em] text-accent">Em andamento</div>
          <div className="font-display text-[28px] font-bold">{inProgress.length}</div>
        </div>
        <div className="rounded-[18px] border border-border bg-card p-5.5">
          <div className="mb-2 text-xs font-bold uppercase tracking-[.08em] text-fg-tertiary">Entregues</div>
          <div className="font-display text-[28px] font-bold">{delivered}</div>
        </div>
        <div className="rounded-[18px] border border-border bg-card p-5.5">
          <div className="mb-2 text-xs font-bold uppercase tracking-[.08em] text-fg-tertiary">Favoritos</div>
          <div className="font-display text-[28px] font-bold">{favCount ?? 0}</div>
        </div>
      </div>

      {activeOrder && (
        <div className="mb-6 rounded-[20px] border border-accent/30 bg-[linear-gradient(135deg,#181014,#111114_60%)] p-6.5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-2 text-xs font-extrabold uppercase tracking-[.1em] text-accent">
                Pedido em andamento · {activeOrder.id}
              </div>
              <div className="mb-1 text-[17px] font-extrabold">{activeOrder.items}</div>
              <div className="text-[13.5px] text-fg-secondary">{activeOrder.stageLabel}</div>
            </div>
            <Link
              href={`/conta/pedidos/${activeOrder.orderNumber}`}
              className="rounded-xl bg-accent px-5.5 py-3 text-[13.5px] font-extrabold text-page transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(242,135,5,.4)]"
            >
              Rastrear pedido
            </Link>
          </div>
          <div className="mt-5.5 flex items-center gap-1">
            {TIMELINE_STEPS.map((_, i) => (
              <div
                key={i}
                className="h-1.5 flex-1 rounded-full"
                style={{ background: i < activeOrder.stage ? '#F28705' : i === activeOrder.stage ? 'rgba(242,135,5,.35)' : '#1c1c21' }}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11.5px] text-fg-faded">
            <span>Pedido realizado</span>
            <span className="font-bold text-accent">{activeOrder.stageLabel}</span>
            <span>Entregue</span>
          </div>
        </div>
      )}

      <div className="rounded-[20px] border border-border bg-card p-6">
        <div className="mb-3.5 text-[15px] font-extrabold">Últimos pedidos</div>
        {orders.length === 0 && <div className="text-sm text-fg-tertiary">Você ainda não fez nenhum pedido.</div>}
        {orders.slice(0, 5).map((o) => (
          <Link
            key={o.id}
            href={`/conta/pedidos/${o.orderNumber}`}
            className="flex items-center gap-4 border-b border-divider py-3.5 last:border-b-0 hover:bg-card-hover"
          >
            <div className="w-15 text-[13.5px] font-extrabold text-accent">{o.id}</div>
            <div className="flex-1 text-[13.5px] font-bold">{o.items}</div>
            <div className="text-[13px] text-fg-tertiary">{o.date}</div>
            <div className="w-27.5 text-right text-[13.5px] font-bold">{o.total}</div>
            <span
              className="w-30 rounded-full border px-3 py-1.5 text-center text-[11px] font-extrabold"
              style={{ background: o.stBg, borderColor: o.stBorder, color: o.stColor }}
            >
              {o.status}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
