import { CategoryScroller } from './CategoryScroller';

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
      <CategoryScroller categories={categories} />
    </section>
  );
}
