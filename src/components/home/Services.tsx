import type { Tables } from '@/lib/supabase/database.types';

export function Services({ services }: { services: Tables<'services'>[] }) {
  return (
    <section id="servicos" className="mx-auto max-w-[1280px] px-6 pt-22">
      <div className="mb-9 text-center">
        <div className="mb-2.5 text-xs font-extrabold uppercase tracking-[.14em] text-accent">
          Assistência especializada
        </div>
        <h2 className="font-display text-[36px] font-bold tracking-[-.02em]">Serviços técnicos</h2>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5">
        {services.map((s) => (
          <div
            key={s.id}
            className="rounded-[20px] border border-border bg-card p-7 transition-all duration-300 hover:-translate-y-1 hover:border-accent/55"
          >
            <div className="mb-4.5 grid h-10 w-10 place-items-center rounded-xl border border-accent/30 bg-accent/10 font-display text-sm font-bold text-accent">
              {s.glyph}
            </div>
            <div className="mb-1.5 text-[15px] font-extrabold">{s.name}</div>
            <div className="text-[13px] leading-normal text-fg-tertiary">{s.description}</div>
            <div className="mt-4 text-[13px] font-extrabold text-accent">{s.price_label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
