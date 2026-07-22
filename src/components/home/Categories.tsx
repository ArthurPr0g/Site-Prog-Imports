import Link from 'next/link';

const CATEGORIES = [
  { name: 'MacBook', glyph: 'MB', count: '12 produtos' },
  { name: 'iPad / Tablet', glyph: 'iP', count: '9 produtos' },
  { name: 'Notebooks Gamer', glyph: 'NG', count: '18 produtos', filter: 'Notebook Gamer' },
  { name: 'Notebook Trabalho', glyph: 'NT', count: '14 produtos' },
  { name: 'Notebook Estudos', glyph: 'NE', count: '11 produtos' },
  { name: 'Notebooks para IA', glyph: 'IA', count: '7 produtos' },
  { name: 'Monitores', glyph: 'MO', count: '10 produtos' },
  { name: 'Periféricos', glyph: 'PF', count: '26 produtos' },
  { name: 'Serviços', glyph: 'SV', count: '5 serviços', anchor: '#servicos' },
];

export function Categories() {
  return (
    <section id="categorias" className="mx-auto max-w-[1280px] px-6 pt-18">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <div className="mb-2.5 text-xs font-extrabold uppercase tracking-[.14em] text-accent">
            Navegue por categoria
          </div>
          <h2 className="font-display text-[36px] font-bold tracking-[-.02em]">O que você procura hoje?</h2>
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3.5">
        {CATEGORIES.map((c) => (
          <Link
            key={c.name}
            href={c.anchor ?? `/?categoria=${encodeURIComponent(c.filter ?? c.name)}#produtos`}
            className="flex flex-col gap-11 rounded-[20px] border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-accent/55 hover:bg-card-hover"
          >
            <div className="grid h-11 w-11 place-items-center rounded-xl border border-accent/30 bg-accent/10 font-display text-[15px] font-bold text-accent">
              {c.glyph}
            </div>
            <div>
              <div className="mb-1 text-[15px] font-extrabold">{c.name}</div>
              <div className="text-xs text-fg-tertiary">{c.count}</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
