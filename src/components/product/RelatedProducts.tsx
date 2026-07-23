import Link from 'next/link';
import { PlaceholderImage } from '@/components/ui/PlaceholderImage';
import { formatBRL, formatParcel } from '@/lib/format';
import type { ProductCard } from '@/lib/data/catalog';

export function RelatedProducts({ products }: { products: ProductCard[] }) {
  if (products.length === 0) return null;
  return (
    <section className="mx-auto max-w-[1280px] px-6 pb-20 pt-20">
      <h2 className="mb-6 font-display text-[28px] font-bold tracking-[-.02em]">Produtos relacionados</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
        {products.map((p) => {
          const activePrice = p.promoPrice ?? p.price;
          return (
            <Link
              key={p.id}
              href={`/produto/${p.sku}`}
              className="block overflow-hidden rounded-[20px] border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-border-hover"
            >
              <PlaceholderImage label={p.image} src={p.imageUrl} className="h-40" sizes="250px" />
              <div className="p-4.5">
                <div className="mb-1 text-[11px] font-bold uppercase tracking-[.1em] text-fg-tertiary">{p.category}</div>
                <div className="mb-2.5 text-[14.5px] font-extrabold leading-snug">{p.name}</div>
                <div className="font-display text-lg font-bold">{formatBRL(activePrice)}</div>
                <div className="text-xs text-fg-tertiary">12x de {formatParcel(activePrice)}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
