import Link from 'next/link';
import clsx from 'clsx';

// Três áreas de trabalho, não duas. O Estúdio não é uma tela do Gerenciamento:
// ali não se administra a loja, se produz a peça que vai para o Instagram — e
// quem está montando post não quer passar por estoque e financeiro no caminho.
const AREAS = [
  { chave: 'loja', href: '/', rotulo: 'Loja' },
  { chave: 'admin', href: '/admin', rotulo: 'Gerenciamento' },
  { chave: 'estudio', href: '/admin/estudio', rotulo: 'Estúdio' },
] as const;

export type AreaDeTrabalho = (typeof AREAS)[number]['chave'];

export function WorkspaceSwitcher({ active }: { active: AreaDeTrabalho }) {
  return (
    <div className="flex flex-shrink-0 items-center gap-1 rounded-full border border-border-strong bg-input-alt p-1">
      {AREAS.map((area) => (
        <Link
          key={area.chave}
          href={area.href}
          className={clsx(
            'rounded-full px-3.5 py-1.5 text-xs font-extrabold transition-colors',
            active === area.chave ? 'bg-accent text-page' : 'text-fg-secondary hover:text-accent'
          )}
        >
          {area.rotulo}
        </Link>
      ))}
    </div>
  );
}
