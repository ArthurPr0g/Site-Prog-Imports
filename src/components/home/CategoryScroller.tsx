'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { CategoryCard } from './Categories';

export function CategoryScroller({ categories }: { categories: CategoryCard[] }) {
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
  }, [categories.length]);

  function scrollByAmount(dir: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  }

  return (
    <div className="relative">
      {canScrollLeft && (
        <button
          onClick={() => scrollByAmount(-1)}
          aria-label="Categorias anteriores"
          className="absolute left-1 top-22 z-2 grid h-11 w-11 -translate-y-1/2 -translate-x-1/2 place-items-center rounded-full border border-border-strong bg-page/85 text-lg text-fg shadow-[0_8px_24px_rgba(0,0,0,.5)] backdrop-blur-md transition-all hover:border-accent hover:text-accent active:scale-95 sm:top-30"
        >
          ‹
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scrollByAmount(1)}
          aria-label="Próximas categorias"
          className="absolute right-1 top-22 z-2 grid h-11 w-11 -translate-y-1/2 translate-x-1/2 place-items-center rounded-full border border-border-strong bg-page/85 text-lg text-fg shadow-[0_8px_24px_rgba(0,0,0,.5)] backdrop-blur-md transition-all hover:border-accent hover:text-accent active:scale-95 sm:top-30"
        >
          ›
        </button>
      )}
      <div
        ref={scrollerRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-10 overflow-x-auto px-6 pb-3"
        style={{ scrollBehavior: 'smooth' }}
      >
        {categories.map((c) => (
          <Link
            key={c.name}
            href={c.href}
            className="group flex w-44 flex-shrink-0 snap-start flex-col items-center gap-5 text-center sm:w-60"
          >
            <div className="relative h-44 w-44 transition-transform duration-500 ease-out group-hover:-translate-y-2 sm:h-60 sm:w-60">
              {c.imageUrl ? (
                <Image
                  src={c.imageUrl}
                  alt={c.name}
                  fill
                  sizes="(min-width: 640px) 240px, 176px"
                  className="object-contain drop-shadow-[0_16px_32px_rgba(0,0,0,.5)] transition-transform duration-500 ease-out group-hover:scale-110"
                />
              ) : (
                <div className="grid h-full w-full place-items-center">
                  <div className="grid h-20 w-20 place-items-center rounded-2xl border border-accent/30 bg-accent/10 font-display text-lg font-bold text-accent transition-transform duration-500 ease-out group-hover:scale-110 sm:h-24 sm:w-24 sm:text-xl">
                    {c.glyph}
                  </div>
                </div>
              )}
            </div>
            <div className="text-base font-extrabold text-fg transition-colors duration-200 group-hover:text-accent sm:text-[19px]">
              {c.name}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
