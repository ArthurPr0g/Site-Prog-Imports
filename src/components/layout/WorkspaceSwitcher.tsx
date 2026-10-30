'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { ehDaProgSolucoes } from '@/lib/areas';

// Quatro áreas de trabalho. O Estúdio não é uma tela do Gerenciamento: ali não se
// administra a loja, se produz a peça que vai para o Instagram. A Prog Soluções
// (serviços: captação, pós-venda, prestação, gastos) também é separada da loja de
// importados (pedido do dono em 30/10/2026), com menu e marca próprios.
const AREAS = [
  { chave: 'loja', href: '/', rotulo: 'Loja' },
  { chave: 'admin', href: '/admin', rotulo: 'Gerenciamento' },
  { chave: 'solucoes', href: '/admin/captacao', rotulo: 'Prog Soluções' },
  { chave: 'estudio', href: '/admin/estudio', rotulo: 'Estúdio' },
] as const;

export type AreaDeTrabalho = (typeof AREAS)[number]['chave'];

export function WorkspaceSwitcher({ active }: { active: AreaDeTrabalho }) {
  const pathname = usePathname();
  // As telas da Prog Soluções usam o cabeçalho padrão do admin: a área vem da rota.
  const ativa = active === 'admin' && ehDaProgSolucoes(pathname ?? '') ? 'solucoes' : active;
  return (
    <div className="flex min-w-0 max-w-full items-center gap-1 overflow-x-auto rounded-full border border-border-strong bg-input-alt p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {AREAS.map((area) => (
        <Link
          key={area.chave}
          href={area.href}
          className={clsx(
            'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-extrabold transition-colors sm:px-3.5',
            ativa === area.chave
              ? area.chave === 'solucoes'
                ? 'bg-[#F2F3F5] text-[#08080A]' // design system Prog Soluções: item ativo sólido em paper
                : 'bg-surface-light text-ink'
              : 'text-fg-secondary hover:text-accent'
          )}
        >
          {area.rotulo}
        </Link>
      ))}
    </div>
  );
}
