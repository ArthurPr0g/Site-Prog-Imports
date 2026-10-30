'use client';

import { useLayoutEffect, useId, useEffect, useRef, useState } from 'react';
import { CARD, COR, FONTE, MEDIDA, TEMPO, marcaCssVars } from '../tokens';
import { fontesDaMarca } from '../fontes';
import { clamp, fasesSpinner, lerp, pct, relogio, suavizar } from '../motion';
import { ProgMark, type ProgMarkHandle } from '../ProgMark';
import { useMobile, useMovimentoReduzido, useTimeline } from '../useTimeline';
import { Barra, Palco, SoLeitor, caixa, opac, preencher, texto, coletarNos, type Nos } from './comum';

type Props = {
  /** Progresso real da geração (0..1). Sem ele, o P vira spinner e some a %. */
  progresso?: number;
  /** O documento ficou pronto: roda o fechamento (círculo de tinta). */
  pronto: boolean;
  onFim?: () => void;
  /** Texto do que está acontecendo (padrão: "GERANDO PROPOSTA COMERCIAL"). */
  rotulo?: string;
  modo?: 'desktop' | 'mobile';
  contido?: boolean;
};

// O círculo de papel cobre a tela em 1 s; a cena do documento começa aí (D).
const D = 1.0;
const FIM_CONSTRUCAO = D + 2.2;

/**
 * Cena 4 — geração de proposta/PDF, em tema claro (a cor do documento).
 * gerando(p) → pronto → fechamento: o ladrilho vira o ícone limpo, colapsa e
 * um círculo de tinta fecha a tela antes de devolver o sistema.
 */
export function DocLoader({ progresso, pronto, onFim, rotulo, modo, contido }: Props) {
  const mobileTela = useMobile();
  const G = (modo ? modo === 'mobile' : mobileTela) ? MEDIDA.documento.mobile : MEDIDA.documento.desktop;
  const reduzido = useMovimentoReduzido();
  const [ativo, setAtivo] = useState(true);
  const nos = useRef<Nos>({});
  // Os nós da cena (data-no), achados depois de montar; a timeline escreve neles.
  const ps = 'ps' + useId().replace(/[^a-zA-Z0-9]/g, '');
  useLayoutEffect(() => {
    nos.current = coletarNos(ps);
  });
  const marca = useRef<ProgMarkHandle>(null);
  const prontoRef = useRef(pronto);
  useEffect(() => {
    prontoRef.current = pronto;
  });
  const alvo = useRef(progresso);
  useEffect(() => {
    alvo.current = progresso;
  });
  const onFimRef = useRef(onFim);
  useEffect(() => {
    onFimRef.current = onFim;
  });
  const st = useRef({ exibido: 0, prontoEm: -1, fim: false });

  useTimeline((t, dt) => {
    const s = st.current;
    const n = nos.current;
    const { draw, pop } = relogio(t);
    const L = G.ladrilho;
    const temProgresso = alvo.current !== undefined;
    if (temProgresso) s.exibido = suavizar(s.exibido, clamp(alvo.current!), dt);

    // Pronto só depois da construção do símbolo e com a barra cheia.
    if (s.prontoEm < 0 && prontoRef.current && t >= FIM_CONSTRUCAO && (!temProgresso || s.exibido > 0.995)) s.prontoEm = t;
    const Tc = s.prontoEm < 0 ? 1e9 : s.prontoEm + 0.45;
    const c = (x: number) => Tc + (x - 3.4); // tempos da referência (D + x) a partir do fechamento

    if (reduzido) {
      const entra = clamp(t / TEMPO.fadeReduzido);
      const sai = s.prontoEm < 0 ? 0 : clamp((t - s.prontoEm) / TEMPO.fadeReduzido);
      opac(n.raiz, entra * (1 - sai));
      if (sai >= 1 && !s.fim) {
        s.fim = true;
        setAtivo(false);
        onFimRef.current?.();
      }
      if (n.papel) n.papel.style.clipPath = 'none';
      opac(n.ladrilho, 1);
      opac(n.gradeL, 0);
      opac(n.fundoGrade, 0);
      opac(n.rot, 0);
      for (const g of ['h0', 'h1', 'h2', 'v0', 'v1']) opac(n[g], 0);
      marca.current?.set({ stem: 1, arcA: 0, arcB: 1, ring: 0 });
      opac(n.textos, 1);
      opac(n.barra, temProgresso ? 1 : 0);
      preencher(n.fill, s.exibido);
      texto(n.pct, temProgresso ? pct(s.exibido) : '');
      return;
    }

    // Círculo de papel abrindo a cena (o "tema claro" chega por ele).
    // Em % da tela (o overlay é a tela toda, fora do palco): 75% cobre os cantos.
    if (n.papel) n.papel.style.clipPath = `circle(${75 * draw(0, D)}% at ${(G.papel.cx / G.W) * 100}% ${(G.papel.cy / G.H) * 100}%)`;

    const tIn = pop(D + 0.15, D + 0.75);
    const up = draw(c(3.9), c(4.1));
    const down = draw(c(4.1), c(4.5));
    const escala = lerp(0.86, 1, tIn) * (1 + 0.05 * up) * (1 - down);
    const tOp = clamp(tIn * 2) * (1 - draw(c(4.3), c(4.5)));
    const gOp = 1 - draw(c(3.4), c(3.8));
    opac(n.ladrilho, tOp);
    if (n.ladrilho) {
      n.ladrilho.style.transform = `scale(${escala})`;
      n.ladrilho.style.borderColor = COR.bordaLadrilho(0.35 * gOp + 0.08);
    }
    opac(n.gradeL, gOp);
    opac(n.fundoGrade, draw(D, D + 0.7) * (1 - draw(c(3.6), c(4.3))));

    [6, 30, 42].forEach((u, i) => {
      caixa(n['h' + i], { width: L.tam * draw(D + 0.4 + i * 0.1, D + 1.0 + i * 0.1) });
      opac(n['h' + i], 0.45 * gOp);
    });
    [9.75, 38.25].forEach((u, i) => {
      caixa(n['v' + i], { height: L.tam * draw(D + 0.55 + i * 0.1, D + 1.15 + i * 0.1) });
      opac(n['v' + i], 0.35 * gOp);
    });
    opac(n.rot, draw(D + 0.9, D + 1.3) * gOp);

    // Arco: constrói; sem progresso mensurável, vira spinner até ficar pronto.
    let arcA = 0;
    let arcB = draw(D + 1.4, D + 2.2);
    if (!temProgresso && t > FIM_CONSTRUCAO) {
      const sp = fasesSpinner(t - FIM_CONSTRUCAO + 0.6 * TEMPO.cicloSpinner);
      const fin = s.prontoEm < 0 ? 0 : draw(s.prontoEm, s.prontoEm + 0.45);
      arcA = sp.arcA * (1 - fin);
      arcB = sp.arcB + (1 - sp.arcB) * fin;
    }
    marca.current?.set({ stem: pop(D + 1.1, D + 1.6), arcA, arcB, ring: draw(D + 0.7, D + 1.4), ringOp: gOp, s: L.tam, cx: L.tam / 2, cy: L.tam / 2 });

    opac(n.textos, draw(D + 0.4, D + 0.8) * (1 - draw(c(3.8), c(4.1))));
    opac(n.barra, temProgresso ? 1 : 0);
    preencher(n.fill, s.exibido);
    texto(n.pct, temProgresso ? pct(s.exibido) : '');

    // Círculo de tinta fecha a tela; depois o overlay some e devolve o sistema.
    const tinta = draw(c(4.35), c(5.3));
    opac(n.tinta, tinta > 0.001 ? 1 : 0);
    if (n.tinta) n.tinta.style.clipPath = `circle(${80 * tinta}% at ${(L.cx / G.W) * 100}% ${(L.cy / G.H) * 100}%)`;
    const sai = draw(c(5.3), c(5.6));
    opac(n.raiz, 1 - sai);
    if (sai >= 1 && !s.fim) {
      s.fim = true;
      setAtivo(false);
      onFimRef.current?.();
    }
  }, ativo);

  if (!ativo) return null;
  const L = G.ladrilho;
  const R = G.rotulo;
  const T = G.texto;
  const k = L.tam / 48;
  const grade = (passo: number, cor: string) => ({
    backgroundImage: `linear-gradient(${cor} 1px, transparent 1px), linear-gradient(90deg, ${cor} 1px, transparent 1px)`,
    backgroundSize: `${passo}px ${passo}px`,
  });
  const mascara = `radial-gradient(circle at ${L.cx}px ${L.cy}px, #000 0, #000 ${G.fundoGrade.raio0}px, transparent ${G.fundoGrade.raio1}px)`;
  const guia = { position: 'absolute', background: COR.accentDark, visibility: 'hidden' } as const;

  return (
    <div
      data-ps={ps}
      data-no="raiz"
      role="status"
      aria-live="polite"
      className={fontesDaMarca}
      style={{ ...marcaCssVars, position: contido ? 'absolute' : 'fixed', inset: 0, zIndex: 200, overflow: 'hidden' }}
    >
      <SoLeitor>{(rotulo ?? T.rotulo).toLowerCase()}</SoLeitor>
      <div data-no="papel" aria-hidden style={{ position: 'absolute', inset: 0, background: COR.paper, clipPath: 'circle(0px at 50% 50%)' }}>
        <Palco W={G.W} H={G.H}>
          <div data-no="fundoGrade" style={{ position: 'absolute', inset: 0, opacity: 0, ...grade(G.fundoGrade.passo, COR.gradeClara), backgroundPosition: G.fundoGrade.posicao, maskImage: mascara, WebkitMaskImage: mascara }} />
          <div
            data-no="ladrilho"
            style={{
              position: 'absolute', left: L.cx - L.tam / 2, top: L.cy - L.tam / 2, width: L.tam, height: L.tam, borderRadius: L.raio, overflow: 'hidden',
              ...CARD.elevadoClaro, boxShadow: G === MEDIDA.documento.mobile ? COR.sombraLadrilhoMobile : COR.sombraLadrilho,
              border: `${L.borda}px solid ${COR.bordaLadrilho(0.43)}`, opacity: 0, visibility: 'hidden',
            }}
          >
            <div data-no="gradeL" style={{ position: 'absolute', inset: 0, ...grade(L.grade, COR.gradeLadrilho) }} />
            {[6, 30, 42].map((u, i) => <div key={u} data-no={'h' + i} style={{ ...guia, left: 0, top: u * k - L.guia / 2, height: L.guia, width: 0 }} />)}
            {[9.75, 38.25].map((u, i) => <div key={u} data-no={'v' + i} style={{ ...guia, top: 0, left: u * k - L.guia / 2, width: L.guia, height: 0 }} />)}
            <ProgMark
              ref={marca}
              posicionado
              cx={L.tam / 2}
              cy={L.tam / 2}
              s={L.tam}
              stem={0}
              arcB={0}
              ring={0}
              stemColor={COR.ink}
              arcColor={COR.accentDark}
              ringColor={COR.accentDark}
              ringW={G.anel.w}
              dash={G.anel.dash}
              gap={G.anel.gap}
            />
            <div data-no="rot" style={{ position: 'absolute', right: R.direita, top: R.topo, fontFamily: FONTE.mono, fontSize: R.fonte, letterSpacing: R.espaco, color: COR.accentDark, opacity: 0 }}>PROG · 02</div>
          </div>
          <div data-no="textos" style={{ opacity: 0 }}>
            <div style={{ position: 'absolute', left: 0, top: T.y, width: G.W, textAlign: 'center', fontFamily: FONTE.mono, fontSize: T.fonte, letterSpacing: T.espaco, color: COR.mutedDark }}>
              {rotulo ?? T.rotulo}
              <span data-no="pct" style={{ color: COR.accentDark, letterSpacing: T.espacoPct, marginLeft: T.fonte * 0.6 }} />
            </div>
            <div data-no="barra" style={{ opacity: 0 }}>
              <Barra light noFill="fill" style={{ left: G.barra.x, top: G.barra.y, width: G.barra.w }} />
            </div>
          </div>
        </Palco>
      </div>
      <div data-no="tinta" aria-hidden style={{ position: 'absolute', inset: 0, background: COR.ink, opacity: 0, clipPath: 'circle(0% at 50% 50%)' }} />
    </div>
  );
}
