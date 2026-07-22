import Image from 'next/image';
import clsx from 'clsx';

export function Logo({ height = 52, className }: { height?: number; className?: string }) {
  return (
    <Image
      src="/images/logo.png"
      alt="Prog Imports"
      height={height}
      width={height * 3.4}
      className={clsx('h-auto w-auto object-contain', className)}
      style={{ height }}
      priority
    />
  );
}
