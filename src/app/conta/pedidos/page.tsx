import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { listCustomerOrders } from '@/lib/data/orders';
import { PlaceholderImage } from '@/components/ui/PlaceholderImage';

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/entrar?next=/conta');
  const orders = await listCustomerOrders(user.id);

  return (
    <div>
      <h1 className="mb-6 font-display text-[26px] font-bold tracking-[-.02em]">Meus pedidos</h1>
      <div className="flex flex-col gap-3.5">
        {orders.length === 0 && (
          <div className="rounded-[20px] border border-border bg-card p-8 text-center text-sm text-fg-tertiary">
            Você ainda não fez nenhum pedido.
          </div>
        )}
        {orders.map((o) => (
          <div
            key={o.id}
            className="rounded-[20px] border border-border bg-card p-6 transition-all hover:border-accent/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <PlaceholderImage label={o.items} className="h-16 w-16 flex-shrink-0 rounded-2xl" textClassName="hidden" />
                <div>
                  <div className="mb-1 text-xs font-extrabold text-accent">
                    {o.id} · {o.date}
                  </div>
                  <div className="text-[15.5px] font-extrabold">{o.items}</div>
                  <div className="mt-0.5 text-[13px] text-fg-tertiary">
                    {o.total} · {o.payment}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="rounded-full border px-3.5 py-1.5 text-[11.5px] font-extrabold"
                  style={{ background: o.stBg, borderColor: o.stBorder, color: o.stColor }}
                >
                  {o.status}
                </span>
                <Link
                  href={`/conta/pedidos/${o.orderNumber}`}
                  className="rounded-xl border border-border-hover bg-[#1c1c21] px-4.5 py-2.5 text-[13px] font-extrabold transition-all hover:border-accent hover:text-accent"
                >
                  Ver detalhes
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
