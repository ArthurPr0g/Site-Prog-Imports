'use client';

import { useId, useImperativeHandle, useLayoutEffect, useRef, type CSSProperties, type Ref } from 'react';
import { COR, SIMBOLO } from './tokens';
import { ringD } from './motion';

/** Estado animável do símbolo (mesmas props do `Mark` da referência). */
export type EstadoMarca = {
  cx?: number; // centro (px do palco) quando `posicionado`
  cy?: number;
  s?: number; // lado da caixa de 48u, em px
  stem?: number; // 0..1 (passa de 1 com pop)
  arcA?: number; // início do trecho visível do arco (0..1)
  arcB?: number; // fim do trecho visível
  track?: number; // opacidade do arco inteiro como trilho
  ring?: number; // 0..1 do círculo tracejado
  ringOp?: number;
  rot?: number; // graus, em torno de (26.25, 18)
  ringScale?: number;
  opacity?: number;
};

export type ProgMarkHandle = { set: (e: EstadoMarca) => void };

type Props = EstadoMarca & {
  ref?: Ref<ProgMarkHandle>;
  stemColor?: string;
  arcColor?: string;
  ringColor?: string;
  ringW?: number; // px de tela
  dash?: number;
  gap?: number;
  /** Posição absoluta pelo centro (palco das cenas). Sem isso, é um SVG em linha de lado `s`. */
  posicionado?: boolean;
  className?: string;
  style?: CSSProperties;
};

// Lado-base do SVG posicionado: o tamanho real vem do scale (só transform).
const BASE = 100;

const PADRAO: Required<EstadoMarca> = {
  cx: 0, cy: 0, s: 48, stem: 1, arcA: 0, arcB: 1, track: 0, ring: 0, ringOp: 1, rot: 0, ringScale: 1, opacity: 1,
};

/**
 * O símbolo "P modular" animável. Os valores por quadro entram por
 * `ref.set({...})`, que escreve direto nos atributos do SVG; as props só dão
 * o estado inicial. A haste cresce de baixo para cima e o arco é revelado por
 * máscara ao longo da linha central (pathLength = 1).
 */
export function ProgMark(props: Props) {
  const {
    ref, stemColor = COR.text, arcColor = COR.accent, ringColor = COR.accentStrong,
    ringW = 1.6, dash = 7, gap = 6, posicionado = false, className, style,
  } = props;
  const id = 'pmk' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const svg = useRef<SVGSVGElement>(null);
  const trilho = useRef<SVGPathElement>(null);
  const arco = useRef<SVGPathElement>(null);
  const masc = useRef<SVGPathElement>(null);
  const haste = useRef<SVGRectElement>(null);
  const anel = useRef<SVGPathElement>(null);
  const estado = useRef<Required<EstadoMarca>>({ ...PADRAO });
  const cfg = useRef({ ringW, dash, gap, posicionado });

  const aplicar = () => {
    const e = estado.current;
    const c = cfg.current;
    const el = svg.current;
    if (!el) return;
    const k = e.s / 48;
    const span = Math.max(0, e.arcB - e.arcA);
    const visivel = e.opacity > 0.001 && e.s > 0.5;
    el.style.opacity = String(e.opacity);
    el.style.visibility = visivel ? 'visible' : 'hidden';
    if (c.posicionado) el.style.transform = `translate(${e.cx - BASE / 2}px, ${e.cy - BASE / 2}px) scale(${e.s / BASE})`;
    if (!visivel) return;

    const t = trilho.current!;
    t.style.display = e.track > 0.001 ? '' : 'none';
    t.setAttribute('opacity', String(e.track));

    arco.current!.style.display = span > 0.001 ? '' : 'none';
    masc.current!.setAttribute('stroke-dasharray', `${span} 3`);
    masc.current!.setAttribute('stroke-dashoffset', String(-e.arcA));

    const h = haste.current!;
    const { base, altura } = SIMBOLO.haste;
    h.style.display = e.stem > 0.01 ? '' : 'none';
    h.setAttribute('y', String(base - altura * e.stem));
    h.setAttribute('height', String(Math.max(0, altura * e.stem)));

    const a = anel.current!;
    const mostraAnel = e.ring > 0.001 && e.ringOp > 0.001;
    a.style.display = mostraAnel ? '' : 'none';
    if (mostraAnel) {
      const { cx, cy, r } = SIMBOLO.bojo;
      a.setAttribute('d', ringD(cx, cy, r * e.ringScale, e.ring));
      a.setAttribute('transform', `rotate(${e.rot} ${cx} ${cy})`);
      a.setAttribute('stroke-width', String(c.ringW / k));
      a.setAttribute('stroke-dasharray', `${c.dash / k} ${c.gap / k}`);
      a.setAttribute('opacity', String(e.ringOp));
    }
  };

  useImperativeHandle(ref, () => ({
    set: (e) => {
      Object.assign(estado.current, e);
      aplicar();
    },
  }));

  // Estado inicial a partir das props (e quando elas mudarem).
  const { cx, cy, s, stem, arcA, arcB, track, ring, ringOp, rot, ringScale, opacity } = props;
  useLayoutEffect(() => {
    cfg.current = { ringW, dash, gap, posicionado };
    const ini: EstadoMarca = { cx, cy, s, stem, arcA, arcB, track, ring, ringOp, rot, ringScale, opacity };
    for (const k of Object.keys(ini) as (keyof EstadoMarca)[]) if (ini[k] !== undefined) estado.current[k] = ini[k]!;
    aplicar();
  }, [cx, cy, s, stem, arcA, arcB, track, ring, ringOp, rot, ringScale, opacity, ringW, dash, gap, posicionado]);

  const lado = posicionado ? BASE : (s ?? 48);
  return (
    <svg
      ref={svg}
      width={lado}
      height={lado}
      viewBox="0 0 48 48"
      aria-hidden
      className={className}
      style={{
        overflow: 'visible',
        // Antes do JS rodar, o símbolo fica com a opacidade inicial pedida
        // (no splash, 0: a tela começa preta, igual ao primeiro quadro).
        opacity: opacity ?? 1,
        ...(posicionado ? { position: 'absolute', left: 0, top: 0, transformOrigin: '50% 50%', willChange: 'transform' } : null),
        ...style,
      }}
    >
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x="-12" y="-12" width="72" height="72">
          <path ref={masc} d={SIMBOLO.mascara} fill="none" stroke="#fff" strokeWidth={SIMBOLO.mascaraTraco} pathLength={1} />
        </mask>
      </defs>
      <path ref={trilho} d={SIMBOLO.arco} fill={arcColor} />
      <path ref={arco} d={SIMBOLO.arco} fill={arcColor} mask={`url(#${id})`} />
      <rect ref={haste} x={SIMBOLO.haste.x} width={SIMBOLO.haste.largura} rx={SIMBOLO.haste.raio} fill={stemColor} />
      <path ref={anel} fill="none" stroke={ringColor} />
    </svg>
  );
}
