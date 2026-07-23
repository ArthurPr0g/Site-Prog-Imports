'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Users,
  Tag,
  LayoutGrid,
  GalleryHorizontalEnd,
  Wrench,
  MessageSquareQuote,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

const NAV = [
  { href: '/admin', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/admin/produtos', label: 'Produtos', Icon: Package },
  { href: '/admin/pedidos', label: 'Pedidos', Icon: ClipboardList },
  { href: '/admin/clientes', label: 'Clientes', Icon: Users },
  { href: '/admin/cupons', label: 'Cupons', Icon: Tag },
  { href: '/admin/catalogo', label: 'Catálogo', Icon: LayoutGrid },
  { href: '/admin/banners', label: 'Banners da home', Icon: GalleryHorizontalEnd },
  { href: '/admin/servicos', label: 'Serviços', Icon: Wrench },
  { href: '/admin/depoimentos', label: 'Depoimentos', Icon: MessageSquareQuote },
];

const COLLAPSED_WIDTH = 76;
const EXPANDED_WIDTH = 248;
const SPRING = { type: 'spring' as const, stiffness: 260, damping: 32, mass: 0.7 };

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <div className="min-h-screen bg-page lg:flex">
      <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-divider-strong bg-card-dark px-4 py-3 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu do admin"
          className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-border-strong text-base"
        >
          ☰
        </button>
        <Logo height={37} />
        <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-accent">Admin</span>
      </div>

      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" />
      )}

      {/* Mobile: off-canvas drawer, full labels always visible, closes on navigation/backdrop tap. */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-shrink-0 flex-col border-r border-divider-strong bg-card-dark transition-transform duration-300 ease-out lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-divider-strong px-5 pb-3.5 pt-5">
          <Logo height={51} />
          <div className="text-[10px] font-extrabold uppercase tracking-[.14em] text-accent">Admin</div>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
            className="ml-auto grid h-8 w-8 place-items-center rounded-full border border-border-strong text-sm"
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
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3.5 py-2.75 text-[13.5px] font-bold transition-all hover:text-accent"
                style={{ background: active ? 'rgba(242,135,5,.1)' : 'transparent', color: active ? '#F28705' : '#a8a8b0' }}
              >
                <item.Icon className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={2} />
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

      {/* Desktop: rail collapsed by default, expands smoothly on hover. */}
      <motion.aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        animate={{ width: hovered ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
        transition={SPRING}
        className="sticky top-0 z-30 hidden h-screen flex-shrink-0 flex-col overflow-hidden border-r border-divider-strong bg-card-dark lg:flex"
      >
        <div className="flex items-center gap-2.5 border-b border-divider-strong px-5 pb-3.5 pt-5">
          <Logo height={41} />
          <AnimatePresence>
            {hovered && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
                className="whitespace-nowrap text-[10px] font-extrabold uppercase tracking-[.14em] text-accent"
              >
                Admin
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden p-3">
          {NAV.map((item) => {
            const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className="flex items-center gap-3 rounded-xl px-3.5 py-2.75 text-[13.5px] font-bold transition-colors hover:text-accent"
                style={{ background: active ? 'rgba(242,135,5,.1)' : 'transparent', color: active ? '#F28705' : '#a8a8b0' }}
              >
                <item.Icon className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={2} />
                <AnimatePresence>
                  {hovered && (
                    <motion.span
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={{ duration: 0.15 }}
                      className="whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-divider-strong px-5 py-4 text-xs text-fg-faded">
          <Link href="/" className="flex items-center gap-3 whitespace-nowrap font-bold text-fg-tertiary hover:text-accent">
            <span className="flex-shrink-0">←</span>
            <AnimatePresence>
              {hovered && (
                <motion.span
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  Ver loja
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        </div>
      </motion.aside>

      <main className="min-w-0 px-4 pb-12 pt-6 sm:px-6 lg:flex-1 lg:px-8 lg:pt-7">{children}</main>
    </div>
  );
}
