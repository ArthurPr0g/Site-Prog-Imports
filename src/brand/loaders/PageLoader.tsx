'use client';

import { useLayoutEffect, useId, useEffect, useRef } from 'react';
import { COR, FONTE, MEDIDA, TEMPO, marcaCssVars } from '../tokens';
import { fontesDaMarca } from '../fontes';
import { clamp, CURVA, fasesSpinner, pct, suavizar } from '../motion';
import { ProgMark, type ProgMarkHandle } from '../ProgMark';
import { useMobile, useMovimentoReduzido, useTimeline } from '../useTimeline';
import { Barra, SoLeitor, opac, preencher, texto, coletarNos, type Nos } from './comum';

type Props = {
  /** Progresso real (0..1). Sem ele, o P vira spinner (não há o que medir). */
  progresso?: number;
  /** O que está acontecendo, em caixa alta (ex.: "ABRINDO VENDAS"). */
  rotulo: string;
  modo?: 'desktop' | 'mobile';
  /** Altura mínima da área (padrão: boa parte da tela). */
  altura?: string;
};

/**
 * Cena 2 — carregamento de página: o arco do P é a barra de progresso.
 * Usado no loading.tsx do admin. Só aparece se a espera passar de 300 ms
 * (navegação rápida não pisca loader) e o progresso exibido é suavizado.
 */
export function PageLoader({ progresso, rotulo, modo, altura = '62vh' }: Props) {
  const mobileTela = useMobile();
  const G = (modo ? modo === 'mobile' : mobileTela) ? MEDIDA.pagina.mobile : MEDIDA.pagina.desktop;
  const reduzido = useMovimentoReduzido();
  const nos = useRef<Nos>({});
  // Os nós da cena (data-no), achados depois de montar; a timeline escreve neles.
  const ps = 'ps' + useId().replace(/[^a-zA-Z0-9]/g, '');
  useLayoutEffect(() => {
    nos.current = coletarNos(ps);
  });
  const marca = useRef<ProgMarkHandle>(null);
  const alvo = useRef(progresso);
  useEffect(() => {
    alvo.current = progresso;
  });
  const exibido = useRef(0);

  useTimeline((t, dt) => {
    const n = nos.current;
    const espera = TEMPO.esperaMinima;
    const ap = reduzido ? clamp((t - espera) / TEMPO.fadeReduzido) : CURVA.draw(clamp((t - espera) / 0.4));
    opac(n.caixa, ap);
    if (ap <= 0) return;

    const temProgresso = alvo.current !== undefined;
    if (temProgresso) exibido.current = suavizar(exibido.current, clamp(alvo.current!), dt);
    texto(n.pct, temProgresso ? pct(exibido.current) : '');

    if (reduzido) {
      marca.current?.set({ stem: 1, arcA: 0, arcB: 1, track: 0, ring: 0 });
      opac(n.barra, temProgresso ? 1 : 0);
      preencher(n.fill, exibido.current);
      return;
    }
    const sp = fasesSpinner(t - espera);
    marca.current?.set({
      stem: 1,
      arcA: temProgresso ? 0 : sp.arcA,
      arcB: temProgresso ? exibido.current : sp.arcB,
      track: 0.2,
      ring: 1,
      ringOp: 0.75,
      // 50°/s com progresso (cena do site); 90°/s como spinner (design system).
      rot: t * (temProgresso ? 50 : 90),
    });
  });

  return (
    <div data-ps={ps} role="status" aria-live="polite" className={fontesDaMarca} style={{ ...marcaCssVars, position: 'relative', minHeight: altura, display: 'grid', placeItems: 'center' }}>
      <SoLeitor>{rotulo.toLowerCase()}</SoLeitor>
      <div data-no="caixa" aria-hidden style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0, visibility: 'hidden' }}>
        <ProgMark
          ref={marca}
          s={G.s}
          stem={1}
          arcB={0}
          ringColor={COR.accent}
          ringW={G.anel.w}
          dash={G.anel.dash}
          gap={G.anel.gap}
        />
        <div
          style={{ marginTop: G.textoY - G.s / 2, fontFamily: FONTE.mono, fontSize: G.fonte, letterSpacing: G.espaco, color: COR.dim, whiteSpace: 'nowrap' }}
        >
          {rotulo}
          <span data-no="pct" style={{ color: COR.accent, letterSpacing: G.espacoPct, marginLeft: G.fonte * 0.6 }} />
        </div>
        <div style={{ position: 'relative', width: G.s * 1.7, height: 3, marginTop: 16 }}>
          <div data-no="barra" style={{ opacity: 0, visibility: 'hidden' }}>
            <Barra noFill="fill" style={{ left: 0, top: 0, width: '100%' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
