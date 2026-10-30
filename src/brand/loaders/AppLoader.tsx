'use client';

import { useId, useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { CARD, COR, FONTE, MEDIDA, RAIO, TEMPO, marcaCssVars } from '../tokens';
import { clamp, fasesSpinner, lerp, relogio, suavizar } from '../motion';
import { fontesDaMarca } from '../fontes';
import { ProgMark, type ProgMarkHandle } from '../ProgMark';
import { useMobile, useMovimentoReduzido, useTimeline } from '../useTimeline';
import { Barra, SoLeitor, opac, preencher, coletarNos, type Nos } from './comum';

export type EtapaCarregamento = { nome: string; feita: boolean };

type Props = {
  /** O que está acontecendo, em palavras (ex.: "Buscando os projetos").
   *  Vai para o leitor de tela e vira a etapa única. Nada de "Carregando...". */
  rotulo: string;
  /** Etapas reais (cada uma uma promise). O spinner só fecha quando todas terminam. */
  etapas?: EtapaCarregamento[];
  /** Progresso real 0..1; sem ele e sem etapas, não há barra. */
  progresso?: number;
  modo?: 'desktop' | 'mobile';
  /** Na prévia o bottom sheet fica dentro da caixa, não na tela inteira. */
  contido?: boolean;
  /** Altura mínima da área do esqueleto. */
  altura?: number;
  /** Chamado quando o card terminou de sair (todas as etapas feitas). */
  onFim?: () => void;
};

/**
 * Cena 3 — painel carregando dados no cliente: esqueleto com brilho passando
 * e o card (desktop) ou bottom sheet (≤ 600 px) com o spinner do P e as
 * etapas. Quem usa só troca o "Carregando…" por <AppLoader/>; quando os dados
 * chegam, o painel desmonta o loader como antes.
 */
export function AppLoader({ rotulo, etapas, progresso, modo, contido, altura = 480, onFim }: Props) {
  const mobileTela = useMobile();
  const mobile = modo ? modo === 'mobile' : mobileTela;
  const G = mobile ? MEDIDA.painel.mobile : MEDIDA.painel.desktop;
  const reduzido = useMovimentoReduzido();
  const nos = useRef<Nos>({});
  // Os nós da cena (data-no), achados depois de montar; a timeline escreve neles.
  const ps = 'ps' + useId().replace(/[^a-zA-Z0-9]/g, '');
  useLayoutEffect(() => {
    nos.current = coletarNos(ps);
  });
  const marca = useRef<ProgMarkHandle>(null);
  const area = useRef<HTMLDivElement>(null);
  const esqueletos = useRef<{ el: HTMLElement; x: number }[]>([]);

  const lista = etapas && etapas.length ? etapas : [{ nome: rotulo, feita: false }];
  const listaRef = useRef(lista);
  useEffect(() => {
    listaRef.current = lista;
  });
  const alvo = useRef(progresso);
  useEffect(() => {
    alvo.current = progresso;
  });
  const st = useRef({ marcos: [] as { ap: number; dn: number }[], finIni: -1, exibido: 0, fimAvisado: false });
  const onFimRef = useRef(onFim);
  useEffect(() => {
    onFimRef.current = onFim;
  });

  // Posição de cada bloco de esqueleto na área: o brilho é uma faixa só
  // atravessando a área inteira, então cada bloco desloca o seu fundo.
  useLayoutEffect(() => {
    const a = area.current;
    if (!a) return;
    const medir = () => {
      const base = a.getBoundingClientRect().left;
      esqueletos.current = Array.from(a.querySelectorAll<HTMLElement>('[data-esq]')).map((el) => ({ el, x: el.getBoundingClientRect().left - base }));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(a);
    return () => ro.disconnect();
  }, [mobile]);

  useTimeline((t, dt) => {
    const s = st.current;
    const n = nos.current;
    const { enter, draw, pop } = relogio(t);
    const Cs = TEMPO.esperaMinima; // card só aparece se a espera passar disso

    // Brilho do esqueleto: faixa de 600 px cruzando a área a cada 1,6 s (1,4 no mobile).
    if (!reduzido && area.current) {
      const W = area.current.clientWidth;
      const ciclo = G.brilho.ciclo;
      const shX = ((((t + 2) % ciclo) + ciclo) % ciclo) / ciclo * (W + G.brilho.faixa) - G.brilho.faixa / 2;
      esqueletos.current.forEach(({ el, x }) => {
        el.style.backgroundPosition = `${shX - x - G.brilho.faixa / 2}px 0, 0 0`;
      });
    }

    // Etapas: a i-ésima aparece quando a anterior conclui (como na referência).
    const l = listaRef.current;
    for (let i = 0; i < l.length; i++) {
      const m = (s.marcos[i] ??= { ap: -1, dn: -1 });
      if (m.ap < 0 && (i === 0 ? t >= Cs + 0.4 : (s.marcos[i - 1]?.dn ?? -1) >= 0)) m.ap = i === 0 ? Cs + 0.4 : Math.max(t, s.marcos[i - 1].dn);
      if (m.ap >= 0 && m.dn < 0 && l[i].feita) m.dn = Math.max(t, m.ap + 0.4);
    }
    const todas = l.every((e, i) => e.feita && (s.marcos[i]?.dn ?? -1) >= 0 && t >= s.marcos[i].dn + 0.3);
    if (todas && s.finIni < 0) s.finIni = t;

    const fin = s.finIni < 0 ? 0 : draw(s.finIni, s.finIni + 0.45);
    const out = s.finIni < 0 ? 0 : draw(s.finIni + 0.5, s.finIni + 1.0);
    if (out >= 1 && !s.fimAvisado) {
      s.fimAvisado = true;
      onFimRef.current?.();
    }

    l.forEach((_, i) => {
      const m = s.marcos[i];
      const ap = !m || m.ap < 0 ? 0 : reduzido ? clamp((t - m.ap) / TEMPO.fadeReduzido) : enter(m.ap, m.ap + 0.4);
      const dn = !m || m.dn < 0 ? 0 : reduzido ? 1 : enter(m.dn, m.dn + 0.3);
      const linha = n['e' + i];
      opac(linha, ap);
      if (linha) linha.style.transform = `translateX(${(1 - ap) * -G.etapas.entra}px)`;
      opac(n['er' + i], 1 - dn);
      if (n['er' + i] && !reduzido) n['er' + i]!.style.transform = `rotate(${t * 240}deg)`;
      if (n['ed' + i]) n['ed' + i]!.style.transform = `scale(${dn})`;
      if (n['et' + i]) n['et' + i]!.style.color = dn > 0.5 ? COR.body : COR.muted2;
    });

    // Barra: progresso real, ou etapas concluídas / total.
    const feitas = l.filter((e) => e.feita).length;
    const temBarra = alvo.current !== undefined || l.length > 1;
    const meta = alvo.current !== undefined ? clamp(alvo.current) : feitas / l.length;
    s.exibido = suavizar(s.exibido, meta, dt);
    opac(n.barra, temBarra ? 1 : 0);
    preencher(n.fill, s.exibido);

    // Card / sheet.
    let op: number;
    if (reduzido) {
      op = clamp((t - Cs) / TEMPO.fadeReduzido) * (1 - clamp((t - (s.finIni < 0 ? Infinity : s.finIni)) / TEMPO.fadeReduzido));
      opac(n.card, op);
      if (n.card) n.card.style.transform = mobile ? 'none' : 'translate(-50%, -50%)';
      marca.current?.set({ stem: 1, arcA: 0, arcB: 1, track: 0, ring: 0 });
    } else if (mobile) {
      const sIn = pop(Cs - 0.05, Cs + 0.65);
      const sY = lerp(G.card.h, 0, sIn) + (G.card.h + 20) * out;
      op = sIn > 0.001 && out < 1 ? 1 : 0;
      opac(n.card, op);
      if (n.card) n.card.style.transform = `translateY(${sY}px)`;
    } else {
      const cIn = pop(Cs, Cs + 0.6);
      const escala = lerp(0.92, 1, cIn) * (1 - 0.04 * out);
      op = clamp(cIn) * (1 - out);
      opac(n.card, op);
      if (n.card) n.card.style.transform = `translate(-50%, -50%) scale(${escala})`;
    }
    opac(n.escuro, (reduzido ? op : draw(Cs - 0.1, Cs + 0.4) * (1 - out)));

    if (!reduzido) {
      const sp = fasesSpinner(t - Cs);
      marca.current?.set({
        stem: 1,
        arcA: sp.arcA * (1 - fin),
        arcB: sp.arcB + (1 - sp.arcB) * fin,
        track: 0.16,
        ring: 1,
        ringOp: 0.55 * (1 - fin),
        rot: t * 90,
      });
    }
  });

  const esq = (style: CSSProperties, r: number = RAIO.badge) => (
    <div
      data-esq
      style={{
        borderRadius: r,
        background: reduzido
          ? COR.esqueleto
          : `linear-gradient(90deg, transparent 0, ${COR.esqueletoBrilho} 50%, transparent 100%) -9999px 0 / ${G.brilho.faixa}px 100% no-repeat, ${COR.esqueleto}`,
        ...style,
      }}
    />
  );
  const cartao: CSSProperties = { ...CARD.padrao, borderRadius: mobile ? RAIO.painel : RAIO.card, padding: mobile ? 16 : 32 };

  const E = G.etapas;
  const card = (
    <div
      data-no="card"
      className={fontesDaMarca}
      aria-hidden
      style={
        mobile
          ? { position: contido ? 'absolute' : 'fixed', left: 0, right: 0, bottom: -20, height: G.card.h, zIndex: 61, borderRadius: `${G.card.raio}px ${G.card.raio}px 0 0`, background: COR.surface, borderTop: `1px solid ${COR.lineStrong}`, boxShadow: COR.sombraSheet, opacity: 0, visibility: 'hidden', transform: `translateY(${G.card.h}px)` }
          : { position: 'absolute', zIndex: 61, left: '50%', top: '50%', width: G.card.w, height: G.card.h, maxWidth: 'calc(100% - 24px)', ...CARD.elevado, borderRadius: G.card.raio, opacity: 0, visibility: 'hidden', overflow: 'hidden' }
      }
    >
      {/* Conteúdo com a largura da referência, centralizado. */}
      <div style={{ position: 'absolute', top: 0, left: '50%', width: mobile ? 390 : G.card.w, height: '100%', marginLeft: -(mobile ? 390 : G.card.w) / 2 }}>
        {'alca' in G && (
          <div style={{ position: 'absolute', left: G.alca.x, top: G.alca.y, width: G.alca.w, height: G.alca.h, borderRadius: RAIO.pilula, background: COR.alca }} />
        )}
        <div style={{ position: 'absolute', left: G.aura.x, top: G.aura.y, width: G.aura.tam, height: G.aura.tam, borderRadius: '50%', background: `radial-gradient(circle, ${COR.auraCard}, transparent 70%)` }} />
        <div style={{ position: 'absolute', left: G.marca.cx - G.marca.s / 2, top: G.marca.cy - G.marca.s / 2 }}>
          <ProgMark ref={marca} s={G.marca.s} arcB={0} track={0.16} ringColor={COR.accent} ringW={G.anel.w} dash={G.anel.dash} gap={G.anel.gap} />
        </div>
        <div style={{ position: 'absolute', left: E.x, top: E.y, display: 'flex', flexDirection: 'column', gap: E.gap }}>
          {lista.map((e, i) => (
            <div key={e.nome + i} data-no={'e' + i} style={{ display: 'flex', alignItems: 'center', gap: E.gapTexto, opacity: 0, visibility: 'hidden' }}>
              <span style={{ position: 'relative', width: E.icone, height: E.icone, flex: 'none' }}>
                <span data-no={'er' + i} style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `${E.borda}px dashed ${COR.accent}` }} />
                <span
                  data-no={'ed' + i}
                  style={{ position: 'absolute', left: (E.icone - E.ponto) / 2, top: (E.icone - E.ponto) / 2, width: E.ponto, height: E.ponto, borderRadius: '50%', background: COR.green, boxShadow: `0 0 10px ${COR.green}`, transform: 'scale(0)' }}
                />
              </span>
              <span data-no={'et' + i} style={{ fontFamily: FONTE.body, fontSize: E.fonte, color: COR.muted2, whiteSpace: 'nowrap' }}>{e.nome}</span>
            </div>
          ))}
        </div>
        <div data-no="barra" style={{ opacity: 0, visibility: 'hidden' }}>
          <Barra noFill="fill" style={{ left: G.barra.x, top: G.barra.y, width: G.barra.w }} />
        </div>
      </div>
    </div>
  );

  const escuro = (
    <div
      data-no="escuro"
      aria-hidden
      style={{ position: mobile && !contido ? 'fixed' : 'absolute', inset: 0, zIndex: 60, background: mobile ? COR.escurecerMobile : COR.escurecer, opacity: 0, visibility: 'hidden', borderRadius: mobile ? 0 : RAIO.card }}
    />
  );

  // Na prévia (contido) do celular, a raiz não é posicionada: o sheet se
  // ancora na moldura do celular, não na área do esqueleto.
  // No celular o sheet vai para o <body>: assim nenhum pai com transform
  // muda a referência do position: fixed.
  const flutuante = mobile && !contido;

  return (
    <div data-ps={ps} role="status" aria-live="polite" aria-busy="true" className={fontesDaMarca} style={{ ...marcaCssVars, position: mobile && contido ? 'static' : 'relative', minHeight: altura }}>
      <SoLeitor>{rotulo}</SoLeitor>
      <div ref={area} aria-hidden style={{ display: 'flex', flexDirection: 'column', gap: mobile ? 14 : 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {esq({ width: mobile ? 150 : 300, height: mobile ? 22 : 30 })}
          {!mobile && esq({ width: 160, height: 36 }, RAIO.pilula)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: mobile ? 12 : 24 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ ...cartao, display: 'flex', flexDirection: 'column', gap: mobile ? 18 : 32, height: mobile ? 100 : 170 }}>
              {esq({ width: '45%', height: mobile ? 10 : 16 })}
              {esq({ width: '65%', height: mobile ? 26 : 44 })}
            </div>
          ))}
        </div>
        <div style={{ ...cartao, height: mobile ? 260 : 300, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {esq({ width: mobile ? 150 : 280, height: mobile ? 12 : 20 })}
          {esq({ flex: 1 }, RAIO.campo)}
        </div>
      </div>
      {flutuante ? createPortal(<div data-ps={ps}>{escuro}{card}</div>, document.body) : <>{escuro}{card}</>}
    </div>
  );
}
