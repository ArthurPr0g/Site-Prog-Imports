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
  Workflow,
  MessagesSquare,
  Video,
  UserRoundCheck,
  Bot,
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
  Images,
  Settings,
  Magnet,
  ClipboardCheck,
  PiggyBank,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { ehDaProgSolucoes } from '@/lib/areas';
import { ProgMark } from '@/brand/ProgMark';

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
      { href: '/admin/vendas', label: 'Vendas', Icon: ClipboardList },
      { href: '/admin/avaliacao-troca', label: 'Avaliação de Troca', Icon: ArrowLeftRight },
    ],
  },
  // A Prog Soluções tem área própria (menu, marca e cores): atalho para ela.
  {
    group: 'Prog Soluções',
    items: [{ href: '/admin/captacao', label: 'Abrir Prog Soluções', Icon: Magnet }],
  },
  // O Estúdio aparece aqui e no seletor de área. No seletor porque é outro
  // modo de trabalho; aqui porque quem está no Gerenciamento precisa de um
  // caminho para ele sem voltar ao topo da tela.
  {
    group: 'Estúdio',
    items: [{ href: '/admin/estudio', label: 'Peças de Instagram', Icon: Images }],
  },
  {
    group: 'Sistema',
    items: [{ href: '/admin/configuracoes', label: 'Configurações', Icon: Settings }],
  },
];

// Área da Prog Soluções (sites, sistemas, marca), separada da loja de importados a pedido do dono
// (30/10/2026): mesmo login e rotas sob /admin, mas menu, marca e cores próprios (design "Noite azul").
// Menu da Prog Soluções reorganizado em 30/10/2026 (pedido do Arthur): Dashboards e Atendimento em páginas
// próprias, Vendedores fora da Captação e a configuração da Lia numa página só dela.
const NAV_SOLUCOES: NavGroup[] = [
  {
    group: 'Visão geral',
    items: [{ href: '/admin/dashboards', label: 'Dashboards', Icon: LayoutDashboard }],
  },
  {
    group: 'Comercial',
    items: [
      { href: '/admin/captacao', label: 'Captação', Icon: Magnet },
      { href: '/admin/atendimento', label: 'Atendimento', Icon: MessagesSquare },
      { href: '/admin/reunioes', label: 'Reuniões', Icon: Video },
      { href: '/admin/vendedores', label: 'Vendedores', Icon: UserRoundCheck },
      { href: '/admin/pos-venda', label: 'Pós-venda', Icon: ClipboardCheck },
    ],
  },
  {
    group: 'Lia (IA)',
    items: [{ href: '/admin/lia', label: 'Lia', Icon: Bot }],
  },
  {
    group: 'Projetos',
    items: [
      { href: '/admin/prestacao-servico', label: 'Prestação de Serviço', Icon: HandPlatter },
      { href: '/admin/orcamentos-servicos', label: 'Orçamentos de Serviços', Icon: FileSpreadsheet },
    ],
  },
  {
    group: 'Gestão',
    items: [
      { href: '/admin/time', label: 'Time e fluxo', Icon: Workflow },
      { href: '/admin/gastos', label: 'Gastos', Icon: PiggyBank },
      { href: '/admin/servicos-internos', label: 'Catálogo de serviços', Icon: Briefcase },
    ],
  },
];

const ALL_ITEMS = [...NAV, ...NAV_SOLUCOES].flatMap((g) => g.items);

/** Marca da Prog Soluções no lugar do logo da loja: o "P modular" do design system + "Prog Soluções" em Sora. */
function MarcaSolucoes({ comNome }: { comNome: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <ProgMark s={36} className="flex-shrink-0" />
      {comNome && (
        <span className="whitespace-nowrap font-[family-name:var(--font-sora)] text-[16px] tracking-[-0.03em] text-[#F4F5F7]">
          <span className="font-semibold">Prog</span> <span className="font-normal text-[#A3A8B2]">Soluções</span>
        </span>
      )}
    </div>
  );
}

// Cores da área da Prog Soluções aplicadas por variável no painel inteiro: design system Prog Soluções
// (pedido do Arthur, 30/10/2026; docs/DESIGN-SYSTEM-PROG.md). Panel #0D0E13 na sidebar, acento periwinkle.
const VARS_SOLUCOES = {
  '--color-card-dark': '#0D0E13',
  '--color-divider-strong': 'rgba(255, 255, 255, 0.09)',
  '--brand-accent-rgb': '129 170 247',
} as React.CSSProperties;

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

function classeDoItem(active: boolean, pendente?: boolean, solucoes?: boolean): string {
  // Prog Soluções: item ativo em Accent strong 600 sobre oklch(72% .1 262 / .14); demais na cor Nav.
  if (solucoes) {
    if (active) return `${ITEM_BASE} bg-[oklch(72%_.1_262/.14)] !font-semibold !text-[#B1D2FF]${pendente ? ' opacity-75' : ''}`;
    return `${ITEM_BASE} !font-medium hover:!text-[#F4F5F7] ${pendente ? 'text-[#5D626B]' : 'text-[#9BA1AB]'}`;
  }
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
  const solucoes = ehDaProgSolucoes(pathname);
  const menu = solucoes ? NAV_SOLUCOES : NAV;
  const voltar = solucoes ? { href: '/admin', rotulo: 'Gerenciamento da loja' } : { href: '/', rotulo: 'Ver loja' };

  return (
    <div className={clsx('min-h-screen bg-page lg:flex', solucoes && 'tema-apple ds-prog [color-scheme:dark]')} style={solucoes ? VARS_SOLUCOES : undefined}>
      <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-divider-strong bg-card-dark px-4 py-3 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu do admin"
          className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-border-strong text-base"
        >
          ☰
        </button>
        {solucoes ? <MarcaSolucoes comNome /> : <Logo height={37} />}
        {!solucoes && <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-accent">Admin</span>}
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
          {solucoes ? <MarcaSolucoes comNome /> : <Logo height={51} />}
          {!solucoes && <div className="text-[10px] font-extrabold uppercase tracking-[.14em] text-accent">Admin</div>}
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
            className="ml-auto grid h-8 w-8 place-items-center rounded-full border border-border-strong text-sm"
          >
            ✕
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
          {menu.map((grupo) => (
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
                    className={classeDoItem(active, item.pendente, solucoes)}
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
          <Link href={voltar.href} className="font-bold text-fg-tertiary hover:text-accent">
            ← {voltar.rotulo}
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
          {solucoes ? <MarcaSolucoes comNome={hovered} /> : <Logo height={41} />}
          <AnimatePresence>
            {hovered && !solucoes && (
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
          {menu.map((grupo, i) => (
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
                    className={classeDoItem(active, item.pendente, solucoes)}
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
          <Link href={voltar.href} className="flex items-center gap-3 whitespace-nowrap font-bold text-fg-tertiary hover:text-accent">
            <span className="flex-shrink-0">←</span>
            <AnimatePresence>
              {hovered && (
                <motion.span
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  {voltar.rotulo}
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
