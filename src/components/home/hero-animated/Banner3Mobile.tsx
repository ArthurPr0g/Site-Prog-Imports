/* eslint-disable @next/next/no-img-element -- absolutely-positioned composited canvas, ported 1:1 from the design handoff */
'use client';

import { Easing, HERO_ASSET, HERO_COLORS as C, HERO_FONTS as F, heroBgGrid, segment as sg, clamp } from './scene-engine';

const LAP = { x: 540, y: 1000, w: 580 };
type Piece = { tag: string; name: string; sub: string; px: number; py: number; fx: number; fy: number; w: number };
const PIECES: Piece[] = [
  { tag: '01', name: 'SSD NVMe', sub: 'até 4 TB', px: 210, py: 640, fx: -420, fy: -260, w: 196 },
  { tag: '02', name: 'RAM DDR5', sub: 'até 64 GB', px: 870, py: 640, fx: 420, fy: -260, w: 196 },
  { tag: '03', name: 'Tela', sub: 'OLED · 240 Hz', px: 150, py: 1000, fx: -420, fy: 0, w: 186 },
  { tag: '04', name: 'Processador', sub: 'última geração', px: 230, py: 1290, fx: -380, fy: 280, w: 210 },
  { tag: '05', name: 'Placa-mãe', sub: 'grau militar', px: 880, py: 1290, fx: 420, fy: 280, w: 196 },
];

function PanelM3({ p, a, conv, t, i }: { p: Piece; a: number; conv: number; t: number; i: number }) {
  const bob = Math.sin(t * 1.6 + i * 1.3) * 6 * a * (1 - conv);
  const x = p.px + (1 - a) * p.fx + (LAP.x - p.px) * conv;
  const y = p.py + (1 - a) * p.fy + (LAP.y - p.py) * conv + bob;
  const sc = (0.8 + 0.2 * a) * (1 - 0.75 * conv);
  const op = a * (1 - sg(conv, 0.55, 1, Easing.linear));
  if (op <= 0.001) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: p.w,
        transform: `translate(-50%,-50%) scale(${sc})`,
        opacity: op,
        background: 'rgba(18,19,23,0.82)',
        border: '1px solid rgba(242,135,5,0.4)',
        borderRadius: 8,
        padding: '13px 16px',
        boxShadow: '0 0 28px rgba(242,135,5,0.12), 0 20px 32px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.28em', color: C.orange }}>{p.tag}</div>
      <div style={{ fontFamily: F.display, fontWeight: 600, fontSize: 20, color: C.white, margin: '5px 0 2px' }}>{p.name}</div>
      <div style={{ fontFamily: F.body, fontSize: 13, color: C.gray }}>{p.sub}</div>
      <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(242,135,5,0.7), rgba(242,135,5,0))', marginTop: 10 }} />
    </div>
  );
}

const WORDS = ['Upgrade.', 'Performance.', 'Exclusividade.'];

function SetM3({ t, flyP, convP, msgP }: { t: number; flyP: number; convP: number; msgP: number }) {
  const flash = Math.sin(Math.PI * clamp((convP - 0.5) / 0.3, 0, 1));
  const lapIn = sg(convP, 0.55, 0.95, Easing.easeOutCubic);
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.bg, overflow: 'hidden', fontFamily: F.body }}>
      <div style={heroBgGrid(0.05, 90)} />
      <div
        style={{
          position: 'absolute',
          left: LAP.x,
          top: LAP.y,
          width: 900,
          height: 620,
          transform: 'translate(-50%,-50%)',
          background: 'radial-gradient(ellipse, rgba(242,135,5,0.10) 0%, rgba(242,135,5,0) 60%)',
          opacity: Math.max(flyP * 0.7, lapIn),
        }}
      />

      <svg width="1080" height="1350" viewBox="0 0 1080 1350" style={{ position: 'absolute', inset: 0 }}>
        {PIECES.map((p, i) => {
          const a = sg(flyP, i * 0.12, i * 0.12 + 0.3);
          return <line key={i} x1={p.px} y1={p.py} x2={LAP.x} y2={LAP.y} stroke={C.orange} strokeWidth="1" opacity={0.28 * a * (1 - convP)} strokeDasharray="4 7" />;
        })}
        <circle cx={LAP.x} cy={LAP.y} r={200 * flash} fill="none" stroke={C.orange} strokeWidth={2.5 * (1 - flash) + 0.5} opacity={0.85 * flash * (1 - lapIn * 0.6)} />
      </svg>

      <img
        src={HERO_ASSET('rog.png')}
        alt=""
        style={{
          position: 'absolute',
          left: LAP.x,
          top: LAP.y,
          width: LAP.w,
          transform: `translate(-50%,-50%) scale(${0.9 + 0.1 * lapIn})`,
          opacity: lapIn,
          filter: 'drop-shadow(0 34px 50px rgba(0,0,0,0.7))',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: LAP.x,
          top: LAP.y,
          width: LAP.w,
          height: LAP.w * 0.55,
          transform: 'translate(-50%,-50%)',
          background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(242,135,5,0.5) 30%, rgba(0,0,0,0) 62%)',
          opacity: flash * 0.9,
          borderRadius: '50%',
          pointerEvents: 'none',
        }}
      />

      {PIECES.map((p, i) => (
        <PanelM3 key={i} p={p} i={i} t={t} a={sg(flyP, i * 0.12, i * 0.12 + 0.42, Easing.easeOutCubic)} conv={sg(convP, i * 0.05, 0.6 + i * 0.05)} />
      ))}

      <div style={{ position: 'absolute', left: 72, top: 80, width: 936, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <img src="/images/logo.png" alt="Prog Imports" style={{ width: 165, alignSelf: 'flex-start', opacity: msgP, transform: `translateY(${(1 - msgP) * -14}px)` }} />
        <div style={{ fontFamily: F.mono, fontSize: 16, letterSpacing: '0.3em', color: C.orange, opacity: Math.min(1, flyP * 2) }}>ENGENHARIA PREMIUM</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 18 }}>
          {WORDS.map((w, i) => {
            const a = sg(msgP, i * 0.18, i * 0.18 + 0.3, Easing.easeOutCubic);
            return (
              <div key={i} style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    fontFamily: F.display,
                    fontWeight: 600,
                    fontSize: 55,
                    lineHeight: 1.16,
                    letterSpacing: '-0.02em',
                    color: i === 2 ? C.orange : C.white,
                    transform: `translateY(${(1 - a) * 110}%)`,
                  }}
                >
                  {w}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 21, lineHeight: 1.5, color: C.gray, maxWidth: 700, opacity: sg(msgP, 0.55, 0.85), transform: `translateY(${(1 - sg(msgP, 0.55, 0.85)) * 16}px)` }}>
          Máquinas montadas e configuradas sob medida para o seu desempenho.
        </div>
        <a
          href="#produtos"
          style={{
            display: 'inline-block',
            alignSelf: 'flex-start',
            background: C.orange,
            color: '#0A0A0C',
            textDecoration: 'none',
            fontFamily: F.display,
            fontWeight: 600,
            fontSize: 18,
            letterSpacing: '0.06em',
            padding: '15px 32px',
            borderRadius: 3,
            opacity: sg(msgP, 0.65, 0.95),
            transform: `translateY(${(1 - sg(msgP, 0.65, 0.95)) * 16}px)`,
          }}
        >
          VER PRODUTOS
        </a>
      </div>
    </div>
  );
}

export function Banner3Mobile({ index, progress, t }: { index: number; progress: number; t: number }) {
  let flyP = 0;
  let convP = 0;
  let msgP = 0;

  if (index === 0) {
    flyP = sg(progress, 0.03, 0.97, Easing.linear);
  } else if (index === 1) {
    flyP = 1;
    convP = sg(progress, 0.02, 0.96, Easing.linear);
  } else {
    flyP = 1;
    convP = 1;
    msgP = sg(progress, 0.03, 0.5, Easing.linear);
  }

  return <SetM3 t={t} flyP={flyP} convP={convP} msgP={msgP} />;
}
