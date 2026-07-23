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
      <div className="relative flex min-h-[520px] items-center overflow-hidden rounded-[28px] border border-border bg-[linear-gradient(145deg,#101014_0%,#0c0c10_60%,#141018_100%)]">
        <div
          className="pointer-events-none absolute left-[70%] top-1/2 h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2 animate-hero-glow rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(242,135,5,.18) 0%, rgba(242,135,5,0) 65%)' }}
        />
        <div className="relative z-2 grid w-full grid-cols-1 gap-8 px-6 py-12 md:grid-cols-[1.05fr_.95fr] md:px-16 md:py-14">
          <div key={slide.id} className="animate-slide-up">
            <div className="mb-5.5 inline-flex items-center gap-2 rounded-full border border-accent/35 bg-accent/12 px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-[.12em] text-accent">
              {slide.tag}
            </div>
            <h1 className="mb-4.5 font-display text-[40px] font-bold leading-[1.05] tracking-[-.02em] md:text-[56px]">
              {slide.title}
            </h1>
            <p className="mb-8 max-w-[440px] text-[17px] leading-relaxed text-fg-secondary">{slide.subtitle}</p>
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-3">
              <button
                onClick={() => {
                  add({ id: slide.id, sku: slide.sku, name: slide.title, price: slide.price });
                  openCart();
                }}
                className="rounded-full bg-accent px-8 py-4 text-[15px] font-extrabold text-page shadow-[0_8px_32px_rgba(242,135,5,.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_44px_rgba(242,135,5,.5)]"
              >
                Comprar agora
              </button>
              <div className="text-sm text-fg-tertiary">
                <span className="text-lg font-extrabold text-fg">{formatBRL(slide.price)}</span>
                <br />
                ou 12x de {formatParcel(slide.price)}
              </div>
            </div>
          </div>
          <div
            key={slide.id + '-img'}
            className="stripe-placeholder grid h-[280px] animate-slide-up place-items-center rounded-[20px] border border-border-strong md:h-[380px]"
          >
            <div className="font-mono text-[13px] text-fg-faded">[ foto: {slide.image} ]</div>
          </div>
        </div>
        <div className="absolute bottom-6 left-6 z-3 flex gap-2 md:left-16">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setIdx(i)}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{ width: i === idx ? 28 : 10, background: i === idx ? '#F28705' : '#3c3c44' }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
