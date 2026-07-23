'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlaceholderImage } from '@/components/ui/PlaceholderImage';
import { formatBRL, formatParcel } from '@/lib/format';
import { toggleFavoriteAction } from '@/app/actions/account';
import { useToast } from '@/components/ui/Toast';

export function FavoriteCard({
  productId,
  sku,
  name,
  category,
  price,
  image,
  imageUrl,
}: {
  productId: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  image: string;
  imageUrl: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  return (
    <div className="overflow-hidden rounded-[20px] border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-border-hover">
      <div className="relative h-37.5">
        <PlaceholderImage label={image} src={imageUrl} className="h-full" sizes="240px" />
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await toggleFavoriteAction(productId, true);
              if (!result.ok) {
                toast(result.message);
                return;
              }
              router.refresh();
            })
          }
          className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full border border-border-hover bg-page/70 text-sm text-accent hover:border-accent"
        >
          ♥
        </button>
      </div>
      <div className="p-4.5">
        <div className="mb-1 text-[11px] font-bold uppercase tracking-[.1em] text-fg-tertiary">{category}</div>
        <Link href={`/produto/${sku}`} className="mb-2 block text-sm font-extrabold leading-snug">
          {name}
        </Link>
        <div className="font-display text-lg font-bold">{formatBRL(price)}</div>
        <div className="text-xs text-fg-tertiary">12x de {formatParcel(price)}</div>
      </div>
    </div>
  );
}
