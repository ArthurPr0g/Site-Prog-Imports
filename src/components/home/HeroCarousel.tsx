'use client';

import { useEffect, useState } from 'react';
import { formatBRL, formatParcel } from '@/lib/format';
import { useCart } from '@/lib/cart-context';

export type HeroSlide = {
  id: string;
  sku: string;
  tag: string;
  title: string;
  subtitle: string;
  price: number;
  image: string;
};

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [idx, setIdx] = useState(0);
  const { add, openCart } = useCart();

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => setIdx((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (slides.length === 0) return null;
  const slide = slides[idx];

  return (
    <section className="relative mx-auto mt-6 max-w-[1280px] px-6">
      <div className="relative flex min-h-[260px] items-center overflow-hidden rounded-2xl border border-border bg-[linear-gradient(145deg,#101014_0%,#0c0c10_60%,#141018_100%)]">
        <div
          className="pointer-events-none absolute left-[70%] top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 animate-hero-glow rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(242,135,5,.18) 0%, rgba(242,135,5,0) 65%)' }}
        />
        <div className="relative z-2 grid w-full grid-cols-1 gap-4 px-5 py-6 md:grid-cols-[1.05fr_.95fr] md:px-10 md:py-7">
          <div key={slide.id} className="animate-slide-up">
            <div className="mb-2.5 inline-flex items-center gap-2 rounded-full border border-accent/35 bg-accent/12 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.1em] text-accent">
              {slide.tag}
            </div>
            <h1 className="mb-2 font-display text-[22px] font-bold leading-[1.1] tracking-[-.02em] md:text-[30px]">
              {slide.title}
            </h1>
            <p className="mb-3 max-w-[320px] text-[13px] leading-relaxed text-fg-secondary">{slide.subtitle}</p>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
              <button
                onClick={() => {
                  add({ id: slide.id, sku: slide.sku, name: slide.title, price: slide.price });
                  openCart();
                }}
                className="rounded-full bg-accent px-5 py-2.5 text-[12.5px] font-extrabold text-page shadow-[0_6px_20px_rgba(242,135,5,.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(242,135,5,.5)]"
              >
                Comprar agora
              </button>
              <div className="text-[11px] text-fg-tertiary">
                <span className="text-sm font-extrabold text-fg">{formatBRL(slide.price)}</span>
                <br />
                ou 12x de {formatParcel(slide.price)}
              </div>
            </div>
          </div>
          <div
            key={slide.id + '-img'}
            className="stripe-placeholder grid h-[130px] animate-slide-up place-items-center rounded-2xl border border-border-strong md:h-[170px]"
          >
            <div className="font-mono text-[11px] text-fg-faded">[ foto: {slide.image} ]</div>
          </div>
        </div>
        <div className="absolute bottom-3 left-5 z-3 flex gap-1.5 md:left-10">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setIdx(i)}
              className="h-1 rounded-full transition-all duration-300"
              style={{ width: i === idx ? 18 : 7, background: i === idx ? '#F28705' : '#3c3c44' }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
