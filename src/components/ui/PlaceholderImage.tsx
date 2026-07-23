import Image from 'next/image';
import clsx from 'clsx';

export function PlaceholderImage({
  label,
  src,
  className,
  textClassName,
  sizes,
}: {
  label: string;
  src?: string | null;
  className?: string;
  textClassName?: string;
  sizes?: string;
}) {
  if (src) {
    return (
      <div className={clsx('relative overflow-hidden', className)}>
        <Image src={src} alt={label} fill sizes={sizes ?? '(min-width: 640px) 320px, 50vw'} className="object-cover" />
      </div>
    );
  }
  return (
    <div className={clsx('stripe-placeholder grid place-items-center', className)}>
      <span className={clsx('font-mono text-fg-faded text-center px-4', textClassName ?? 'text-xs')}>
        [ foto: {label} ]
      </span>
    </div>
  );
}
