const BRANDS = ['APPLE', 'ALIENWARE', 'ASUS ROG', 'ACER', 'LENOVO', 'LG', 'SAMSUNG', 'LOGITECH', 'DELL'];

export function BrandsMarquee() {
  return (
    <div
      className="mt-10 overflow-hidden border-b border-divider-strong py-5.5"
      style={{ maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)' }}
    >
      <div className="flex w-max animate-marquee gap-18 font-display text-[19px] font-semibold tracking-[.08em] text-fg-muted">
        {[...BRANDS, ...BRANDS].map((b, i) => (
          <span key={i}>{b}</span>
        ))}
      </div>
    </div>
  );
}
