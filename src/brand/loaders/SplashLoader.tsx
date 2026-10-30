'use client';

import { useLayoutEffect, useId, useEffect, useRef, useState } from 'react';
import { COR, FONTE, MEDIDA, TEMPO, marcaCssVars } from '../tokens';
import { fontesDaMarca } from '../fontes';
import { clamp, fasesSpinner, interpolate, lerp, pct, relogio, CURVA } from '../motion';
import { ProgMark, type ProgMarkHandle } from '../ProgMark';
import { ProgWordmark, type ProgWordmarkHandle } from '../ProgWordmark';
import { useMobile, useMovimentoReduzido, useTimeline } from '../useTimeline';
import { Barra, Palco, SoLeitor, caixa, opac, preencher, texto, coletarNos, type Nos } from './comum';

import { CHAVE_SPLASH, CLASSE_SPLASH_VISTO } from './sessao';

// Marcos da timeline (s), de prog-loaders.jsx.
const FIM_CONSTRUCAO = 2.5;
const FIM_LOCKUP = 4.75; // wordmark revelado
const SAIDA = 0.45; // fade do overlay
const SEGURA_MAX = 6; // nunca prende o admin mais que isso esperando

type Props = {
  /** Ignora o sessionStorage (prévia). */
  forcar?: boolean;
  /** Dentro de uma caixa (prévia) em vez de cobrir a tela. */
  contido?: boolean;
  modo?: 'desktop' | 'mobile';
  /** Pronto controlado de fora; sem isso, pronto = evento `load` da janela. */
  pronto?: boolean;
  onFim?: () => void;
};

/**
 * Cena 1 — abertura do app (cold start). Máquina de estados do doc 04:
 * construindo (0–2,5 s) → aguardando (spinner do P, se o app ainda não
 * carregou) → lockup (≥ 0,8 s) → saída. Só no primeiro acesso da sessão.
 */
export function SplashLoader({ forcar, contido, modo, pronto, onFim }: Props) {
  const mobileTela = useMobile();
  const mobile = modo ? modo === 'mobile' : mobileTela;
  const G = mobile ? MEDIDA.splash.mobile : MEDIDA.splash.desktop;
  const reduzido = useMovimentoReduzido();
  const [ativo, setAtivo] = useState(true);
  const nos = useRef<Nos>({});
  // Os nós da cena (data-no), achados depois de montar; a timeline escreve neles.
  const ps = 'ps' + useId().replace(/[^a-zA-Z0-9]/g, '');
  useLayoutEffect(() => {
    nos.current = coletarNos(ps);
  });
  const marca = useRef<ProgMarkHandle>(null);
  const palavra = useRef<ProgWordmarkHandle>(null);

  const prontoRef = useRef(false);
  const st = useRef({ T: 0, segurando: false, segurou: false, tSeg: 0, finIni: -1, rot: 0, saidaIni: -1, tReal: 0, fim: false });

  // Primeiro acesso da sessão? Se não, some sem animar (o CSS já escondeu).
  useEffect(() => {
    if (forcar) return;
    try {
      if (sessionStorage.getItem(CHAVE_SPLASH)) {
        // O sessionStorage só existe depois de hidratar; o CSS já escondeu o
        // overlay antes da pintura, aqui ele só sai da árvore.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAtivo(false);
        return;
      }
      sessionStorage.setItem(CHAVE_SPLASH, '1');
    } catch {
      /* sem storage (aba privada): mostra uma vez nesta carga */
    }
  }, [forcar]);

  // Pronto = a página terminou de carregar (ou o valor de fora).
  useEffect(() => {
    if (pronto !== undefined) {
      prontoRef.current = pronto;
      return;
    }
    if (document.readyState === 'complete') prontoRef.current = true;
    else {
      const ok = () => (prontoRef.current = true);
      window.addEventListener('load', ok, { once: true });
      return () => window.removeEventListener('load', ok);
    }
  }, [pronto]);

  const terminar = () => {
    setAtivo(false);
    onFim?.();
  };

  useTimeline((t, dt) => {
    const s = st.current;
    const n = nos.current;
    s.tReal = t;

    // ── Avança o relógio da cena (segura no spinner se não estiver pronto).
    let arcA = 0;
    let arcB: number | null = null;
    if (reduzido) {
      s.T = FIM_LOCKUP;
    } else if (s.segurando) {
      s.tSeg += dt;
      s.rot += dt * 90;
      if ((prontoRef.current || s.tSeg > SEGURA_MAX) && s.finIni < 0) s.finIni = s.tSeg;
      const { arcA: la, arcB: lb } = fasesSpinner(s.tSeg);
      const fin = s.finIni < 0 ? 0 : CURVA.draw(clamp((s.tSeg - s.finIni) / 0.45));
      arcA = la * (1 - fin);
      arcB = lb + (1 - lb) * fin;
      if (fin >= 1) s.segurando = false;
    } else {
      s.T += dt;
      if (!s.segurou && s.T >= FIM_CONSTRUCAO && !prontoRef.current) {
        s.T = FIM_CONSTRUCAO;
        s.segurando = true;
        s.segurou = true;
        // Entra no spinner na fase em que o arco está inteiro (sem salto).
        s.tSeg = 0.6 * TEMPO.cicloSpinner;
      }
    }
    const T = s.T;
    const { enter, draw, pop } = relogio(T);

    // ── Saída: lockup visível pelo menos 0,8 s e o app pronto.
    if (s.saidaIni < 0) {
      const lockupOk = reduzido ? t >= TEMPO.lockupMinimo : T >= FIM_LOCKUP + TEMPO.lockupMinimo;
      if (lockupOk && (prontoRef.current || t > SEGURA_MAX + 4)) s.saidaIni = t;
    }
    const dur = reduzido ? TEMPO.fadeReduzido : SAIDA;
    const saida = s.saidaIni < 0 ? 0 : CURVA.draw(clamp((t - s.saidaIni) / dur));
    opac(n.raiz, 1 - saida);
    if (saida >= 1) {
      if (!s.fim) terminar();
      s.fim = true;
      return;
    }
    opac(n.conteudo, reduzido ? clamp(t / TEMPO.fadeReduzido) : 1);

    // ── Geometria da marca: splash → lockup.
    let cx: number = G.marca.cx;
    let cy: number = G.marca.cy;
    let sz = lerp(G.marca.s0, G.marca.s1, draw(0, 3.4));
    const a = enter(3.35, 4.35);
    cx = lerp(cx, G.lockup.cx, a);
    cy = lerp(cy, G.lockup.cy, a);
    sz = lerp(sz, G.lockup.s, a);
    marca.current?.set({
      cx, cy, s: sz,
      opacity: 1,
      stem: reduzido ? 1 : pop(1.3, 1.95),
      arcA,
      arcB: reduzido ? 1 : arcB ?? draw(1.7, 2.5),
      track: s.segurando ? 0.16 * clamp((s.tSeg - 0.6 * TEMPO.cicloSpinner) / 0.3) : 0,
      ring: draw(0.8, 1.6),
      ringOp: 0.9 * (1 - draw(3.3, 3.8)),
      rot: s.rot,
    });
    palavra.current?.set({ reveal: reduzido ? 1 : enter(3.85, 4.75) });

    // ── Fundo: auras (radial-gradient, sem blur) e grade com máscara radial.
    const aura = reduzido ? 1 : draw(0, 1.2);
    const tt = s.tReal;
    opac(n.aura1, aura);
    opac(n.aura2, aura);
    if (n.aura1) n.aura1.style.transform = `translate(${Math.sin(tt * 0.4) * G.auraAzul.ax}px, ${Math.cos(tt * 0.3) * G.auraAzul.ay}px)`;
    if (n.aura2) n.aura2.style.transform = `translate(${Math.cos(tt * 0.35) * G.auraRoxa.ax}px, ${Math.sin(tt * 0.28) * G.auraRoxa.ay}px)`;
    const gridU = draw(0, 0.9) * (1 - 0.75 * draw(3.3, 4.2));
    const gridR = lerp(0, G.grade.raio, enter(0, 1.4));
    opac(n.grade, gridU);
    if (n.grade && gridU > 0.001) {
      const m = `radial-gradient(circle at ${G.marca.cx}px ${G.marca.cy}px, #000 0, #000 ${gridR * 0.35}px, transparent ${gridR}px)`;
      n.grade.style.maskImage = m;
      n.grade.style.webkitMaskImage = m;
    }

    // ── Guias de construção, ancoradas na marca do quadro.
    const k = sz / 48;
    const X = (u: number) => cx + (u - 24) * k;
    const Yu = (u: number) => cy + (u - 24) * k;
    const gw = G.guia;
    [6, 30, 42].forEach((u, i) => {
      const ini = draw(3.25 + i * 0.06, 3.9 + i * 0.06);
      const fim = draw(0.3 + i * 0.12, 1.1 + i * 0.12);
      const el = n['h' + i];
      caixa(el, { left: ini * G.W, top: Yu(u) - gw / 2, width: (fim - ini) * G.W, height: gw });
      opac(el, reduzido || fim - ini <= 0.0005 ? 0 : u === 30 ? 0.5 : 0.34);
    });
    [9.75, 38.25].forEach((u, i) => {
      const ini = draw(3.3 + i * 0.06, 3.95 + i * 0.06);
      const fim = draw(0.5 + i * 0.12, 1.3 + i * 0.12);
      const el = n['v' + i];
      caixa(el, { left: X(u) - gw / 2, top: ini * G.H, width: gw, height: (fim - ini) * G.H });
      opac(el, reduzido || fim - ini <= 0.0005 ? 0 : 0.3);
    });

    // ── Cotas (8u, 36u, r 12u, 2,5u).
    const c = G.cota;
    const out = 1 - draw(3.05, 3.45);
    for (let i = 0; i < 4; i++) {
      const v = reduzido ? 0 : enter(1.95 + i * 0.18, 2.6 + i * 0.18) * out;
      const g = n['cota' + i];
      opac(g, v);
      if (g) g.style.transform = `translateY(${(1 - v) * c.sobe}px)`;
    }
    if (out > 0.001 && !reduzido) {
      caixa(n.c0a, { left: X(9.75), top: Yu(2.5), width: 8 * k, height: gw });
      caixa(n.c0b, { left: X(9.75), top: Yu(2.5) - c.tique, width: gw, height: 2 * c.tique });
      caixa(n.c0c, { left: X(17.75) - gw, top: Yu(2.5) - c.tique, width: gw, height: 2 * c.tique });
      caixa(n.c0t, { left: X(13.75), top: Yu(2.5) - c.rotulo8 });
      caixa(n.c1a, { left: X(5), top: Yu(6), width: gw, height: 36 * k });
      caixa(n.c1b, { left: X(5) - c.tique, top: Yu(6), width: 2 * c.tique, height: gw });
      caixa(n.c1c, { left: X(5) - c.tique, top: Yu(42) - gw, width: 2 * c.tique, height: gw });
      caixa(n.c1t, { left: X(5) - c.rotulo36x, top: Yu(24) - c.rotulo36y });
      const rx = 26.25 + 12 * Math.cos(-Math.PI / 4);
      const ry = 18 + 12 * Math.sin(-Math.PI / 4);
      caixa(n.c2a, { left: X(rx) - c.ponto / 2, top: Yu(ry) - c.ponto / 2, width: c.ponto, height: c.ponto });
      caixa(n.c2b, { left: X(rx) + c.ponto, top: Yu(ry) - gw / 2, width: c.linhaR, height: gw });
      caixa(n.c2t, { left: X(rx) + c.rotuloR, top: Yu(ry) - c.rotuloRy });
      caixa(n.c3a, { left: X(17.75), top: Yu(45.5), width: 2.5 * k, height: gw });
      caixa(n.c3b, { left: X(17.75), top: Yu(45.5) - c.tique, width: gw, height: 2 * c.tique });
      caixa(n.c3c, { left: X(20.25) - gw, top: Yu(45.5) - c.tique, width: gw, height: 2 * c.tique });
      caixa(n.c3t, { left: X(19), top: Yu(45.5) + c.rotulo25 });
    }

    // ── HUD e progresso.
    opac(n.hud, reduzido ? 0 : draw(0.2, 0.8) * (1 - draw(3.3, 3.8)));
    // O progresso é ilustrativo até o app ficar pronto; no movimento reduzido
    // vira uma barra linear que só fecha quando carrega.
    const prog = reduzido
      ? prontoRef.current ? 1 : Math.min(0.9, t / 2)
      : s.segurando
        ? 0.48 + 0.2 * (1 - Math.pow(2, -s.tSeg))
        : interpolate([0.2, 1.2, 2.2, 3.0, 4.3], [0, 0.22, 0.48, 0.71, 1], CURVA.draw)(T);
    opac(n.prog, reduzido ? 1 : draw(0.2, 0.7) * (1 - draw(5.0, 5.5)));
    preencher(n.fill, prog);
    texto(n.pct, pct(prog));
  }, ativo);

  if (!ativo) return null;

  const P = G.progresso;
  const lab = { position: 'absolute', fontFamily: FONTE.mono, fontSize: G.cota.fonte, color: COR.accentStrong, whiteSpace: 'nowrap' } as const;
  const linhaCota = { position: 'absolute', background: COR.accentStrong, opacity: 0.8 } as const;
  const guia = { position: 'absolute', background: COR.accent, visibility: 'hidden' } as const;

  return (
    <div
      data-ps={ps}
      data-no="raiz"
      className={`ps-splash ${contido ? '' : CLASSE_SPLASH_VISTO} ${fontesDaMarca}`}
      role="status"
      aria-live="polite"
      style={{ ...marcaCssVars, position: contido ? 'absolute' : 'fixed', inset: 0, zIndex: 200, background: COR.ink, overflow: 'hidden' }}
    >
      <SoLeitor>Abrindo o sistema Prog</SoLeitor>
      <div data-no="conteudo" aria-hidden style={{ position: 'absolute', inset: 0 }}>
        <Palco W={G.W} H={G.H}>
          <div
            data-no="aura1"
            style={{ position: 'absolute', width: G.auraAzul.tam, height: G.auraAzul.tam, left: G.auraAzul.x, top: G.auraAzul.y, borderRadius: '50%', background: `radial-gradient(circle, ${G.auraAzul.cor}, transparent 70%)`, opacity: 0 }}
          />
          <div
            data-no="aura2"
            style={{ position: 'absolute', width: G.auraRoxa.tam, height: G.auraRoxa.tam, left: G.auraRoxa.x, top: G.auraRoxa.y, borderRadius: '50%', background: `radial-gradient(circle, ${COR.auraRoxa}, transparent 70%)`, opacity: 0 }}
          />
          <div
            data-no="grade"
            style={{
              position: 'absolute', inset: 0, opacity: 0,
              backgroundImage: `linear-gradient(${COR.grade} 1px, transparent 1px), linear-gradient(90deg, ${COR.grade} 1px, transparent 1px)`,
              backgroundSize: `${G.grade.passo}px ${G.grade.passo}px`, backgroundPosition: G.grade.posicao,
            }}
          />
          {[0, 1, 2].map((i) => <div key={'h' + i} data-no={'h' + i} style={guia} />)}
          {[0, 1].map((i) => <div key={'v' + i} data-no={'v' + i} style={guia} />)}

          <div data-no="cota0" style={{ opacity: 0 }}>
            <div data-no="c0a" style={linhaCota} />
            <div data-no="c0b" style={linhaCota} />
            <div data-no="c0c" style={linhaCota} />
            <div data-no="c0t" style={{ ...lab, transform: 'translateX(-50%)' }}>8u</div>
          </div>
          <div data-no="cota1" style={{ opacity: 0 }}>
            <div data-no="c1a" style={linhaCota} />
            <div data-no="c1b" style={linhaCota} />
            <div data-no="c1c" style={linhaCota} />
            <div data-no="c1t" style={{ ...lab, transform: 'translateX(-100%)' }}>36u</div>
          </div>
          <div data-no="cota2" style={{ opacity: 0 }}>
            <div data-no="c2a" style={{ position: 'absolute', borderRadius: '50%', background: COR.accentStrong }} />
            <div data-no="c2b" style={linhaCota} />
            <div data-no="c2t" style={lab}>r 12u</div>
          </div>
          <div data-no="cota3" style={{ opacity: 0 }}>
            <div data-no="c3a" style={linhaCota} />
            <div data-no="c3b" style={linhaCota} />
            <div data-no="c3c" style={linhaCota} />
            <div data-no="c3t" style={{ ...lab, transform: 'translateX(-50%)' }}>2,5u</div>
          </div>

          <div data-no="hud" style={{ opacity: 0 }}>
            <div style={{ position: 'absolute', left: G.hud.lado, top: G.hud.topo, fontFamily: FONTE.mono, fontSize: G.hud.fonte, letterSpacing: '.22em', color: COR.accentStrong }}>PROG · 01</div>
            <div style={{ position: 'absolute', right: G.hud.lado, top: G.hud.topo, fontFamily: FONTE.mono, fontSize: G.hud.fonte, letterSpacing: '.22em', color: COR.dim }}>{G.hud.direita}</div>
          </div>

          <div data-no="prog" style={{ opacity: 0 }}>
            <div style={{ position: 'absolute', left: P.x, top: P.rotuloY, width: P.w, display: 'flex', justifyContent: 'space-between', fontFamily: FONTE.mono, fontSize: P.fonte, letterSpacing: P.espaco, color: COR.dim }}>
              <span>ABRINDO O SISTEMA</span>
              <span data-no="pct" style={{ color: COR.accent, letterSpacing: P.espacoPct }}>000%</span>
            </div>
            <Barra noFill="fill" style={{ left: P.x, top: P.barraY, width: P.w }} />
          </div>

          <ProgMark
            ref={marca}
            posicionado
            cx={G.marca.cx}
            cy={G.marca.cy}
            s={G.marca.s0}
            opacity={0}
            ringColor={COR.accentStrong}
            ringW={G.anel.w}
            dash={G.anel.dash}
            gap={G.anel.gap}
          />
          <ProgWordmark ref={palavra} x={G.palavra.x} cy={G.palavra.cy} size={G.palavra.size} reveal={0} />
        </Palco>
      </div>
    </div>
  );
}

