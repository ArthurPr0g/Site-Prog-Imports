'use client';

import { useImperativeHandle, useLayoutEffect, useRef, type CSSProperties, type Ref } from 'react';
import { COR, FONTE } from './tokens';

export type ProgWordmarkHandle = { set: (e: { reveal?: number; opacity?: number }) => void };

type Props = {
  ref?: Ref<ProgWordmarkHandle>;
  /** Posição no palco: borda esquerda e centro vertical (px). */
  x?: number;
  cy?: number;
  size: number;
  reveal?: number;
  opacity?: number;
  /** Fundo escuro (texto claro) ou claro. */
  dark?: boolean;
  style?: CSSProperties;
};

/**
 * "Prog" em Sora 600 + " Soluções" em 400, −0,03em. A revelação é um clip da
 * direita para a esquerda com o texto deslizando 25% do tamanho (como o
 * `Word` da referência). `ref.set` escreve direto no style.
 */
export function ProgWordmark({ ref, x, cy, size, reveal = 1, opacity = 1, dark = true, style }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const estado = useRef({ reveal, opacity });

  const aplicar = () => {
    const d = el.current;
    if (!d) return;
    const { reveal: r, opacity: o } = estado.current;
    const vis = r > 0.001 && o > 0.001;
    d.style.visibility = vis ? 'visible' : 'hidden';
    d.style.clipPath = `inset(-20% ${(1 - r) * 100}% -20% 0)`;
    d.style.transform = `translateX(${-(1 - r) * size * 0.25}px)`;
    d.style.opacity = String(o * Math.min(1, r * 2.5));
  };

  useImperativeHandle(ref, () => ({
    set: (e) => {
      Object.assign(estado.current, e);
      aplicar();
    },
  }));

  useLayoutEffect(() => {
    estado.current = { reveal, opacity };
    aplicar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal, opacity, size]);

  const posicao: CSSProperties = x !== undefined && cy !== undefined ? { position: 'absolute', left: x, top: cy - size / 2 } : {};
  return (
    <div
      ref={el}
      aria-hidden
      style={{
        ...posicao,
        fontFamily: FONTE.display,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: '-.03em',
        whiteSpace: 'nowrap',
        color: dark ? COR.text : COR.ink,
        paddingRight: '.08em',
        opacity: reveal > 0.001 ? opacity : 0,
        ...style,
      }}
    >
      <span style={{ fontWeight: 600 }}>Prog</span>{' '}
      <span style={{ fontWeight: 400, color: dark ? COR.muted : COR.mutedDark }}>Soluções</span>
    </div>
  );
}
