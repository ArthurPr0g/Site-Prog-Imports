'use client';

import { useMemo, useState } from 'react';
import { formatBRL, formatParcel } from '@/lib/format';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { useCart } from '@/lib/cart-context';
import type { ProductVariant } from '@/lib/data/catalog';

function variantLabel(v: ProductVariant) {
  return [v.ram, v.storage, v.gpu, v.cpu, v.screenType].filter(Boolean).join(' · ') || 'Configuração padrão';
}

export function BuyBox({
  productId,
  sku,
  name,
  price,
  promoPrice,
  image,
  imageUrl,
  highlights,
  variants,
}: {
  productId: string;
  sku: string;
  name: string;
  price: number;
  promoPrice: number | null;
  image: string;
  imageUrl: string | null;
  highlights: string[];
  variants: ProductVariant[];
}) {
  const [qty, setQty] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(variants[0]?.id ?? null);
  const { favorites, toggleFavorite, add, openCart } = useCart();
  const isFav = !!favorites[productId];

  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? null;
  const basePrice = selectedVariant ? selectedVariant.price : price;
  const activePromoPrice = selectedVariant ? selectedVariant.promoPrice : promoPrice;
  const activePrice = activePromoPrice ?? basePrice;
  const hasPromo = !!activePromoPrice && activePromoPrice < basePrice;
  const pixPrice = hasPromo ? activePrice * 0.95 : activePrice;
  const discountPct = hasPromo ? Math.round((1 - activePromoPrice! / basePrice) * 100) : 0;

  const cartId = selectedVariant ? `${productId}:${selectedVariant.id}` : productId;
  const cartName = selectedVariant ? `${name} — ${variantLabel(selectedVariant)}` : name;

  const waLink = useMemo(() => {
    const msg = `Olá! Tenho interesse no ${cartName} (${qty}x) — ${formatBRL(activePrice * qty)}. Pode me passar mais detalhes?`;
    return buildWhatsAppLink(msg);
  }, [cartName, qty, activePrice]);

  function handleBuyClick() {
    add({ id: cartId, sku, name: cartName, price: activePrice, image, imageUrl }, false, qty);
  }

  function handleAddToCart() {
    add({ id: cartId, sku, name: cartName, price: activePrice, image, imageUrl }, false, qty);
  }

  return (
    <div>
      {variants.length > 0 && (
        <div className="mb-4.5">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Escolha a configuração</div>
          <div className="flex flex-col gap-2">
            {variants.map((v) => {
              const selected = v.id === selectedVariantId;
              const vPrice = v.promoPrice ?? v.price;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVariantId(v.id)}
                  className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 text-left text-[13.5px] transition-all hover:border-accent"
                  style={{ borderColor: selected ? '#F28705' : undefined, background: selected ? 'rgba(242,135,5,.08)' : undefined }}
                >
                  <span className={selected ? 'font-bold text-fg' : 'text-fg-secondary'}>{variantLabel(v)}</span>
                  <span className="flex-shrink-0 font-bold text-accent">{formatBRL(vPrice)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-4.5 rounded-[20px] border border-border bg-card p-6">
        {hasPromo && <div className="text-sm text-fg-tertiary line-through">{formatBRL(basePrice)}</div>}
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
      {highlights.length > 0 && (
        <div className="flex flex-col gap-2.5 rounded-2xl border border-divider-strong bg-card-dark px-5 py-4.5 text-[13.5px] text-fg-secondary">
          {highlights.map((h, i) => (
            <div key={i}>
              <span className="mr-2 font-extrabold text-accent">✓</span>
              {h}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
