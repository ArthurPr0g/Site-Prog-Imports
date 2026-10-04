'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/conta', label: 'Resumo', glyph: 'RS' },
  { href: '/conta/pedidos', label: 'Meus pedidos', glyph: 'PD' },
  { href: '/conta/favoritos', label: 'Favoritos', glyph: 'FV' },
  { href: '/conta/endereco', label: 'Endereço', glyph: 'EN' },
  { href: '/conta/minha-conta', label: 'Minha conta', glyph: 'CT' },
];

export function AccountSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col gap-0.5 rounded-[20px] border border-border bg-card p-3 md:sticky md:top-24">
      {NAV.map((item) => {
        const active =
          item.href === '/conta' ? pathname === '/conta' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-[13.5px] font-bold transition-all hover:text-accent"
            style={{
        background: active ? 'rgb(var(--brand-accent-rgb) / .1)' : 'transparent',
        color: active ? 'var(--color-accent)' : 'var(--prog-prata-escura)',
      }}
          >
            <span
              className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-lg font-display text-[11px] font-bold"
              style={{ background: active ? 'var(--color-accent)' : 'var(--prog-cartao-hover)', color: active ? 'var(--prog-onix)' : 'var(--prog-grafite-texto)' }}
            >
              {item.glyph}
            </span>
            {item.label}
          </Link>
        );
      })}
    </aside>
  );
}
