'use client';

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
  const { add, openCart } = useCart();

  if (slides.length === 0) return null;

  return (
    <section className="mx-auto mt-6 max-w-[1280px] px-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {slides.map((slide) => (
          <div
            key={slide.id}
            className="relative flex flex-col overflow-hidden rounded-2xl border border-border bg-[linear-gradient(145deg,#101014_0%,#0c0c10_60%,#141018_100%)] p-5"
          >
            <div
              className="pointer-events-none absolute right-0 top-0 h-40 w-40 -translate-y-1/3 translate-x-1/3 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(242,135,5,.16) 0%, rgba(242,135,5,0) 70%)' }}
            />
            <div className="stripe-placeholder relative z-1 mb-4 grid h-28 place-items-center rounded-xl border border-border-strong sm:h-32">
              <div className="px-3 text-center font-mono text-[11px] text-fg-faded">[ foto: {slide.image} ]</div>
            </div>
            <div className="relative z-1 mb-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-accent/35 bg-accent/12 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.08em] text-accent">
              {slide.tag}
            </div>
            <h3 className="mb-1.5 font-display text-lg font-bold leading-tight tracking-[-.01em]">{slide.title}</h3>
            <p className="mb-4 text-[12.5px] leading-relaxed text-fg-secondary line-clamp-2">{slide.subtitle}</p>
            <div className="mt-auto flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  add({ id: slide.id, sku: slide.sku, name: slide.title, price: slide.price });
                  openCart();
                }}
                className="flex-shrink-0 rounded-full bg-accent px-4.5 py-2.5 text-[12.5px] font-extrabold text-page shadow-[0_6px_18px_rgba(242,135,5,.3)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(242,135,5,.45)]"
              >
                Comprar agora
              </button>
              <div className="text-right text-[10.5px] text-fg-tertiary">
                <div className="text-sm font-extrabold text-fg">{formatBRL(slide.price)}</div>
                12x de {formatParcel(slide.price)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
