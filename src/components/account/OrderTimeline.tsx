const GLYPHS = ['PR', 'PA', 'RS', 'PP', 'TI', 'DA', 'BR', 'TR', 'RE', 'OK'];

type Step = { title: string; done: boolean; current: boolean; when: string | null; note: string | null };

export function OrderTimeline({ steps }: { steps: Step[] }) {
  return (
    <div className="flex flex-col">
      {steps.map((s, i) => {
        const dotBg = s.done ? '#F28705' : s.current ? 'rgba(242,135,5,.15)' : '#141418';
        const dotBorder = s.done || s.current ? '#F28705' : '#26262b';
        const dotColor = s.done ? '#0a0a0c' : s.current ? '#F28705' : '#5b5b63';
        const titleColor = s.done || s.current ? '#f4f4f5' : '#5b5b63';
        const hasLine = i < steps.length - 1;
        let lineBg = '#26262b';
        if (i < steps.length - 1) {
          const nextDone = steps.length === 10 && steps[9].done; // fully delivered
          if (s.done) lineBg = '#F28705';
          else if (s.current) lineBg = nextDone ? '#F28705' : 'linear-gradient(#F28705,#26262b)';
        }

        return (
          <div key={s.title} className="flex gap-4.5">
            <div className="flex w-9 flex-shrink-0 flex-col items-center">
              <div
                className="grid h-8.5 w-8.5 flex-shrink-0 place-items-center rounded-full border-2 font-display text-xs font-bold"
                style={{
                  background: dotBg,
                  borderColor: dotBorder,
                  color: dotColor,
                  animation: s.current ? 'pulseDot 2s ease-in-out infinite' : 'none',
                }}
              >
                {s.done ? '✓' : GLYPHS[i]}
              </div>
              {hasLine && <div className="min-h-6.5 w-0.5 flex-1" style={{ background: lineBg }} />}
            </div>
            <div className="pb-5.5 pt-1.5">
              <div className="text-[14.5px] font-extrabold" style={{ color: titleColor }}>
                {s.title}
              </div>
              {s.when && <div className="mt-0.5 text-[12.5px] text-fg-tertiary">{s.when}</div>}
              {s.note && (
                <div className="mt-1.5 max-w-[440px] rounded-[10px] border border-divider-strong bg-page px-3.5 py-2.5 text-[13px] leading-relaxed text-fg-secondary">
                  {s.note}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
