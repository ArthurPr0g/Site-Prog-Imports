'use client';

import { useMemo, useState } from 'react';
import { formatBRL, formatParcel } from '@/lib/format';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { useCart } from '@/lib/cart-context';

export function BuyBox({
  productId,
  sku,
  name,
  price,
  promoPrice,
  image,
  imageUrl,
}: {
  productId: string;
  sku: string;
  name: string;
  price: number;
  promoPrice: number | null;
  image: string;
  imageUrl: string | null;
}) {
  const [qty, setQty] = useState(1);
  const { favorites, toggleFavorite, add, openCart } = useCart();
  const isFav = !!favorites[productId];
  const activePrice = promoPrice ?? price;
  const hasPromo = !!promoPrice && promoPrice < price;
  const pixPrice = hasPromo ? activePrice * 0.95 : activePrice;
  const discountPct = hasPromo ? Math.round((1 - promoPrice! / price) * 100) : 0;

  const waLink = useMemo(() => {
    const msg = `Olá! Tenho interesse no ${name} (${qty}x) — ${formatBRL(activePrice * qty)}. Pode me passar mais detalhes?`;
    return buildWhatsAppLink(msg);
  }, [name, qty, activePrice]);

  function handleBuyClick() {
    add({ id: productId, sku, name, price: activePrice, image, imageUrl }, false, qty);
  }

  function handleAddToCart() {
    add({ id: productId, sku, name, price: activePrice, image, imageUrl }, false, qty);
  }

  return (
    <div>
      <div className="mb-4.5 rounded-[20px] border border-border bg-card p-6">
        {hasPromo && <div className="text-sm text-fg-tertiary line-through">{formatBRL(price)}</div>}
        <div className="flex items-baseline gap-3">
          <span className="font-display text-[38px] font-bold">{formatBRL(activePrice)}</span>
          {hasPromo && (
            <span className="rounded-full border border-accent/40 bg-accent/12 px-2.5 py-1 text-xs font-extrabold text-accent">
              −{discountPct}%
            </span>
          )}
        </div>
        <div className="mt-1.5 text-sm text-fg-secondary">
          ou <strong className="text-fg">12x de {formatParcel(activePrice)}</strong> sem juros
          {hasPromo && (
            <>
              {' '}
              · <span className="font-bold text-accent">{formatBRL(pixPrice)} no Pix</span>
            </>
          )}
        </div>
      </div>
      <div className="mb-3 flex gap-3">
        <div className="flex items-center gap-3 rounded-2xl border border-border-strong bg-card px-2">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-12 w-9 text-lg">
            −
          </button>
          <span className="min-w-4.5 text-center text-[15px] font-extrabold">{qty}</span>
          <button onClick={() => setQty((q) => q + 1)} className="h-12 w-9 text-lg">
            +
          </button>
        </div>
        <button
          onClick={handleAddToCart}
          className="flex flex-1 items-center justify-center rounded-2xl border border-border-hover bg-[#1c1c21] text-[15px] font-extrabold transition-all hover:border-accent hover:bg-accent hover:text-page"
        >
          Adicionar ao carrinho
        </button>
        <button
          onClick={() => toggleFavorite(productId)}
          className="h-12 w-12 flex-shrink-0 rounded-2xl border border-border-strong bg-card text-lg transition-all hover:border-accent"
          style={{ color: isFav ? '#F28705' : '#a8a8b0' }}
        >
          {isFav ? '♥' : '♡'}
        </button>
      </div>
      <a
        href={waLink}
        target="_blank"
        rel="noreferrer"
        onClick={() => {
          handleBuyClick();
          openCart();
        }}
        className="mb-3.5 flex items-center justify-center rounded-2xl bg-accent py-3.5 text-[15px] font-extrabold text-page shadow-[0_8px_28px_rgba(242,135,5,.3)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(242,135,5,.45)]"
      >
        Comprar agora
      </a>
      <div className="flex flex-col gap-2.5 rounded-2xl border border-divider-strong bg-card-dark px-5 py-4.5 text-[13.5px] text-fg-secondary">
        <div><span className="mr-2 font-extrabold text-accent">✓</span>Modelo exclusivo do mercado americano — não vendido no Brasil</div>
        <div><span className="mr-2 font-extrabold text-accent">✓</span>Garantia de 12 meses + suporte pós-venda Prog Imports</div>
        <div><span className="mr-2 font-extrabold text-accent">✓</span>Rastreamento completo da importação, etapa por etapa</div>
        <div><span className="mr-2 font-extrabold text-accent">✓</span>Frete grátis — envio segurado para todo o Brasil</div>
      </div>
    </div>
  );
}
