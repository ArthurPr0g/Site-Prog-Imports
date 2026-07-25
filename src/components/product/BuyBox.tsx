'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatBRL, formatParcel } from '@/lib/format';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { useCart } from '@/lib/cart-context';
import { VARIANT_DIM_LABELS, VARIANT_DIM_ORDER, VARIANT_DIM_CANONICAL, sortByCanonicalOrder } from '@/lib/product-specs';
import type { ProductCard } from '@/lib/data/catalog';

type DimKey = (typeof VARIANT_DIM_ORDER)[number];

export function BuyBox({
  productId,
  sku,
  name,
  price,
  promoPrice,
  image,
  imageUrl,
  highlights,
  siblings,
}: {
  productId: string;
  sku: string;
  name: string;
  price: number;
  promoPrice: number | null;
  image: string;
  imageUrl: string | null;
  highlights: string[];
  siblings: ProductCard[];
}) {
  const [qty, setQty] = useState(1);
  const { favorites, toggleFavorite, add, openCart } = useCart();
  const isFav = !!favorites[productId];

  const current = useMemo(() => siblings.find((s) => s.sku === sku) ?? null, [siblings, sku]);

  // Só mostra como campo de escolha as dimensões que realmente mudam entre as
  // variações do grupo (ex: se todas têm o mesmo processador, não faz
  // sentido pedir pra escolher processador).
  const differingDims = useMemo(
    () => VARIANT_DIM_ORDER.filter((dim) => new Set(siblings.map((s) => s[dim]).filter(Boolean)).size > 1),
    [siblings]
  );

  function dimOptions(dim: DimKey): string[] {
    const values = [...new Set(siblings.map((s) => s[dim]).filter(Boolean))];
    const canonical = VARIANT_DIM_CANONICAL[dim];
    return canonical.length ? sortByCanonicalOrder(values, canonical) : values.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  // Ao clicar numa opção, navega pro produto-irmão que bate com esse valor
  // (preferindo um que também bata com as outras dimensões já "ativas" no
  // produto atual, senão o primeiro que tiver esse valor).
  function siblingFor(dim: DimKey, value: string): ProductCard | null {
    const candidates = siblings.filter((s) => s[dim] === value);
    if (!current) return candidates[0] ?? null;
    const stillMatches = candidates.find((s) => differingDims.every((d) => d === dim || s[d] === current[d]));
    return stillMatches ?? candidates[0] ?? null;
  }

  const hasPromo = !!promoPrice && promoPrice < price;
  const activePrice = promoPrice ?? price;
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
      {differingDims.length > 0 && (
        <div className="mb-4.5 flex flex-col gap-3.5">
          {differingDims.map((dim) => (
            <div key={dim}>
              <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">{VARIANT_DIM_LABELS[dim]}</div>
              <div className="flex flex-wrap gap-2">
                {dimOptions(dim).map((value) => {
                  const selected = current?.[dim] === value;
                  const target = siblingFor(dim, value);
                  const pillStyle = {
                    borderColor: selected ? '#F28705' : undefined,
                    background: selected ? 'rgba(242,135,5,.12)' : undefined,
                    color: selected ? '#F28705' : undefined,
                  };
                  if (selected || !target) {
                    return (
                      <span
                        key={value}
                        className="inline-block rounded-full border px-4 py-2 text-[13px] font-bold"
                        style={pillStyle}
                      >
                        {value}
                      </span>
                    );
                  }
                  return (
                    <Link
                      key={value}
                      href={`/produto/${target.sku}`}
                      className="inline-block rounded-full border px-4 py-2 text-[13px] font-bold transition-all hover:border-accent"
                      style={pillStyle}
                    >
                      {value}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {differingDims.length === 0 && siblings.length > 1 && (
        <div className="mb-4.5">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Escolha a configuração</div>
          <div className="flex flex-col gap-2">
            {siblings.map((s) => {
              const selected = s.sku === sku;
              const sPrice = s.promoPrice ?? s.price;
              return (
                <Link
                  key={s.id}
                  href={`/produto/${s.sku}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 text-left text-[13.5px] transition-all hover:border-accent"
                  style={{ borderColor: selected ? '#F28705' : undefined, background: selected ? 'rgba(242,135,5,.08)' : undefined }}
                >
                  <span className={selected ? 'font-bold text-fg' : 'text-fg-secondary'}>{s.name}</span>
                  <span className="flex-shrink-0 font-bold text-accent">{formatBRL(sPrice)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

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
