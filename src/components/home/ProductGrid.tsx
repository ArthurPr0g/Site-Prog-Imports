'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PlaceholderImage } from '@/components/ui/PlaceholderImage';
import { formatBRL, formatParcel } from '@/lib/format';
import { useCart } from '@/lib/cart-context';
import type { ProductCard } from '@/lib/data/catalog';

const COLLECTION_TABS = ['Todos', 'Lançamentos', 'Promoções', 'Mais vendidos'];

export function ProductGrid({ products, initialFilter }: { products: ProductCard[]; initialFilter?: string }) {
  const [active, setActive] = useState(initialFilter && COLLECTION_TABS.includes(initialFilter) ? initialFilter : 'Todos');
  const { add, favorites, toggleFavorite } = useCart();

  const shown = useMemo(
    () => (active === 'Todos' ? products : products.filter((p) => p.collections.includes(active))),
    [products, active]
  );

  return (
    <section id="produtos" className="mx-auto max-w-[1280px] px-6 pt-20">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="mb-2.5 text-xs font-extrabold uppercase tracking-[.14em] text-accent">
            Destaques da semana
          </div>
          <h2 className="font-display text-[36px] font-bold tracking-[-.02em]">Produtos em destaque</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {COLLECTION_TABS.map((name) => (
            <button
              key={name}
              onClick={() => setActive(name)}
              className="rounded-full border px-4.5 py-2.5 text-[13px] font-bold transition-all"
              style={{
                background: active === name ? '#F28705' : '#151518',
                color: active === name ? '#0a0a0c' : '#a8a8b0',
                borderColor: active === name ? '#F28705' : '#26262b',
              }}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4.5">
        {shown.map((p) => {
          const hasPromo = !!p.promoPrice;
          const activePrice = p.promoPrice ?? p.price;
          const isFav = !!favorites[p.id];
          return (
            <div
              key={p.id}
              className="flex flex-col overflow-hidden rounded-[22px] border border-border bg-card transition-all duration-300 hover:-translate-y-1.5 hover:border-border-hover hover:shadow-[0_24px_48px_rgba(0,0,0,.45)]"
            >
              <Link href={`/produto/${p.sku}`} className="relative block h-[210px]">
                <PlaceholderImage label={p.image} className="h-full" />
                {hasPromo && (
                  <div className="absolute left-3.5 top-3.5 rounded-full bg-accent px-2.5 py-1 text-[11px] font-extrabold tracking-[.06em] text-page">
                    PROMOÇÃO
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    toggleFavorite(p.id);
                  }}
                  className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-border-hover bg-page/70 text-[15px] backdrop-blur-sm hover:border-accent hover:scale-110"
                  style={{ color: isFav ? '#F28705' : '#a8a8b0' }}
                >
                  {isFav ? '♥' : '♡'}
                </button>
              </Link>
              <div className="flex flex-1 flex-col gap-1 p-5">
                <div className="text-[11px] font-bold uppercase tracking-[.1em] text-fg-tertiary">{p.category}</div>
                <Link href={`/produto/${p.sku}`} className="block min-h-10.5 text-base font-extrabold leading-tight">
                  {p.name}
                </Link>
                <div className="mt-2">
                  {hasPromo && (
                    <span className="mr-2 text-[13px] text-fg-tertiary line-through">{formatBRL(p.price)}</span>
                  )}
                  <span className="font-display text-[22px] font-bold">{formatBRL(activePrice)}</span>
                  <div className="mt-0.5 text-xs text-fg-tertiary">ou 12x de {formatParcel(activePrice)} sem juros</div>
                </div>
                <button
                  onClick={() => {
                    add({ id: p.id, sku: p.sku, name: p.name, price: activePrice });
                  }}
                  className="mt-4 rounded-[14px] border border-border-hover bg-[#1c1c21] py-3 text-sm font-extrabold transition-all hover:border-accent hover:bg-accent hover:text-page"
                >
                  Adicionar ao carrinho
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
