'use client';

import { useState, type MouseEvent } from 'react';

export function Gallery({ images, badge }: { images: { label: string }[]; badge?: string }) {
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [pos, setPos] = useState({ x: 50, y: 50 });

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setZoom(true);
    setPos({
      x: Math.round(((e.clientX - r.left) / r.width) * 100),
      y: Math.round(((e.clientY - r.top) / r.height) * 100),
    });
  }

  const active = images[idx] ?? { label: 'produto' };

  return (
    <div>
      <div
        onMouseMove={onMove}
        onMouseLeave={() => setZoom(false)}
        className="stripe-placeholder relative h-[460px] cursor-zoom-in overflow-hidden rounded-3xl border border-border-strong"
      >
        <div
          className="stripe-placeholder absolute inset-0 grid place-items-center transition-transform duration-200 ease-out"
          style={{ transform: `scale(${zoom ? 1.8 : 1})`, transformOrigin: `${pos.x}% ${pos.y}%` }}
        >
          <div className="font-mono text-sm text-fg-faded">[ foto: {active.label} ]</div>
        </div>
        {badge && (
          <div className="absolute left-4 top-4 rounded-full bg-accent px-3 py-1.5 text-[11px] font-extrabold tracking-[.06em] text-page">
            {badge}
          </div>
        )}
        <div className="absolute bottom-3.5 right-4 rounded-full bg-page/70 px-2.5 py-1.5 text-[11px] text-fg-faded">
          passe o mouse para dar zoom
        </div>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-2.5">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className="stripe-placeholder grid h-19 place-items-center rounded-2xl border p-0 transition-all hover:border-accent"
            style={{ borderColor: i === idx ? '#F28705' : '#26262b' }}
          >
            <span className="font-mono text-[10px] text-fg-faded">foto {i + 1}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
