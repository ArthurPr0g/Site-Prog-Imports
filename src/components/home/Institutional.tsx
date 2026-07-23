import { ShieldCheck, PlaneTakeoff, Globe, Headset, LifeBuoy, BadgeCheck } from 'lucide-react';
import { GlobeOpportunities } from './GlobeOpportunities';

const DIFFS = [
  { Icon: PlaneTakeoff, title: 'Importação legalizada, com procedência e nota fiscal' },
  { Icon: ShieldCheck, title: 'Garantia real e cobertura completa em todos os produtos' },
  { Icon: Globe, title: 'Exclusivos dos EUA, modelos que não chegam ao Brasil' },
  { Icon: Headset, title: 'Atendimento personalizado, direto com quem entende' },
  { Icon: LifeBuoy, title: 'Suporte pós-venda com acompanhamento após a entrega' },
  { Icon: BadgeCheck, title: 'Qualidade garantida — só trabalhamos com o melhor' },
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
            <p className="mb-7 text-[15px] leading-relaxed text-fg-secondary">
              Importamos os produtos mais desejados do mundo com procedência garantida, atendimento
              personalizado e suporte completo antes, durante e depois da compra.
            </p>
            <div className="flex flex-col gap-3.5">
              {DIFFS.map((d) => (
                <div key={d.title} className="flex items-center gap-3.5">
                  <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-[10px] border border-accent/30 bg-accent/10 text-accent">
                    <d.Icon size={17} />
                  </div>
                  <div className="text-[13.5px] leading-snug text-fg-secondary">{d.title}</div>
                </div>
              ))}
            </div>
          </div>
          <GlobeOpportunities />
        </div>
      </div>
    </section>
  );
}
