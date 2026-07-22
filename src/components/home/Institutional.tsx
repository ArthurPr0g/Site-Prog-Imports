const DIFFS = [
  { num: '01', title: 'Importação legalizada', sub: 'Produtos com procedência e nota fiscal.' },
  { num: '02', title: 'Garantia real', sub: 'Cobertura completa em todos os produtos.' },
  { num: '03', title: 'Exclusivos dos EUA', sub: 'Modelos que não chegam ao Brasil.' },
  { num: '04', title: 'Atendimento personalizado', sub: 'Você fala direto com quem entende.' },
  { num: '05', title: 'Suporte pós-venda', sub: 'Acompanhamento após a entrega.' },
  { num: '06', title: 'Qualidade garantida', sub: 'Só trabalhamos com o melhor.' },
];

export function Institutional() {
  return (
    <section className="mx-auto max-w-[1280px] px-6 pt-22">
      <div className="rounded-[28px] border border-border bg-[linear-gradient(145deg,#111114,#0d0d11)] p-8 md:p-14">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-[1fr_1.4fr] md:gap-14">
          <div>
            <div className="mb-3 text-xs font-extrabold uppercase tracking-[.14em] text-accent">
              Por que a Prog Imports?
            </div>
            <h2 className="mb-4 font-display text-[28px] font-bold leading-tight tracking-[-.02em] md:text-[34px]">
              Tecnologia dos EUA, com a confiança que você merece
            </h2>
            <p className="text-[15px] leading-relaxed text-fg-secondary">
              Importamos os produtos mais desejados do mundo com procedência garantida, atendimento
              personalizado e suporte completo antes, durante e depois da compra.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {DIFFS.map((d) => (
              <div
                key={d.num}
                className="rounded-2xl border border-border bg-page p-5 transition-all hover:border-accent/40"
              >
                <div className="mb-2 font-display text-[13px] font-bold text-accent">{d.num}</div>
                <div className="mb-1 text-sm font-extrabold">{d.title}</div>
                <div className="text-[12.5px] leading-relaxed text-fg-tertiary">{d.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
