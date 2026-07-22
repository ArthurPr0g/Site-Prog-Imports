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

export function Header({
  searchIndex,
  user,
}: {
  searchIndex: SearchIndexItem[];
  user: { name: string; role: string } | null;
}) {
  const [query, setQuery] = useState('');
  const { count, favCount, openCart } = useCart();

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return searchIndex
      .filter((p) => (p.name + ' ' + p.category).toLowerCase().includes(q))
      .slice(0, 5);
  }, [query, searchIndex]);

  const showSuggestions = query.trim().length > 0;

  return (
    <header className="sticky top-0 z-90 border-b border-divider-strong bg-page/82 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1280px] items-center gap-7 px-6 py-3.5">
        <Link href="/" className="flex flex-shrink-0 items-center gap-2.5">
          <Logo height={52} />
        </Link>
        <nav className="hidden gap-5 text-sm font-semibold text-fg-secondary lg:flex">
          <Link href="/?categoria=MacBook#produtos" className="hover:text-accent">MacBooks</Link>
          <Link href="/?categoria=iPhone#produtos" className="hover:text-accent">iPhones</Link>
          <Link href="/?categoria=Notebook+Gamer#produtos" className="hover:text-accent">Notebooks Gamer</Link>
          <Link href="/?categoria=Monitores#produtos" className="hover:text-accent">Monitores</Link>
          <Link href="/#servicos" className="hover:text-accent">Serviços</Link>
        </nav>
        <div className="relative ml-auto max-w-[420px] flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar iPhone, MacBook, Alienware…"
            className="w-full rounded-full border border-border-strong bg-input-alt px-4.5 py-2.5 text-sm text-fg outline-none focus:border-accent"
          />
          {showSuggestions && (
            <div className="absolute left-0 right-0 top-[calc(100%+8px)] overflow-hidden rounded-2xl border border-border-strong bg-input-alt shadow-[0_24px_60px_rgba(0,0,0,.6)]">
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
        <div className="flex flex-shrink-0 items-center gap-2">
          {user?.role === 'admin' && <WorkspaceSwitcher active="loja" />}
          <Link
            href={user ? '/conta' : '/entrar'}
            className="rounded-full border border-border-strong px-4 py-2.5 text-[13px] font-bold hover:border-accent hover:text-accent"
          >
            {user ? user.name.split(' ')[0] : 'Entrar'}
          </Link>
          <Link
            href={user ? '/conta/favoritos' : '/entrar'}
            title="Favoritos"
            className="relative grid h-10 w-10 place-items-center rounded-full border border-border-strong bg-input-alt text-base hover:border-accent"
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
            className="relative grid h-10 w-10 place-items-center rounded-full border border-border-strong bg-input-alt text-[15px] hover:border-accent"
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
    </header>
  );
}
