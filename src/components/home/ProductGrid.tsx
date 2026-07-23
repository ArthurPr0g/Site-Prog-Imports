'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlaceholderImage } from '@/components/ui/PlaceholderImage';
import { GlowBorder, glowMouseMove, glowMouseLeave } from '@/components/ui/GlowBorder';
import { formatBRL, formatParcel } from '@/lib/format';
import { useCart } from '@/lib/cart-context';
import type { ProductCard } from '@/lib/data/catalog';

const COLLECTION_TABS = ['Todos', 'Lançamentos', 'Promoções', 'Mais vendidos'];

export function ProductGrid({
  products,
  initialFilter,
  activeCategoria,
}: {
  products: ProductCard[];
  initialFilter?: string;
  activeCategoria?: string;
}) {
  const [active, setActive] = useState(initialFilter && COLLECTION_TABS.includes(initialFilter) ? initialFilter : 'Todos');
  const { add, favorites, toggleFavorite } = useCart();
  const router = useRouter();

  const shown = useMemo(
    () => (active === 'Todos' ? products : products.filter((p) => p.collections.includes(active))),
    [products, active]
  );

  // "Todos" também precisa limpar o filtro de categoria vindo do carrossel (via
  // URL) — sem isso, o clique só resetava a aba de coleção e a lista continuava
  // restrita à categoria selecionada.
  function selectTab(name: string) {
    setActive(name);
    if (name === 'Todos' && activeCategoria) router.push('/#produtos');
  }

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
              onClick={() => selectTab(name)}
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] sm:gap-4.5">
        {shown.map((p) => {
          const hasPromo = !!p.promoPrice;
          const activePrice = p.promoPrice ?? p.price;
          const isFav = !!favorites[p.id];
          return (
            <div
              key={p.id}
              onMouseMove={glowMouseMove}
              onMouseLeave={glowMouseLeave}
              className="relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1.5 hover:border-border-hover hover:shadow-[0_24px_48px_rgba(0,0,0,.45)] sm:rounded-[22px]"
            >
              <GlowBorder />
              <Link href={`/produto/${p.sku}`} className="relative block h-[130px] sm:h-[210px]">
                <PlaceholderImage label={p.image} src={p.imageUrl} className="h-full" textClassName="hidden sm:block text-xs" sizes="(min-width: 640px) 280px, 50vw" />
                {hasPromo && (
                  <div className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[9px] font-extrabold tracking-[.06em] text-page sm:left-3.5 sm:top-3.5 sm:px-2.5 sm:py-1 sm:text-[11px]">
                    PROMOÇÃO
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    toggleFavorite(p.id);
                  }}
                  className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full border border-border-hover bg-page/70 text-xs backdrop-blur-sm hover:border-accent hover:scale-110 sm:right-3 sm:top-3 sm:h-9 sm:w-9 sm:text-[15px]"
                  style={{ color: isFav ? '#F28705' : '#a8a8b0' }}
                >
                  {isFav ? '♥' : '♡'}
                </button>
              </Link>
              <div className="flex flex-1 flex-col gap-1 p-3 sm:p-5">
                <div className="text-[9.5px] font-bold uppercase tracking-[.08em] text-fg-tertiary sm:text-[11px] sm:tracking-[.1em]">
                  {p.category}
                </div>
                <Link
                  href={`/produto/${p.sku}`}
                  className="block text-[12.5px] font-extrabold leading-snug sm:min-h-10.5 sm:text-base sm:leading-tight"
                >
                  {p.name}
                </Link>
                <div className="mt-1 sm:mt-2">
                  {hasPromo && (
                    <span className="mr-1.5 text-[11px] text-fg-tertiary line-through sm:mr-2 sm:text-[13px]">
                      {formatBRL(p.price)}
                    </span>
                  )}
                  <span className="font-display text-base font-bold sm:text-[22px]">{formatBRL(activePrice)}</span>
                  <div className="mt-0.5 text-[10px] text-fg-tertiary sm:text-xs">
                    ou 12x de {formatParcel(activePrice)} sem juros
                  </div>
                </div>
                <button
                  onClick={() => {
                    add({ id: p.id, sku: p.sku, name: p.name, price: activePrice, image: p.image, imageUrl: p.imageUrl });
                  }}
                  className="mt-auto rounded-xl border border-border-hover bg-[#1c1c21] pb-2 pt-3 text-[11.5px] font-extrabold transition-all hover:border-accent hover:bg-accent hover:text-page sm:rounded-[14px] sm:pb-3 sm:pt-4 sm:text-sm"
                >
                  <span className="sm:hidden">Adicionar</span>
                  <span className="hidden sm:inline">Adicionar ao carrinho</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
