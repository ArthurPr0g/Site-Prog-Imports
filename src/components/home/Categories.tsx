import Link from 'next/link';
import Image from 'next/image';

export type CategoryCard = {
  name: string;
  glyph: string;
  imageUrl: string | null;
  count: string;
  href: string;
};

export function Categories({ categories }: { categories: CategoryCard[] }) {
  return (
    <section id="categorias" className="mx-auto max-w-[1280px] pt-18">
      <div className="mb-8 flex items-end justify-between px-6">
        <div>
          <div className="mb-2.5 text-xs font-extrabold uppercase tracking-[.14em] text-accent">
            Navegue por categoria
          </div>
          <h2 className="font-display text-[36px] font-bold tracking-[-.02em]">O que você procura hoje?</h2>
        </div>
      </div>
      <div
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2"
        style={{ scrollBehavior: 'smooth' }}
      >
        {categories.map((c) => (
          <Link
            key={c.name}
            href={c.href}
            className="group relative flex h-70 w-55 flex-shrink-0 snap-start flex-col justify-end overflow-hidden rounded-[20px] border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-accent/55"
          >
            {c.imageUrl ? (
              <>
                <Image
                  src={c.imageUrl}
                  alt={c.name}
                  fill
                  sizes="220px"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <div className="relative z-1 p-5">
                  <div className="mb-1 text-base font-extrabold text-fg">{c.name}</div>
                  <div className="text-xs text-[#d8d8dc]">{c.count}</div>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col justify-between p-6">
                <div className="grid h-11 w-11 place-items-center rounded-xl border border-accent/30 bg-accent/10 font-display text-[15px] font-bold text-accent">
                  {c.glyph}
                </div>
                <div>
                  <div className="mb-1 text-[15px] font-extrabold">{c.name}</div>
                  <div className="text-xs text-fg-tertiary">{c.count}</div>
                </div>
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
