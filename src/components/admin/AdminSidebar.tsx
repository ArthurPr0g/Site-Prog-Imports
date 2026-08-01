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
  Layers,
  GalleryHorizontalEnd,
  Wrench,
  MessageSquareQuote,
  Briefcase,
  Wallet,
  Boxes,
  BarChart3,
  FileText,
  FileSpreadsheet,
  ArrowLeftRight,
  HandPlatter,
  Settings,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

// `pendente` marca a página que ainda é placeholder do roadmap do ERP. Serve
// para bater o olho no menu e saber o que falta construir, sem abrir uma por
// uma — e some sozinho conforme cada módulo é entregue.
type NavItem = { href: string; label: string; Icon: typeof LayoutDashboard; pendente?: boolean };
type NavGroup = { group: string; items: NavItem[] };

// Agrupado por área de trabalho, não por ordem de criação. "Serviços" aparece
// duas vezes de propósito: em Loja são os que o visitante vê no site; em
// Cadastro são os que a Prog presta fora da loja (sites, sistemas, design).
const NAV: NavGroup[] = [
  {
    group: 'Principal',
    items: [{ href: '/admin', label: 'Dashboard', Icon: LayoutDashboard }],
  },
  {
    group: 'Loja',
    items: [
      { href: '/admin/colecoes', label: 'Coleções', Icon: Layers },
      { href: '/admin/cupons', label: 'Cupons', Icon: Tag },
      { href: '/admin/banners', label: 'Banners da home', Icon: GalleryHorizontalEnd },
      { href: '/admin/depoimentos', label: 'Depoimentos', Icon: MessageSquareQuote },
      { href: '/admin/servicos', label: 'Serviços', Icon: Wrench },
    ],
  },
  {
    group: 'Cadastro',
    items: [
      { href: '/admin/clientes', label: 'Clientes', Icon: Users },
      { href: '/admin/produtos', label: 'Produtos', Icon: Package },
      { href: '/admin/servicos-internos', label: 'Serviços', Icon: Briefcase },
    ],
  },
  {
    group: 'Gestão',
    items: [
      { href: '/admin/financeiro', label: 'Financeiro', Icon: Wallet },
      { href: '/admin/estoque', label: 'Estoque', Icon: Boxes },
      { href: '/admin/relatorios', label: 'Relatórios', Icon: BarChart3, pendente: true },
    ],
  },
  {
    group: 'Operacional',
    items: [
      { href: '/admin/orcamentos-loja', label: 'Orçamentos Loja', Icon: FileText },
      { href: '/admin/orcamentos-servicos', label: 'Orçamentos Serviços', Icon: FileSpreadsheet, pendente: true },
      { href: '/admin/vendas', label: 'Vendas', Icon: ClipboardList },
      { href: '/admin/avaliacao-troca', label: 'Avaliação de Troca', Icon: ArrowLeftRight, pendente: true },
      { href: '/admin/prestacao-servico', label: 'Prestação de Serviço', Icon: HandPlatter },
    ],
  },
  {
    group: 'Sistema',
    items: [{ href: '/admin/configuracoes', label: 'Configurações', Icon: Settings }],
  },
];

const ALL_ITEMS = NAV.flatMap((g) => g.items);

// Tudo em classe, nada em `style` inline: estilo inline vence classe, e era por
// isso que o `hover:text-accent` daqui nunca surtia efeito — a cor inline
// sobrescrevia o hover em silêncio.
//
// Três estados visuais distinguíveis de relance: item ativo, item pronto e item
// ainda por construir (mais apagado que os outros dois).
const ITEM_BASE =
  'flex items-center gap-3 rounded-xl px-3.5 py-2.75 text-[13.5px] font-bold transition-colors duration-150 ' +
  'hover:bg-[rgb(var(--brand-accent-rgb)/.07)] hover:text-accent ' +
  'active:bg-[rgb(var(--brand-accent-rgb)/.16)]';

function classeDoItem(active: boolean, pendente?: boolean): string {
  if (active) {
    return `${ITEM_BASE} bg-[rgb(var(--brand-accent-rgb)/.1)] text-accent${pendente ? ' opacity-75' : ''}`;
  }
  return `${ITEM_BASE} ${pendente ? 'text-[#4a4a52]' : 'text-[#a8a8b0]'}`;
}

// Rotas irmãs precisam de match exato, senão /admin casa com tudo e
// /admin/servicos ficaria sempre ativo junto de /admin/servicos-internos.
function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  const irmaMaisEspecifica = ALL_ITEMS.some((i) => i.href !== href && i.href.startsWith(href + '-'));
  if (irmaMaisEspecifica) return pathname === href || pathname.startsWith(href + '/');
  return pathname === href || pathname.startsWith(href + '/');
}

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
          {NAV.map((grupo) => (
            <div key={grupo.group} className="mb-1">
              <div className="px-3.5 pb-1 pt-3 text-[10px] font-extrabold uppercase tracking-[.12em] text-fg-faded">
                {grupo.group}
              </div>
              {grupo.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    title={item.pendente ? `${item.label} — ainda não construída` : item.label}
                    className={classeDoItem(active, item.pendente)}
                  >
                    <item.Icon className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={2} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
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
          {NAV.map((grupo, i) => (
            <div key={grupo.group}>
              {/* Recolhida, a barra não tem largura para o rótulo do grupo — ele
                  vira um traço, que preserva a separação visual entre as áreas
                  sem texto cortado. O traço some no primeiro grupo. */}
              {hovered ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className="whitespace-nowrap px-3.5 pb-1 pt-3 text-[10px] font-extrabold uppercase tracking-[.12em] text-fg-faded"
                >
                  {grupo.group}
                </motion.div>
              ) : (
                i > 0 && <div className="mx-3.5 my-2 border-t border-divider-strong" />
              )}
              {grupo.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.pendente ? `${item.label} — ainda não construída` : item.label}
                    className={classeDoItem(active, item.pendente)}
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
            </div>
          ))}
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
