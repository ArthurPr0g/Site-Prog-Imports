'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { BREAKPOINT_MOBILE } from './tokens';

/**
 * Um único relógio rAF para a cena inteira. A cada quadro chama `quadro(t, dt)`
 * com o tempo em segundos desde o início; quem desenha escreve direto no
 * style/atributo dos nós (sem setState por quadro).
 *
 * Com a aba escondida o relógio para e, ao voltar, continua de onde parou
 * (sem pular etapas que ninguém viu).
 */
export function useTimeline(quadro: (t: number, dt: number) => void, ativo = true) {
  const cb = useRef(quadro);
  useEffect(() => {
    cb.current = quadro;
  });

  useEffect(() => {
    if (!ativo) return;
    let id = 0;
    let t = 0;
    let ultimo: number | null = null;

    const passo = (agora: number) => {
      const dt = ultimo === null ? 0 : Math.min(0.1, (agora - ultimo) / 1000);
      ultimo = agora;
      t += dt;
      cb.current(t, dt);
      id = requestAnimationFrame(passo);
    };
    const iniciar = () => {
      cancelAnimationFrame(id);
      ultimo = null;
      id = requestAnimationFrame(passo);
    };
    const aoMudarVisibilidade = () => {
      if (document.hidden) cancelAnimationFrame(id);
      else iniciar();
    };

    // Primeiro quadro síncrono: o estado inicial já sai certo, sem piscar.
    cb.current(0, 0);
    if (!document.hidden) iniciar();
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    };
  }, [ativo]);
}

function useMedia(query: string) {
  return useSyncExternalStore(
    (avisar) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', avisar);
      return () => m.removeEventListener('change', avisar);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** prefers-reduced-motion: símbolo sólido, barra linear e fade de 200 ms. */
export const useMovimentoReduzido = () => useMedia('(prefers-reduced-motion: reduce)');

/** Até 600 px vale o layout mobile das referências. */
export const useMobile = () => useMedia(`(max-width: ${BREAKPOINT_MOBILE}px)`);
