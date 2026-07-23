/* eslint-disable @next/next/no-img-element -- absolutely-positioned composited canvas, ported 1:1 from the design handoff */
'use client';

import { HERO_COLORS as C, HERO_FONTS as F, heroBgGrid, segment as sg, clamp, type SceneSpec } from './scene-engine';

export const BANNER4_SCENES: SceneSpec[] = [
  { name: 'Compra', dur: 2 },
  { name: 'Caixa', dur: 1.6 },
  { name: 'Voo', dur: 2.4 },
  { name: 'Brasil', dur: 1.6 },
  { name: 'Mensagem', dur: 4.4 },
];

const TY = 596;
const NODES = [
  { x: 300, label: 'Compra confirmada' },
  { x: 630, label: 'Embalado e despachado' },
  { x: 960, label: 'Voo EUA → Brasil' },
  { x: 1290, label: 'Chegou ao Brasil' },
  { x: 1620, label: 'Entregue a você' },
];

function pkgPos(J: number) {
  const i = Math.min(3, Math.floor(J));
  const f = J - i;
  const x = NODES[i].x + (NODES[Math.min(4, i + 1)].x - NODES[i].x) * f;
  let y = TY;
  if (J > 2 && J < 3) y = TY - Math.sin(Math.PI * (J - 2)) * 110;
  return { x, y, fly: J > 2 && J < 3 };
}

function Pkg({ J }: { J: number }) {
  const { x, y, fly } = pkgPos(J);
  const tilt = fly ? -10 : 0;
  const i = Math.round(clamp(J, 0, 4));
  return (
    <div style={{ position: 'absolute', left: x, top: y - 58, transform: `translate(-50%,-100%) rotate(${tilt}deg)` }}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 150,
          height: 150,
          transform: 'translate(-50%,-50%)',
          background: 'radial-gradient(circle, rgba(242,135,5,0.22) 0%, rgba(242,135,5,0) 60%)',
        }}
      />
      <div style={{ position: 'relative', width: 56, height: 56, background: 'linear-gradient(160deg, #26272D, #17181C)', borderRadius: 8, border: '1px solid #34363D', boxShadow: '0 18px 26px rgba(0,0,0,0.55)' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 24, height: 8, background: C.orange, opacity: 0.9 }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 24, width: 8, background: C.orange, opacity: 0.35 }} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 64,
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap',
          fontFamily: F.mono,
          fontSize: 12,
          letterSpacing: '0.2em',
          color: C.orange,
          background: 'rgba(14,14,17,0.85)',
          border: '1px solid rgba(242,135,5,0.35)',
          borderRadius: 4,
          padding: '6px 12px',
        }}
      >
        {NODES[i].label.toUpperCase()}
      </div>
    </div>
  );
}

function Set4({ t, baseP, J, msgP }: { t: number; baseP: number; J: number; msgP: number }) {
  const { x: px } = pkgPos(J);
  const fillW = clamp((px - NODES[0].x) / (NODES[4].x - NODES[0].x), 0, 1);
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.bg, overflow: 'hidden', fontFamily: F.body }}>
      <div style={heroBgGrid()} />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '104%',
          width: 2400,
          height: 800,
          transform: 'translate(-50%,-50%)',
          background: 'radial-gradient(ellipse, rgba(242,135,5,0.10) 0%, rgba(0,0,0,0) 60%)',
        }}
      />

      <div style={{ position: 'absolute', left: 0, right: 0, top: 96, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
        <img src="/images/logo.png" alt="Prog Imports" style={{ width: 190, opacity: baseP, transform: `translateY(${(1 - baseP) * -14}px)` }} />
        <div style={{ fontFamily: F.mono, fontSize: 14, letterSpacing: '0.34em', color: C.orange, opacity: baseP }}>DA COMPRA À ENTREGA</div>
        <div style={{ overflow: 'hidden' }}>
          <h1
            style={{
              margin: 0,
              fontFamily: F.display,
              fontWeight: 600,
              fontSize: 52,
              lineHeight: 1.1,
              color: C.white,
              letterSpacing: '-0.02em',
              maxWidth: 900,
              transform: `translateY(${(1 - msgP) * 115}%)`,
            }}
          >
            Sua tecnologia importada, acompanhada do início ao fim<span style={{ color: C.orange }}>.</span>
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, opacity: sg(msgP, 0.4, 0.85), transform: `translateY(${(1 - sg(msgP, 0.4, 0.85)) * 16}px)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: F.mono, fontSize: 13, letterSpacing: '0.14em', color: C.gray, border: '1px solid #2A2B31', borderRadius: 999, padding: '10px 20px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.orange, display: 'inline-block' }} />
            RASTREIO EM TEMPO REAL, DIRETO PELO SITE
          </div>
          <a
            href="#produtos"
            style={{
              display: 'inline-block',
              background: C.orange,
              color: '#0A0A0C',
              textDecoration: 'none',
              fontFamily: F.display,
              fontWeight: 600,
              fontSize: 16,
              letterSpacing: '0.06em',
              padding: '13px 30px',
              borderRadius: 3,
            }}
          >
            VER PRODUTOS
          </a>
        </div>
      </div>

      <div style={{ position: 'absolute', inset: 0, opacity: baseP }}>
        <svg width="1920" height="800" viewBox="0 0 1920 800" style={{ position: 'absolute', inset: 0 }}>
          <line x1={NODES[0].x} y1={TY} x2={NODES[4].x} y2={TY} stroke="#26272C" strokeWidth="2" />
          <line x1={NODES[0].x} y1={TY} x2={NODES[0].x + (NODES[4].x - NODES[0].x) * fillW} y2={TY} stroke={C.orange} strokeWidth="2.5" />
          <path
            d={`M ${NODES[2].x} ${TY} Q ${(NODES[2].x + NODES[3].x) / 2} ${TY - 150} ${NODES[3].x} ${TY}`}
            fill="none"
            stroke={C.orange}
            strokeWidth="1"
            strokeDasharray="4 7"
            opacity={J > 1.9 && J < 3.1 ? 0.5 : 0.18}
          />
        </svg>
        {NODES.map((n, i) => {
          const active = J >= i - 0.02;
          const isCur = Math.abs(J - i) < 0.5;
          const isCheck = (active && J > i + 0.4) || (i === 4 && J >= 4);
          return (
            <div key={i} style={{ position: 'absolute', left: n.x, top: TY, transform: 'translate(-50%,-50%)' }}>
              {isCur && (
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: 64,
                    height: 64,
                    transform: 'translate(-50%,-50%)',
                    borderRadius: '50%',
                    border: `1px solid ${C.orange}`,
                    opacity: 0.35 + 0.3 * Math.sin(t * 3),
                  }}
                />
              )}
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: '50%',
                  background: active ? '#141519' : C.node,
                  border: `1.5px solid ${active ? C.orange : '#2E3036'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: F.mono,
                  fontSize: 14,
                  color: active ? C.orange : '#5B5D64',
                  boxShadow: active ? '0 0 20px rgba(242,135,5,0.25)' : 'none',
                }}
              >
                {isCheck ? '✓' : `0${i + 1}`}
              </div>
              <div style={{ position: 'absolute', left: '50%', top: 60, transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontSize: 16, color: active ? C.white : '#5B5D64', fontWeight: 500 }}>
                {n.label}
              </div>
            </div>
          );
        })}
        <Pkg J={J} />
      </div>
    </div>
  );
}

export function Banner4({ index, progress, t }: { index: number; progress: number; t: number }) {
  let baseP = 0;
  let J = 0;
  let msgP = 0;

  if (index === 0) {
    baseP = sg(progress, 0.05, 0.7);
  } else if (index === 1) {
    baseP = 1;
    J = sg(progress, 0.1, 0.9);
  } else if (index === 2) {
    baseP = 1;
    J = 1 + 2 * sg(progress, 0.05, 0.95);
  } else if (index === 3) {
    baseP = 1;
    J = 3 + sg(progress, 0.1, 0.9);
  } else {
    baseP = 1;
    J = 4;
    msgP = sg(progress, 0.04, 0.35);
  }

  return <Set4 t={t} baseP={baseP} J={J} msgP={msgP} />;
}
