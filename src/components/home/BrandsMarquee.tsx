'use client';

const BRANDS = ['APPLE', 'ALIENWARE', 'ASUS ROG', 'ACER', 'LENOVO', 'LG', 'SAMSUNG', 'LOGITECH', 'DELL'];

function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
  el.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
  el.style.setProperty('--spot-opacity', '1');
}

function handleMouseLeave(e: React.MouseEvent<HTMLDivElement>) {
  e.currentTarget.style.setProperty('--spot-opacity', '0');
}

export function BrandsMarquee() {
  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative mt-10 overflow-hidden border-b border-divider-strong py-5.5"
      style={{ maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)' }}
    >
      <span aria-hidden className="brands-spotlight" />
      <div className="flex w-max animate-marquee gap-18 font-display text-[19px] font-semibold tracking-[.08em] text-fg-muted">
        {[...BRANDS, ...BRANDS].map((b, i) => (
          <span key={i} className="brand-word">
            {b}
          </span>
        ))}
      </div>
    </div>
  );
}
