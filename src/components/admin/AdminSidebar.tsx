'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-60 flex-shrink-0 flex-col border-r border-divider-strong bg-card-dark">
      <div className="flex items-center gap-2.5 border-b border-divider-strong px-5 pb-3.5 pt-5">
        <Logo height={44} />
        <div className="text-[10px] font-extrabold uppercase tracking-[.14em] text-accent">Admin</div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {NAV.map((item) => {
          const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
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
  );
}
