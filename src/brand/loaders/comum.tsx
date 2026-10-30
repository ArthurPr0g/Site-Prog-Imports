'use client';

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { COR } from '../tokens';
import { clamp } from '../motion';

export type Nos = Record<string, HTMLElement | null>;

/** Junta os nós de uma cena pelo atributo data-no. Cada loader marca a sua
 *  raiz (e o que for para portal) com data-ps = id próprio. */
export function coletarNos(id: string): Nos {
  const nos: Nos = {};
  document.querySelectorAll<HTMLElement>(`[data-ps="${id}"][data-no], [data-ps="${id}"] [data-no]`).forEach((el) => {
    nos[el.dataset.no!] = el;
  });
  return nos;
}

type Caixa = { left?: number; top?: number; width?: number; height?: number };

/** Escreve posição/tamanho em px. */
export function caixa(el: HTMLElement | null | undefined, c: Caixa) {
  if (!el) return;
  if (c.left !== undefined) el.style.left = c.left + 'px';
  if (c.top !== undefined) el.style.top = c.top + 'px';
  if (c.width !== undefined) el.style.width = Math.max(0, c.width) + 'px';
  if (c.height !== undefined) el.style.height = Math.max(0, c.height) + 'px';
}

/** Opacidade + esconde de vez quando zera (não pinta o que não aparece). */
export function opac(el: HTMLElement | null | undefined, v: number) {
  if (!el) return;
  el.style.opacity = String(v);
  el.style.visibility = v > 0.001 ? 'visible' : 'hidden';
}

/** Troca o texto só quando muda (o "000%" muda poucas vezes por segundo). */
export function texto(el: HTMLElement | null | undefined, v: string) {
  if (el && el.textContent !== v) el.textContent = v;
}

/** Barra de progresso de 3 px (trilho + preenchimento). */
export function Barra({ noFill, light, style }: {
  /** Nome (data-no) do preenchimento. */
  noFill: string;
  light?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{ position: 'absolute', height: 3, borderRadius: 3, overflow: 'hidden', background: light ? COR.trilhoBarraClaro : COR.trilhoBarra, ...style }}
    >
      <div
        data-no={noFill}
        style={{ width: '0%', height: '100%', borderRadius: 3, background: light ? COR.accentDark : `linear-gradient(90deg, ${COR.accent}, ${COR.accentStrong})` }}
      />
    </div>
  );
}

export function preencher(el: HTMLElement | null | undefined, p: number) {
  if (el) el.style.width = clamp(p) * 100 + '%';
}

/** Texto só para leitor de tela. */
export function SoLeitor({ children }: { children: ReactNode }) {
  return (
    <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>{children}</span>
  );
}

/**
 * Palco de referência (1920×1080 ou 390×844) escalado para caber na área,
 * centralizado. Assim as medidas das referências valem 1:1 em qualquer tela.
 * O scale só muda no resize (não por quadro).
 */
export function Palco({ W, H, children }: { W: number; H: number; children: ReactNode }) {
  const fora = useRef<HTMLDivElement>(null);
  const dentro = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const a = fora.current;
    const b = dentro.current;
    if (!a || !b) return;
    const ajustar = () => {
      const { width, height } = a.getBoundingClientRect();
      const k = Math.min(width / W, height / H);
      b.style.transform = `translate(${(width - W * k) / 2}px, ${(height - H * k) / 2}px) scale(${k})`;
    };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(a);
    return () => ro.disconnect();
  }, [W, H]);
  return (
    <div ref={fora} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div ref={dentro} style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0' }}>
        {children}
      </div>
    </div>
  );
}
