import Link from 'next/link';
import clsx from 'clsx';

export function WorkspaceSwitcher({ active }: { active: 'loja' | 'admin' }) {
  return (
    <div className="flex flex-shrink-0 items-center gap-1 rounded-full border border-border-strong bg-input-alt p-1">
      <Link
        href="/"
        className={clsx(
          'rounded-full px-3.5 py-1.5 text-xs font-extrabold transition-colors',
          active === 'loja' ? 'bg-accent text-page' : 'text-fg-secondary hover:text-accent'
        )}
      >
        Loja
      </Link>
      <Link
        href="/admin"
        className={clsx(
          'rounded-full px-3.5 py-1.5 text-xs font-extrabold transition-colors',
          active === 'admin' ? 'bg-accent text-page' : 'text-fg-secondary hover:text-accent'
        )}
      >
        Gerenciamento
      </Link>
    </div>
  );
}
