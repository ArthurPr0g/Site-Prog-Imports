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
    <div className="flex flex-shrink-0 flex-wrap items-center gap-1 rounded-full border border-border-strong bg-input-alt p-1">
      {AREAS.map((area) => (
        <Link
          key={area.chave}
          href={area.href}
          className={clsx(
            'rounded-full px-3.5 py-1.5 text-xs font-extrabold transition-colors',
            ativa === area.chave
              ? area.chave === 'solucoes'
                ? 'bg-[linear-gradient(135deg,#6a82ff,#3349f0)] text-white'
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
