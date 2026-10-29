'use client';

// Luz que acompanha o cursor nos cartões de vidro do tema Apple (globals.css,
// ".tema-apple .bg-card"): grava a posição do ponteiro em --luz-x/--luz-y no
// cartão sob o cursor, e o CSS desenha um brilho radial nesse ponto. Um único
// ouvinte para a página toda; em tela de toque e com "reduzir movimento" não faz nada.

import { useEffect } from 'react';

export function LuzDoVidro() {
  useEffect(() => {
    if (window.matchMedia('(hover: none), (prefers-reduced-motion: reduce)').matches) return;
    let atual: HTMLElement | null = null;
    let quadro = 0;
    const mover = (e: PointerEvent) => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const alvo = (e.target as Element | null)?.closest?.('.tema-apple .bg-card') as HTMLElement | null;
        if (atual && atual !== alvo) atual.style.removeProperty('--luz');
        atual = alvo;
        if (!alvo) return;
        const r = alvo.getBoundingClientRect();
        alvo.style.setProperty('--luz-x', `${e.clientX - r.left}px`);
        alvo.style.setProperty('--luz-y', `${e.clientY - r.top}px`);
        alvo.style.setProperty('--luz', '1');
      });
    };
    document.addEventListener('pointermove', mover, { passive: true });
    return () => {
      cancelAnimationFrame(quadro);
      document.removeEventListener('pointermove', mover);
    };
  }, []);
  return null;
}
