'use client';

import Link from 'next/link';
import { PlaceholderImage } from '@/components/ui/PlaceholderImage';
import { GlowBorder, glowMouseMove, glowMouseLeave } from '@/components/ui/GlowBorder';
import { formatBRL } from '@/lib/format';
import { PARCELAS_SEM_JUROS, parcelaSemJuros } from '@/lib/parcelamento';
import type { ProductCard } from '@/lib/data/catalog';

const MIN_RELATED_TO_SHOW = 3;

export function RelatedProducts({ products }: { products: ProductCard[] }) {
  if (products.length < MIN_RELATED_TO_SHOW) return null;
  return (
    <section className="mx-auto max-w-[1280px] px-6 pb-20 pt-20">
      <h2 className="mb-6 titulo text-[28px]">Produtos relacionados</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
        {products.map((p) => {
          const activePrice = p.promoPrice ?? p.price;
          return (
            <Link
              key={p.id}
              href={`/produto/${p.sku}`}
              onMouseMove={glowMouseMove}
              onMouseLeave={glowMouseLeave}
              className="relative block overflow-hidden rounded-[20px] border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-border-hover"
            >
              <GlowBorder />
              <PlaceholderImage label={p.image} src={p.imageUrl} className="aspect-square" sizes="250px" />
              <div className="p-4.5">
                <div className="mb-1 text-[11px] font-bold uppercase tracking-[.1em] text-fg-tertiary">{p.category}</div>
                <div className="mb-2.5 text-[14.5px] font-extrabold leading-snug">{p.name}</div>
                <div className="titulo text-[20px] text-ouro-claro">{formatBRL(activePrice)}</div>
                <div className="text-xs text-fg-tertiary">{PARCELAS_SEM_JUROS}× de {formatBRL(parcelaSemJuros(activePrice))}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
