/* eslint-disable @next/next/no-img-element -- absolutely-positioned composited canvas, ported 1:1 from the design handoff */
'use client';

import { Easing, HERO_ASSET, HERO_COLORS as C, HERO_FONTS as F, heroBgGrid, segment as sg, clamp, type SceneSpec } from './scene-engine';

export const BANNER3_SCENES: SceneSpec[] = [
  { name: 'Peças', dur: 3.6 },
  { name: 'Encaixe', dur: 2.6 },
  { name: 'Mensagem', dur: 5.8 },
];

const LAP = { x: 1270, y: 420, w: 640 };
type Piece = { tag: string; name: string; sub: string; px: number; py: number; fx: number; fy: number; w: number };
const PIECES: Piece[] = [
  { tag: '01', name: 'SSD NVMe', sub: 'até 4 TB', px: 830, py: 150, fx: -500, fy: -260, w: 230 },
  { tag: '02', name: 'RAM DDR5', sub: 'até 64 GB', px: 1730, py: 170, fx: 520, fy: -300, w: 230 },
  { tag: '03', name: 'Tela', sub: 'OLED · 240 Hz', px: 790, py: 420, fx: -560, fy: 0, w: 230 },
  { tag: '04', name: 'Processador', sub: 'última geração', px: 840, py: 670, fx: -520, fy: 300, w: 250 },
  { tag: '05', name: 'Placa-mãe', sub: 'grau militar', px: 1740, py: 660, fx: 540, fy: 320, w: 230 },
];

function Panel3({ p, a, conv, t, i }: { p: Piece; a: number; conv: number; t: number; i: number }) {
  const bob = Math.sin(t * 1.6 + i * 1.3) * 7 * a * (1 - conv);
  const x = p.px + (1 - a) * p.fx + (LAP.x - p.px) * conv;
  const y = p.py + (1 - a) * p.fy + (LAP.y - p.py) * conv + bob;
  const sc = (0.8 + 0.2 * a) * (1 - 0.75 * conv);
  const op = a * (1 - sg(conv, 0.55, 1, Easing.linear));
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
        padding: '16px 20px',
        boxShadow: '0 0 34px rgba(242,135,5,0.12), 0 24px 40px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ fontFamily: F.mono, fontSize: 12, letterSpacing: '0.28em', color: C.orange }}>{p.tag}</div>
      <div style={{ fontFamily: F.display, fontWeight: 600, fontSize: 24, color: C.white, margin: '6px 0 2px' }}>{p.name}</div>
      <div style={{ fontFamily: F.body, fontSize: 15, color: C.gray }}>{p.sub}</div>
      <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(242,135,5,0.7), rgba(242,135,5,0))', marginTop: 12 }} />
    </div>
  );
}

const WORDS = ['Upgrade.', 'Performance.', 'Exclusividade.'];

function Set3({ t, flyP, convP, msgP }: { t: number; flyP: number; convP: number; msgP: number }) {
  const flash = Math.sin(Math.PI * clamp((convP - 0.5) / 0.3, 0, 1));
  const lapIn = sg(convP, 0.55, 0.95, Easing.easeOutCubic);
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.bg, overflow: 'hidden', fontFamily: F.body }}>
      <div style={heroBgGrid()} />
      <div
        style={{
          position: 'absolute',
          left: LAP.x,
          top: LAP.y,
          width: 900,
          height: 640,
          transform: 'translate(-50%,-50%)',
          background: 'radial-gradient(ellipse, rgba(242,135,5,0.10) 0%, rgba(242,135,5,0) 60%)',
          opacity: Math.max(flyP * 0.7, lapIn),
        }}
      />

      <svg width="1920" height="800" viewBox="0 0 1920 800" style={{ position: 'absolute', inset: 0 }}>
        {PIECES.map((p, i) => {
          const a = sg(flyP, i * 0.12, i * 0.12 + 0.3);
          return (
            <line key={i} x1={p.px} y1={p.py} x2={LAP.x} y2={LAP.y} stroke={C.orange} strokeWidth="1" opacity={0.28 * a * (1 - convP)} strokeDasharray="4 7" />
          );
        })}
        <circle cx={LAP.x} cy={LAP.y} r={220 * flash} fill="none" stroke={C.orange} strokeWidth={2.5 * (1 - flash) + 0.5} opacity={0.85 * flash * (1 - lapIn * 0.6)} />
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
          filter: 'drop-shadow(0 40px 60px rgba(0,0,0,0.7))',
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
        <Panel3 key={i} p={p} i={i} t={t} a={sg(flyP, i * 0.12, i * 0.12 + 0.42, Easing.easeOutCubic)} conv={sg(convP, i * 0.05, 0.6 + i * 0.05)} />
      ))}

      <div style={{ position: 'absolute', left: 120, top: 0, bottom: 0, width: 560, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24 }}>
        <img src="/images/logo.png" alt="Prog Imports" style={{ width: 200, alignSelf: 'flex-start', opacity: msgP, transform: `translateY(${(1 - msgP) * -16}px)` }} />
        <div style={{ fontFamily: F.mono, fontSize: 15, letterSpacing: '0.34em', color: C.orange, opacity: Math.min(1, flyP * 2) }}>ENGENHARIA PREMIUM</div>
        <div>
          {WORDS.map((w, i) => {
            const a = sg(msgP, i * 0.18, i * 0.18 + 0.3, Easing.easeOutCubic);
            return (
              <div key={i} style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    fontFamily: F.display,
                    fontWeight: 600,
                    fontSize: 64,
                    lineHeight: 1.14,
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
        <div style={{ fontSize: 21, lineHeight: 1.5, color: C.gray, maxWidth: 460, opacity: sg(msgP, 0.55, 0.85), transform: `translateY(${(1 - sg(msgP, 0.55, 0.85)) * 18}px)` }}>
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
            fontSize: 17,
            letterSpacing: '0.06em',
            padding: '16px 34px',
            borderRadius: 3,
            opacity: sg(msgP, 0.65, 0.95),
            transform: `translateY(${(1 - sg(msgP, 0.65, 0.95)) * 18}px)`,
          }}
        >
          VER PRODUTOS
        </a>
      </div>
    </div>
  );
}

export function Banner3({ index, progress, t }: { index: number; progress: number; t: number }) {
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

  return <Set3 t={t} flyP={flyP} convP={convP} msgP={msgP} />;
}
