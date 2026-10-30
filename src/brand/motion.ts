/**
 * Movimento da marca: as três curvas (enter, draw, pop) e os ajudantes de
 * tempo, portados 1:1 de referencias-html (animations-v3.jsx + prog-loaders.jsx).
 * Todo valor visual dos loaders é função pura do tempo T (segundos).
 *
 * Aceite do handoff: draw(0.5) === 0.5, enter(1) === 1 e pop passa de 1
 * perto de t = 0,6.
 */
import { TEMPO } from './tokens';

export type Curva = (t: number) => number;

/** easeOutExpo: elementos que chegam ou voam. */
export const enter: Curva = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
/** easeInOutCubic: traços, fades e saídas. */
export const draw: Curva = (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1);
/** easeOutBack (c1 = 1.70158): haste do P, cards e bottom sheet. */
export const pop: Curva = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export const CURVA = { enter, draw, pop } as const;

export const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** Um trecho: devolve `de` antes do início, `para` depois do fim e a curva
 *  no meio (é o `animate` da referência). */
export function tween(T: number, inicio: number, fim: number, de = 0, para = 1, curva: Curva = draw) {
  if (T <= inicio) return de;
  if (T >= fim) return para;
  return de + (para - de) * curva((T - inicio) / (fim - inicio));
}

/** Keyframes por trecho, cada trecho com a curva dada. */
export function interpolate(chaves: readonly number[], valores: readonly number[], curva: Curva = (t) => t) {
  return (T: number) => {
    if (T <= chaves[0]) return valores[0];
    const n = chaves.length - 1;
    if (T >= chaves[n]) return valores[n];
    for (let i = 0; i < n; i++) {
      if (T >= chaves[i] && T <= chaves[i + 1]) {
        const vao = chaves[i + 1] - chaves[i];
        const local = vao === 0 ? 0 : (T - chaves[i]) / vao;
        return valores[i] + (valores[i + 1] - valores[i]) * curva(local);
      }
    }
    return valores[n];
  };
}

/** O relógio da referência (`useMo`): enter/draw/pop no formato
 *  (início, fim, de = 0, para = 1), todos lendo o mesmo T. */
export function relogio(T: number) {
  const mk = (c: Curva) => (s: number, e: number, f = 0, t = 1) => tween(T, s, e, f, t, c);
  return { T, enter: mk(enter), draw: mk(draw), pop: mk(pop) };
}

/** Círculo tracejado desenhado em sentido horário a partir do topo. */
export function ringD(cx: number, cy: number, r: number, p: number) {
  p = clamp(p);
  if (p <= 0.001) return '';
  if (p >= 0.999) return `M${cx} ${cy - r}A${r} ${r} 0 1 1 ${cx} ${cy + r}A${r} ${r} 0 1 1 ${cx} ${cy - r}`;
  const a = -Math.PI / 2 + p * 2 * Math.PI;
  return `M${cx} ${cy - r}A${r} ${r} 0 ${p > 0.5 ? 1 : 0} 1 ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
}

/** "000%" como na referência. */
export const pct = (p: number) => String(Math.round(clamp(p) * 100)).padStart(3, '0') + '%';

/** Spinner do P (loop de 1,3 s): o trecho visível do arco corre e fecha. */
export function fasesSpinner(t: number) {
  const c = TEMPO.cicloSpinner;
  const ph = (((t % c) + c) % c) / c;
  return { arcB: draw(clamp(ph / 0.6)), arcA: draw(clamp((ph - 0.4) / 0.6)) };
}

/** Progresso real suavizado (doc 04): exibido += (alvo − exibido)·(1 − e^(−dt/0,12)),
 *  limitado a 1,5/s, para a barra nunca saltar. */
export function suavizar(exibido: number, alvo: number, dt: number) {
  const passo = (alvo - exibido) * (1 - Math.exp(-dt / TEMPO.suavizacao));
  const max = TEMPO.velocidadeMax * dt;
  return exibido + clamp(passo, -max, max);
}
