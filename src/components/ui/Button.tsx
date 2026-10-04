import clsx from 'clsx';
import Link from 'next/link';
import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react';

const base =
  'inline-flex items-center justify-center gap-2 font-body font-extrabold text-[13.5px] rounded-control transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

// O botão principal é marfim com texto ônix, e não ouro.
//
// É o CTA da peça 5A do playbook, e a razão é de hierarquia: o ouro marca
// valor, e numa página o valor é o preço. Botão dourado ao lado de preço
// dourado faz os dois disputarem a mesma função, e quem perde é o preço — que é
// justamente o elemento que o diagnóstico apontou como o mais pedido nos
// comentários. Marfim ainda é o maior contraste disponível sobre ônix, então o
// botão continua sendo a coisa mais visível da tela sem gastar o ouro.
const variants = {
  primary:
    'bg-surface-light text-ink shadow-[0_10px_30px_rgba(0,0,0,.45)] hover:-translate-y-0.5 hover:bg-surface-light-alt hover:shadow-[0_14px_38px_rgba(0,0,0,.55)]',
  secondary:
    'bg-card-hover text-fg border border-border-hover hover:border-fg-faded hover:bg-card',
  outline: 'bg-transparent text-fg-secondary border border-border-strong hover:border-fg-faded hover:text-fg',
  ghost: 'bg-transparent text-fg-secondary hover:text-fg',
  /** O único botão dourado do sistema: quando a ação **é** o valor — fechar a
   *  compra, falar com a loja sobre um preço. Use com a mesma mão com que o
   *  playbook usa o ouro na arte, que é quase nenhuma. */
  ouro: 'bg-ouro text-ink shadow-[0_10px_30px_rgb(var(--brand-accent-rgb)/.25)] hover:-translate-y-0.5 hover:bg-ouro-claro',
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
