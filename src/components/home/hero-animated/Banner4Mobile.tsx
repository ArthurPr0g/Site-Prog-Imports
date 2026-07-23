/* eslint-disable @next/next/no-img-element -- absolutely-positioned composited canvas, ported 1:1 from the design handoff */
'use client';

import { HERO_COLORS as C, HERO_FONTS as F, heroBgGrid, segment as sg, clamp } from './scene-engine';

const TX = 190;
const NODES = [
  { y: 585, label: 'Compra confirmada' },
  { y: 755, label: 'Embalado e despachado' },
  { y: 925, label: 'Voo EUA → Brasil' },
  { y: 1095, label: 'Chegou ao Brasil' },
  { y: 1265, label: 'Entregue a você' },
];

function pkgPos(J: number) {
  const i = Math.min(3, Math.floor(J));
  const f = J - i;
  const y = NODES[i].y + (NODES[Math.min(4, i + 1)].y - NODES[i].y) * f;
  let x = TX;
  if (J > 2 && J < 3) x = TX - Math.sin(Math.PI * (J - 2)) * 70;
  return { x, y, fly: J > 2 && J < 3 };
}

function PkgM({ J }: { J: number }) {
  const { x, y, fly } = pkgPos(J);
  const tilt = fly ? -8 : 0;
  return (
    <div style={{ position: 'absolute', left: x - 90, top: y, transform: `translate(-50%,-50%) rotate(${tilt}deg)` }}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 130,
          height: 130,
          transform: 'translate(-50%,-50%)',
          background: 'radial-gradient(circle, rgba(242,135,5,0.22) 0%, rgba(242,135,5,0) 60%)',
        }}
      />
      <div style={{ position: 'relative', width: 50, height: 50, background: 'linear-gradient(160deg, #26272D, #17181C)', borderRadius: 8, border: '1px solid #34363D', boxShadow: '0 14px 22px rgba(0,0,0,0.55)' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 21, height: 8, background: C.orange, opacity: 0.9 }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 21, width: 8, background: C.orange, opacity: 0.35 }} />
      </div>
    </div>
  );
}

function SetM4({ t, baseP, J, msgP }: { t: number; baseP: number; J: number; msgP: number }) {
  const { y: py } = pkgPos(J);
  const fillH = clamp((py - NODES[0].y) / (NODES[4].y - NODES[0].y), 0, 1);
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.bg, overflow: 'hidden', fontFamily: F.body }}>
      <div style={heroBgGrid(0.05, 90)} />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '104%',
          width: 1600,
          height: 800,
          transform: 'translate(-50%,-50%)',
          background: 'radial-gradient(ellipse, rgba(242,135,5,0.10) 0%, rgba(0,0,0,0) 60%)',
        }}
      />

      <div style={{ position: 'absolute', left: 60, right: 60, top: 78, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
        <img src="/images/logo.png" alt="Prog Imports" style={{ width: 160, opacity: baseP, transform: `translateY(${(1 - baseP) * -12}px)` }} />
        <div style={{ fontFamily: F.mono, fontSize: 12, letterSpacing: '0.32em', color: C.orange, opacity: baseP }}>DA COMPRA À ENTREGA</div>
        <div style={{ overflow: 'hidden' }}>
          <h1
            style={{
              margin: 0,
              fontFamily: F.display,
              fontWeight: 600,
              fontSize: 40,
              lineHeight: 1.14,
              color: C.white,
              letterSpacing: '-0.02em',
              maxWidth: 820,
              transform: `translateY(${(1 - msgP) * 115}%)`,
            }}
          >
            Sua tecnologia importada, acompanhada do início ao fim<span style={{ color: C.orange }}>.</span>
          </h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, opacity: sg(msgP, 0.4, 0.85), transform: `translateY(${(1 - sg(msgP, 0.4, 0.85)) * 14}px)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: F.mono, fontSize: 12, letterSpacing: '0.12em', color: C.gray, border: '1px solid #2A2B31', borderRadius: 999, padding: '9px 18px' }}>
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
              padding: '14px 30px',
              borderRadius: 3,
            }}
          >
            VER PRODUTOS
          </a>
        </div>
      </div>

      <div style={{ position: 'absolute', inset: 0, opacity: baseP }}>
        <svg width="1080" height="1350" viewBox="0 0 1080 1350" style={{ position: 'absolute', inset: 0 }}>
          <line x1={TX} y1={NODES[0].y} x2={TX} y2={NODES[4].y} stroke="#26272C" strokeWidth="2" />
          <line x1={TX} y1={NODES[0].y} x2={TX} y2={NODES[0].y + (NODES[4].y - NODES[0].y) * fillH} stroke={C.orange} strokeWidth="2.5" />
          <path
            d={`M ${TX} ${NODES[2].y} Q ${TX - 160} ${(NODES[2].y + NODES[3].y) / 2} ${TX} ${NODES[3].y}`}
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
            <div key={i} style={{ position: 'absolute', left: TX, top: n.y, transform: 'translate(-50%,-50%)' }}>
              {isCur && (
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: 62,
                    height: 62,
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
                  boxShadow: active ? '0 0 18px rgba(242,135,5,0.25)' : 'none',
                }}
              >
                {isCheck ? '✓' : `0${i + 1}`}
              </div>
              <div style={{ position: 'absolute', left: 44, top: '50%', transform: 'translateY(-50%)', whiteSpace: 'nowrap', fontSize: 21, color: active ? C.white : '#5B5D64', fontWeight: 500, marginLeft: 22 }}>
                {n.label}
              </div>
            </div>
          );
        })}
        <PkgM J={J} />
      </div>
    </div>
  );
}

export function Banner4Mobile({ index, progress, t }: { index: number; progress: number; t: number }) {
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

  return <SetM4 t={t} baseP={baseP} J={J} msgP={msgP} />;
}
