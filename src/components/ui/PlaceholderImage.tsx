import clsx from 'clsx';

export function PlaceholderImage({
  label,
  className,
  textClassName,
}: {
  label: string;
  className?: string;
  textClassName?: string;
}) {
  return (
    <div className={clsx('stripe-placeholder grid place-items-center', className)}>
      <span className={clsx('font-mono text-fg-faded text-center px-4', textClassName ?? 'text-xs')}>
        [ foto: {label} ]
      </span>
    </div>
  );
}
