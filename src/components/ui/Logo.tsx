import Image from 'next/image';
import clsx from 'clsx';

export function Logo({ height = 60, className }: { height?: number; className?: string }) {
  return (
    <Image
      src="/images/logo.png"
      alt="Prog Imports"
      height={height}
      width={height * 2.87}
      className={clsx('h-auto w-auto object-contain', className)}
      style={{ height }}
      priority
    />
  );
}
