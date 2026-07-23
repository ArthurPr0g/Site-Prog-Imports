import Link from 'next/link';
import { ProductCardTile } from './ProductCardTile';
import type { ProductCard } from '@/lib/data/catalog';

export function ProductGrid({ products, activeCategoria }: { products: ProductCard[]; activeCategoria?: string }) {
  return (
    <section id="produtos" className="mx-auto max-w-[1280px] px-6 pt-20">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="mb-2.5 text-xs font-extrabold uppercase tracking-[.14em] text-accent">
            {activeCategoria ? 'Filtrando por categoria' : 'Destaques da semana'}
          </div>
          <h2 className="font-display text-[36px] font-bold tracking-[-.02em]">
            {activeCategoria ? activeCategoria : 'Produtos em destaque'}
          </h2>
        </div>
        {activeCategoria && (
          <Link
            href="/#produtos"
            className="rounded-full border border-border-hover px-4.5 py-2.5 text-[13px] font-bold text-fg-secondary transition-all hover:border-accent hover:text-accent"
          >
            ✕ Limpar filtro
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] sm:gap-4.5">
        {products.map((p) => (
          <ProductCardTile key={p.id} p={p} />
        ))}
      </div>
    </section>
  );
}
