import { formatBRL, formatParcel } from '@/lib/format';

export function InstallmentLabel({ price, className }: { price: number; className?: string }) {
  return (
    <div className={className ?? 'text-xs text-fg-tertiary'}>
      ou 12x de {formatParcel(price)} sem juros
    </div>
  );
}

export function PriceBlock({
  price,
  promoPrice,
  size = 'md',
}: {
  price: number;
  promoPrice?: number | null;
  size?: 'md' | 'lg';
}) {
  const active = promoPrice ?? price;
  const hasPromo = !!promoPrice && promoPrice < price;
  return (
    <div>
      {hasPromo && (
        <span className="mr-2 text-sm text-fg-tertiary line-through">{formatBRL(price)}</span>
      )}
      <span className={size === 'lg' ? 'font-display text-[38px] font-bold' : 'font-display text-[22px] font-bold'}>
        {formatBRL(active)}
      </span>
      <InstallmentLabel price={active} className="mt-0.5 text-xs text-fg-tertiary" />
    </div>
  );
}

export function StarRating({ rating = 5, size = 14 }: { rating?: number; size?: number }) {
  return (
    <span className="tracking-[2px] text-accent" style={{ fontSize: size }}>
      {'★★★★★'.slice(0, Math.round(rating))}
      <span className="text-border-hover">{'★★★★★'.slice(Math.round(rating))}</span>
    </span>
  );
}
