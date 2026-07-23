import { GlobeOpportunities } from './GlobeOpportunities';

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
          <GlobeOpportunities />
        </div>
      </div>
    </section>
  );
}
