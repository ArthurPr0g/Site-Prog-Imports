export function glowMouseMove(e: React.MouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty('--glow-x', `${e.clientX - rect.left}px`);
  el.style.setProperty('--glow-y', `${e.clientY - rect.top}px`);
  el.style.setProperty('--glow-opacity', '1');
}

export function glowMouseLeave(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.setProperty('--glow-opacity', '0');
}

/** Anel de luz laranja que segue o mouse na borda do cartão pai (que precisa ser `relative`). */
export function GlowBorder() {
  return <span aria-hidden className="glow-border" />;
}
