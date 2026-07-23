'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { useCart } from '@/lib/cart-context';
import { formatBRL } from '@/lib/format';
import { WorkspaceSwitcher } from '@/components/layout/WorkspaceSwitcher';

export type SearchIndexItem = {
  sku: string;
  name: string;
  category: string;
  price: number;
};

const NAV_LINKS = [
  { href: '/?categoria=MacBook#produtos', label: 'MacBooks' },
  { href: '/?categoria=iPhone#produtos', label: 'iPhones' },
  { href: '/?categoria=Notebook+Gamer#produtos', label: 'Notebooks Gamer' },
  { href: '/?categoria=Monitores#produtos', label: 'Monitores' },
  { href: '/#servicos', label: 'Serviços' },
];

export function Header({
  searchIndex,
  user,
}: {
  searchIndex: SearchIndexItem[];
  user: { name: string; role: string } | null;
}) {
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const { count, favCount, openCart } = useCart();

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return searchIndex
      .filter((p) => (p.name + ' ' + p.category).toLowerCase().includes(q))
      .slice(0, 5);
  }, [query, searchIndex]);

  const showSuggestions = query.trim().length > 0;

  function renderSearch(id: string) {
    return (
      <div className="relative w-full">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar iPhone, MacBook, Alienware…"
          className="w-full rounded-full border border-border-strong bg-input-alt px-4.5 py-2.5 text-sm text-fg outline-none focus:border-accent"
        />
        {showSuggestions && (
          <div
            key={id}
            className="absolute left-0 right-0 top-[calc(100%+8px)] z-10 overflow-hidden rounded-2xl border border-border-strong bg-input-alt shadow-[0_24px_60px_rgba(0,0,0,.6)]"
          >
            {suggestions.map((s) => (
              <Link
                key={s.sku}
                href={`/produto/${s.sku}`}
                onClick={() => setQuery('')}
                className="flex items-center justify-between border-b border-divider-strong px-4.5 py-3 hover:bg-divider-strong"
              >
                <div>
                  <div className="text-sm font-semibold">{s.name}</div>
                  <div className="text-xs text-fg-tertiary">{s.category}</div>
                </div>
                <div className="text-[13px] font-bold text-accent">{formatBRL(s.price)}</div>
              </Link>
            ))}
            {suggestions.length === 0 && (
              <div className="px-4.5 py-3.5 text-[13px] text-fg-tertiary">Nenhum produto encontrado</div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <header className="sticky top-0 z-90 border-b border-divider-strong bg-page/82 backdrop-blur-xl">
      <div className="mx-auto max-w-[1280px] px-4 py-3 sm:px-6 sm:py-3.5">
        <div className="flex items-center gap-3 sm:gap-7">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
            className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-border-strong text-base lg:hidden"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
          <Link href="/" className="flex flex-shrink-0 items-center gap-2.5">
            <Logo height={44} />
          </Link>
          <nav className="hidden gap-5 text-sm font-semibold text-fg-secondary lg:flex">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-accent">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto hidden max-w-[420px] flex-1 md:block">
            {renderSearch('desktop')}
          </div>
          <div className="ml-auto flex flex-shrink-0 items-center gap-2 md:ml-0">
            {user?.role === 'admin' && <WorkspaceSwitcher active="loja" />}
            <Link
              href={user ? '/conta' : '/entrar'}
              title={user ? user.name : 'Entrar'}
              className="grid h-9 flex-shrink-0 place-items-center whitespace-nowrap rounded-full border border-border-strong px-3.5 text-[13px] font-bold hover:border-accent hover:text-accent sm:h-10 sm:px-4"
            >
              {user ? user.name.split(' ')[0] : 'Entrar'}
            </Link>
            <Link
              href={user ? '/conta/favoritos' : '/entrar'}
              title="Favoritos"
              className="relative grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-border-strong bg-input-alt text-base hover:border-accent sm:h-10 sm:w-10"
            >
              ♡
              {favCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-accent text-[10px] font-extrabold text-page">
                  {favCount}
                </span>
              )}
            </Link>
            <button
              onClick={openCart}
              title="Carrinho"
              className="relative grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-border-strong bg-input-alt text-[15px] hover:border-accent sm:h-10 sm:w-10"
            >
              ▢
              {count > 0 && (
                <span className="absolute -right-1 -top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-accent text-[10px] font-extrabold text-page">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>
        <div className="mt-3 md:hidden">
          {renderSearch('mobile')}
        </div>
        {menuOpen && (
          <nav className="mt-3 flex flex-col gap-1 border-t border-divider-strong pt-3 lg:hidden">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm font-semibold text-fg-secondary hover:bg-card hover:text-accent"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
