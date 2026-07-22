import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getCustomerOrderDetail } from '@/lib/data/orders';
import { OrderTimeline } from '@/components/account/OrderTimeline';
import { WHATSAPP_NUMBER } from '@/lib/constants';
import { buildWhatsAppLink } from '@/lib/whatsapp';

export default async function OrderDetailPage({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const order = await getCustomerOrderDetail(user.id, Number(numero));
  if (!order) notFound();

  const supportLink = buildWhatsAppLink(`Olá! Preciso de ajuda com meu pedido ${order.id}.`, WHATSAPP_NUMBER);

  return (
    <div>
      <Link href="/conta/pedidos" className="mb-4 inline-block text-[13.5px] font-bold text-fg-tertiary hover:text-accent">
        ← Voltar aos pedidos
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 font-display text-[26px] font-bold tracking-[-.02em]">Pedido {order.id}</h1>
          <div className="text-sm text-fg-tertiary">
            Realizado em {order.date} · {order.payment}
          </div>
        </div>
        <span
          className="rounded-full border px-4 py-2 text-xs font-extrabold"
          style={{ background: order.stBg, borderColor: order.stBorder, color: order.stColor }}
        >
          {order.status}
        </span>
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1fr_320px]">
        <div className="rounded-[20px] border border-border bg-card p-7">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-base font-extrabold">Rastreamento do pedido</div>
            {order.trackingCode && (
              <div className="flex items-center gap-2">
                <span className="rounded-[10px] border border-dashed border-accent/50 bg-page px-3.5 py-1.5 font-mono text-[13px] text-accent">
                  {order.trackingCode}
                </span>
                {order.trackingUrl && (
                  <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="text-[12.5px] font-extrabold text-accent">
                    Ver na transportadora ↗
                  </a>
                )}
              </div>
            )}
          </div>
          <OrderTimeline steps={order.steps} />
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="rounded-[20px] border border-border bg-card p-6">
            <div className="mb-3.5 text-sm font-extrabold">Itens do pedido</div>
            {order.lineItems.map((li, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <div className="stripe-placeholder h-12 w-12 flex-shrink-0 rounded-xl border border-border-strong" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold leading-tight">{li.name}</div>
                  <div className="mt-0.5 text-[12.5px] font-extrabold text-accent">{li.price}</div>
                </div>
              </div>
            ))}
            <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm">
              <span className="font-bold text-fg-tertiary">Total</span>
              <span className="font-extrabold text-accent">{order.total}</span>
            </div>
          </div>

          {order.address && (
            <div className="rounded-[20px] border border-border bg-card p-6">
              <div className="mb-3 text-sm font-extrabold">Endereço de entrega</div>
              <div className="text-[13.5px] leading-relaxed text-fg-secondary">
                {user.name}
                <br />
                {order.address.rua}
                {order.address.complemento ? ` — ${order.address.complemento}` : ''}
                <br />
                {order.address.bairro}
                <br />
                CEP {order.address.cep}
              </div>
            </div>
          )}

          <a
            href={supportLink}
            target="_blank"
            rel="noreferrer"
            className="block rounded-2xl border border-border-hover bg-[#1c1c21] py-3.5 text-center text-[13.5px] font-extrabold transition-all hover:border-accent hover:text-accent"
          >
            Falar com o suporte
          </a>
        </div>
      </div>
    </div>
  );
}
