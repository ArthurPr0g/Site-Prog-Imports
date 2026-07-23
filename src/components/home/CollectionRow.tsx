'use client';

import { useEffect, useRef, useState } from 'react';
import { ProductCardTile } from './ProductCardTile';
import type { ProductCard } from '@/lib/data/catalog';

export function CollectionRow({ id, title, products }: { id?: string; title: string; products: ProductCard[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateArrows() {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, [products.length]);

  function scrollByAmount(dir: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  }

  if (products.length === 0) return null;

  return (
    <section id={id} className="mx-auto max-w-[1280px] scroll-mt-24 px-6 pt-16">
      <div className="mb-6 flex items-end justify-between gap-5">
        <h2 className="font-display text-[26px] font-bold tracking-[-.02em] sm:text-[32px]">{title}</h2>
      </div>
      <div className="relative">
        {canScrollLeft && (
          <button
            onClick={() => scrollByAmount(-1)}
            aria-label="Produtos anteriores"
            className="absolute left-[-6px] top-1/2 z-2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-border-strong bg-page/85 text-lg text-fg shadow-[0_8px_24px_rgba(0,0,0,.5)] backdrop-blur-md transition-all hover:border-accent hover:text-accent active:scale-95"
          >
            ‹
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scrollByAmount(1)}
            aria-label="Próximos produtos"
            className="absolute right-[-6px] top-1/2 z-2 grid h-11 w-11 -translate-y-1/2 translate-x-1/2 place-items-center rounded-full border border-border-strong bg-page/85 text-lg text-fg shadow-[0_8px_24px_rgba(0,0,0,.5)] backdrop-blur-md transition-all hover:border-accent hover:text-accent active:scale-95"
          >
            ›
          </button>
        )}
        <div ref={scrollerRef} className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:gap-4.5">
          {products.map((p) => (
            <ProductCardTile key={p.id} p={p} className="w-[160px] flex-shrink-0 snap-start sm:w-[270px]" />
          ))}
        </div>
      </div>
    </section>
  );
}
