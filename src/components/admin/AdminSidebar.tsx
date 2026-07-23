'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { Logo } from '@/components/ui/Logo';

const NAV = [
  { href: '/admin', label: 'Dashboard', glyph: 'DB' },
  { href: '/admin/produtos', label: 'Produtos', glyph: 'PR' },
  { href: '/admin/pedidos', label: 'Pedidos', glyph: 'PD' },
  { href: '/admin/clientes', label: 'Clientes', glyph: 'CL' },
  { href: '/admin/cupons', label: 'Cupons', glyph: 'CP' },
  { href: '/admin/catalogo', label: 'Catálogo', glyph: 'CT' },
  { href: '/admin/banners', label: 'Banners da home', glyph: 'BN' },
  { href: '/admin/servicos', label: 'Serviços', glyph: 'SV' },
  { href: '/admin/depoimentos', label: 'Depoimentos', glyph: 'DP' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-page lg:flex">
      <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-divider-strong bg-card-dark px-4 py-3 lg:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menu do admin"
          className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-border-strong text-base"
        >
          ☰
        </button>
        <Logo height={32} />
        <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-accent">Admin</span>
      </div>

      {open && (
        <div onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" />
      )}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-shrink-0 flex-col border-r border-divider-strong bg-card-dark transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:max-w-none lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-divider-strong px-5 pb-3.5 pt-5">
          <Logo height={44} />
          <div className="text-[10px] font-extrabold uppercase tracking-[.14em] text-accent">Admin</div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="ml-auto grid h-8 w-8 place-items-center rounded-full border border-border-strong text-sm lg:hidden"
          >
            ✕
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
          {NAV.map((item) => {
            const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3.5 py-2.75 text-[13.5px] font-bold transition-all hover:text-accent"
                style={{ background: active ? 'rgba(242,135,5,.1)' : 'transparent', color: active ? '#F28705' : '#a8a8b0' }}
              >
                <span
                  className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-lg font-display text-[11px] font-bold"
                  style={{ background: active ? '#F28705' : '#1c1c21', color: active ? '#0a0a0c' : '#7a7a84' }}
                >
                  {item.glyph}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-divider-strong px-5 py-4 text-xs text-fg-faded">
          <Link href="/" className="font-bold text-fg-tertiary hover:text-accent">
            ← Ver loja
          </Link>
        </div>
      </aside>

      <main className="min-w-0 px-4 pb-12 pt-6 sm:px-6 lg:flex-1 lg:px-8 lg:pt-7">{children}</main>
    </div>
  );
}
