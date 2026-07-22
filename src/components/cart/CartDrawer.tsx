'use client';

import { useCart } from '@/lib/cart-context';
import { formatBRL } from '@/lib/format';
import { PlaceholderImage } from '@/components/ui/PlaceholderImage';

export function CartDrawer() {
  const {
    items,
    count,
    isOpen,
    closeCart,
    inc,
    dec,
    remove,
    coupon,
    setCoupon,
    couponMessage,
    couponApplied,
    applyCoupon,
    cep,
    setCep,
    frete,
    calcFrete,
    subtotal,
    discount,
    shipping,
    total,
    whatsappCheckoutLink,
  } = useCart();

  return (
    <>
      {isOpen && (
        <div onClick={closeCart} className="fixed inset-0 z-99 bg-black/60 backdrop-blur-sm" />
      )}
      <aside
        className="fixed right-0 top-0 z-100 flex h-full w-full max-w-[420px] flex-col border-l border-border-strong bg-card transition-transform duration-400"
        style={{ transform: isOpen ? 'translateX(0)' : 'translateX(105%)', transitionTimingFunction: 'cubic-bezier(.22,1,.36,1)' }}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-5.5">
          <div className="font-display text-[19px] font-bold">
            Seu carrinho <span className="text-accent">({count})</span>
          </div>
          <button
            onClick={closeCart}
            className="grid h-8.5 w-8.5 place-items-center rounded-full border border-border-strong text-fg-secondary hover:border-accent hover:text-accent"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-6 py-4">
          {items.length === 0 && (
            <div className="py-16 text-center text-sm text-fg-tertiary">
              Seu carrinho está vazio.
              <br />
              <span className="text-[13px]">Adicione produtos para continuar.</span>
            </div>
          )}
          {items.map((it) => (
            <div key={it.id} className="flex gap-3.5 rounded-2xl border border-border bg-input p-3.5">
              <PlaceholderImage label={it.name} className="h-16 w-16 flex-shrink-0 rounded-xl" textClassName="hidden" />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-extrabold leading-tight">{it.name}</div>
                <div className="mt-1 text-[13px] font-extrabold text-accent">{formatBRL(it.price * it.qty)}</div>
                <div className="mt-2 flex items-center gap-2.5">
                  <button
                    onClick={() => dec(it.id)}
                    className="h-6.5 w-6.5 rounded-lg border border-border-hover bg-[#1c1c21] text-[13px]"
                  >
                    −
                  </button>
                  <span className="min-w-4 text-center text-[13px] font-extrabold">{it.qty}</span>
                  <button
                    onClick={() => inc(it.id)}
                    className="h-6.5 w-6.5 rounded-lg border border-border-hover bg-[#1c1c21] text-[13px]"
                  >
                    +
                  </button>
                  <button
                    onClick={() => remove(it.id)}
                    className="ml-auto text-xs text-fg-tertiary underline hover:text-accent"
                  >
                    remover
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {items.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-border px-6 py-4.5">
            <div className="flex gap-2">
              <input
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                placeholder="Cupom (ex: PROG10)"
                className="flex-1 rounded-control border border-border-strong bg-input px-4 py-2.5 text-[13px] uppercase outline-none focus:border-accent"
              />
              <button
                onClick={applyCoupon}
                className="rounded-control border border-border-hover bg-[#1c1c21] px-4.5 py-2.5 text-[13px] font-extrabold hover:border-accent"
              >
                Aplicar
              </button>
            </div>
            {couponMessage && (
              <div className={`text-[12.5px] font-bold ${couponApplied ? 'text-accent' : 'text-error'}`}>
                {couponMessage}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={cep}
                onChange={(e) => setCep(e.target.value)}
                placeholder="CEP para frete"
                className="flex-1 rounded-control border border-border-strong bg-input px-4 py-2.5 text-[13px] outline-none focus:border-accent"
              />
              <button
                onClick={calcFrete}
                className="rounded-control border border-border-hover bg-[#1c1c21] px-4.5 py-2.5 text-[13px] font-extrabold hover:border-accent"
              >
                Calcular
              </button>
            </div>
            <div className="mt-1 flex flex-col gap-1.5 text-[13.5px] text-fg-secondary">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-bold text-fg">{formatBRL(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between">
                  <span>Desconto</span>
                  <span className="font-bold text-accent">−{formatBRL(discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Frete</span>
                <span className="font-bold text-fg">
                  {frete === null ? 'calcule acima' : shipping === 0 ? 'Grátis' : formatBRL(shipping)}
                </span>
              </div>
              <div className="mt-1.5 flex justify-between border-t border-border pt-2.5 text-base">
                <span className="font-extrabold">Total</span>
                <span className="font-display text-[19px] font-extrabold text-accent">{formatBRL(total)}</span>
              </div>
            </div>
            <a
              href={whatsappCheckoutLink}
              target="_blank"
              rel="noreferrer"
              className="block rounded-2xl bg-accent py-4 text-center text-[15px] font-extrabold text-page shadow-[0_8px_28px_rgba(242,135,5,.3)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(242,135,5,.45)]"
            >
              Finalizar pelo WhatsApp
            </a>
          </div>
        )}
      </aside>
    </>
  );
}
