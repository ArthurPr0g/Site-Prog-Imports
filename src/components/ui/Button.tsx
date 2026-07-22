import clsx from 'clsx';
import Link from 'next/link';
import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react';

const base =
  'inline-flex items-center justify-center gap-2 font-body font-extrabold text-[13.5px] rounded-control transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

const variants = {
  primary:
    'bg-accent text-page shadow-[0_8px_28px_rgba(242,135,5,.3)] hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(242,135,5,.45)]',
  secondary:
    'bg-[#1c1c21] text-fg border border-border-hover hover:border-accent hover:text-accent',
  outline: 'bg-transparent text-fg-secondary border border-border-strong hover:border-accent hover:text-accent',
  ghost: 'bg-transparent text-fg-secondary hover:text-accent',
};

const sizes = {
  sm: 'px-4 py-2 text-xs',
  md: 'px-5 py-3',
  lg: 'px-8 py-4 text-[15px]',
};

type Variant = keyof typeof variants;
type Size = keyof typeof sizes;

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={clsx(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
}

export function LinkButton({
  variant = 'primary',
  size = 'md',
  className,
  children,
  href,
  ...props
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  href: string;
} & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <Link href={href} className={clsx(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </Link>
  );
}
