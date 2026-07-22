import { StarRating } from '@/components/ui/Price';
import { INSTAGRAM_HANDLE } from '@/lib/constants';
import type { Tables } from '@/lib/supabase/database.types';

export function Testimonials({ testimonials }: { testimonials: Tables<'testimonials'>[] }) {
  return (
    <section className="mx-auto max-w-[1280px] px-6 pt-22">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <div className="mb-2.5 text-xs font-extrabold uppercase tracking-[.14em] text-accent">
            Quem compra, confia
          </div>
          <h2 className="font-display text-[36px] font-bold tracking-[-.02em]">Depoimentos</h2>
        </div>
        <a
          href={`https://instagram.com/${INSTAGRAM_HANDLE}`}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-bold text-accent"
        >
          @{INSTAGRAM_HANDLE} ↗
        </a>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
        {testimonials.map((t) => (
          <div
            key={t.id}
            className="rounded-[20px] border border-border bg-card p-7 transition-all duration-300 hover:-translate-y-1 hover:border-border-hover"
          >
            <StarRating />
            <p className="my-3.5 text-[14.5px] leading-relaxed text-[#c9c9d1]">{t.text}</p>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full border border-border-hover bg-[#1c1c21] text-sm font-extrabold text-accent">
                {t.name[0]}
              </div>
              <div>
                <div className="text-sm font-extrabold">{t.name}</div>
                <div className="text-xs text-fg-tertiary">{t.bought}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
