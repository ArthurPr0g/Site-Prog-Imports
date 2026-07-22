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
        className="no-scrollbar flex snap-x snap-mandatory gap-9 overflow-x-auto px-6 pb-3"
        style={{ scrollBehavior: 'smooth' }}
      >
        {categories.map((c) => (
          <Link
            key={c.name}
            href={c.href}
            className="group flex w-44 flex-shrink-0 snap-start flex-col items-start gap-4"
          >
            <div className="relative h-44 w-44">
              {c.imageUrl ? (
                <Image
                  src={c.imageUrl}
                  alt={c.name}
                  fill
                  sizes="176px"
                  className="object-contain transition-transform duration-500 ease-out group-hover:scale-105"
                />
              ) : (
                <div className="grid h-full w-full place-items-center">
                  <div className="grid h-20 w-20 place-items-center rounded-2xl border border-accent/30 bg-accent/10 font-display text-lg font-bold text-accent">
                    {c.glyph}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[15px] font-bold text-fg transition-colors duration-200 group-hover:text-accent">
              {c.name}
              <span className="transition-transform duration-300 ease-out group-hover:translate-x-1">→</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
