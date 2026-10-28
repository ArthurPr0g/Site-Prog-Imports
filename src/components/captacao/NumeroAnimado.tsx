'use client';

// Número que corre até o valor: do zero quando aparece e do valor anterior
// quando muda (atualização automática), para a mudança ser vista.

import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

export const SUAVE = [0.22, 1, 0.36, 1] as const;

export function NumeroAnimado({
  valor,
  formato = (v) => Math.round(v).toLocaleString('pt-BR'),
  duracao = 1.1,
}: {
  valor: number;
  formato?: (v: number) => string;
  duracao?: number;
}) {
  const calmo = useReducedMotion();
  // Começa em 0 no servidor e no navegador: a hidratação bate.
  const [mostrado, setMostrado] = useState(0);
  const ultimo = useRef(0);
  useEffect(() => {
    const c = animate(ultimo.current, valor, {
      duration: calmo ? 0 : duracao,
      ease: SUAVE,
      onUpdate: (v) => {
        ultimo.current = v;
        setMostrado(v);
      },
      // Interrompida ou pulada, não pode parar no meio do caminho.
      onComplete: () => {
        ultimo.current = valor;
        setMostrado(valor);
      },
    });
    return () => c.stop();
  }, [valor, calmo, duracao]);
  return <>{formato(mostrado)}</>;
}

export const reais = (v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
