/* eslint-disable @next/next/no-img-element -- absolutely-positioned composited canvas, ported 1:1 from the design handoff */
'use client';

import { Easing, HERO_ASSET, HERO_COLORS as C, HERO_FONTS as F, heroBgGrid, segment as sg } from './scene-engine';

type Particle = { x: number; y: number; s: number; o: number; spd: number; ph: number; or: boolean };

const M1_PARTS: Particle[] = Array.from({ length: 60 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  return { x: r(1) * 1080, y: r(2) * 1350, s: 1 + r(3) * 2.2, o: 0.06 + r(4) * 0.26, spd: 6 + r(5) * 18, ph: r(6) * 6.28, or: r(7) < 0.16 };
});

type Product1 = { src: string; x: number; y: number; w: number };

const M1_PRODUCTS: Product1[] = [
  { src: HERO_ASSET('macbook-top.png'), x: 540, y: 905, w: 400 },
  { src: HERO_ASSET('iphone.png'), x: 185, y: 655, w: 120 },
  { src: HERO_ASSET('ipad.png'), x: 895, y: 645, w: 170 },
  { src: HERO_ASSET('alienware.png'), x: 225, y: 1130, w: 200 },
  { src: HERO_ASSET('monitor.png'), x: 870, y: 1125, w: 180 },
  { src: HERO_ASSET('headset.png'), x: 540, y: 560, w: 125 },
  { src: HERO_ASSET('mouse-black.png'), x: 110, y: 900, w: 85 },
];
const HUB = M1_PRODUCTS[0];

function SetM1({
  t,
  titleP,
  prodP,
  lineP,
  brandP,
  cam,
}: {
  t: number;
  titleP: number;
  prodP: number;
  lineP: number;
  brandP: number;
  cam: number;
}) {
  const scale = 1 + 0.045 * cam;
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.bg, overflow: 'hidden', fontFamily: F.body }}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '112%',
          width: 1600,
          height: 900,
          transform: 'translate(-50%,-50%)',
          background: 'radial-gradient(ellipse at center, rgba(242,135,5,0.14) 0%, rgba(242,135,5,0.045) 34%, rgba(0,0,0,0) 62%)',
          opacity: 0.5 + 0.5 * Math.min(1, titleP),
        }}
      />
      <div style={heroBgGrid(0.05, 90)} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {M1_PARTS.map((p, i) => {
          const y = ((p.y - t * p.spd) % 1350 + 1350) % 1350;
          const tw = 0.55 + 0.45 * Math.sin(t * 1.4 + p.ph);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: p.x,
                top: y,
                width: p.s,
                height: p.s,
                borderRadius: '50%',
                background: p.or ? C.orange : '#DADCE2',
                opacity: p.o * tw * Math.min(1, titleP * 2),
              }}
            />
          );
        })}
      </div>

      <div style={{ position: 'absolute', left: 0, top: 430, right: 0, bottom: 0, transform: `scale(${scale})`, transformOrigin: '50% 60%' }}>
        <svg width="1080" height="920" viewBox="0 430 1080 920" style={{ position: 'absolute', inset: 0 }}>
          {M1_PRODUCTS.slice(1).map((p, i) => {
            const d = sg(lineP, i * 0.09, i * 0.09 + 0.5);
            return (
              <g key={i} opacity={d > 0 ? 1 : 0}>
                <line x1={HUB.x} y1={HUB.y} x2={HUB.x + (p.x - HUB.x) * d} y2={HUB.y + (p.y - HUB.y) * d} stroke={C.orange} strokeWidth="1.4" opacity="0.5" />
                <circle cx={HUB.x + (p.x - HUB.x) * d} cy={HUB.y + (p.y - HUB.y) * d} r="3" fill={C.orange} opacity={0.9 * Math.min(1, d * 3)} />
              </g>
            );
          })}
          <circle cx={HUB.x} cy={HUB.y} r={5 + 2 * Math.sin(t * 3)} fill={C.orange} opacity={lineP > 0 ? 0.85 : 0} />
        </svg>
        {M1_PRODUCTS.map((p, i) => {
          const a = sg(prodP, i * 0.105, i * 0.105 + 0.24, Easing.easeOutCubic);
          const flare = Math.sin(Math.PI * Math.max(0, Math.min(1, (prodP - i * 0.105) / 0.24)));
          return (
            <div key={i} style={{ position: 'absolute', left: p.x, top: p.y - 430, transform: 'translate(-50%,-50%)', opacity: a }}>
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: p.w * 1.5,
                  height: p.w * 1.5,
                  transform: 'translate(-50%,-50%)',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(242,135,5,0.28) 0%, rgba(242,135,5,0) 60%)',
                  opacity: flare,
                }}
              />
              <img
                src={p.src}
                alt=""
                style={{ display: 'block', width: p.w, transform: `translateY(${(1 - a) * 40}px) scale(${0.75 + 0.25 * a})`, filter: 'drop-shadow(0 24px 32px rgba(0,0,0,0.65))' }}
              />
            </div>
          );
        })}
      </div>

      <div style={{ position: 'absolute', left: 72, top: 64, width: 936, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <img src="/images/logo.png" alt="Prog Imports" style={{ width: 170, alignSelf: 'flex-start', opacity: brandP, transform: `translateY(${(1 - brandP) * -14}px)` }} />
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontFamily: F.mono, fontSize: 16, letterSpacing: '0.3em', color: C.orange, transform: `translateY(${(1 - Math.min(1, titleP * 1.6)) * 110}%)` }}>
            O FUTURO CHEGOU
          </div>
        </div>
        <div style={{ overflow: 'hidden' }}>
          <h1
            style={{
              margin: 0,
              fontFamily: F.display,
              fontWeight: 600,
              fontSize: 58,
              lineHeight: 1.08,
              color: C.white,
              letterSpacing: '-0.02em',
              transform: `translateY(${(1 - titleP) * 110}%)`,
              maxWidth: 780,
            }}
          >
            O melhor da tecnologia mundial<span style={{ color: C.orange }}>.</span>
          </h1>
        </div>
        <div style={{ fontSize: 23, lineHeight: 1.5, color: C.gray, opacity: brandP, transform: `translateY(${(1 - brandP) * 18}px)` }}>Importado diretamente para você.</div>
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
            opacity: brandP,
            transform: `translateY(${(1 - brandP) * 18}px)`,
          }}
        >
          VER PRODUTOS
        </a>
      </div>
    </div>
  );
}

export function Banner1Mobile({ index, progress, t }: { index: number; progress: number; t: number }) {
  let titleP = 0;
  let prodP = 0;
  let lineP = 0;
  let brandP = 0;
  const cam = (index + progress) / 4;

  if (index === 0) {
    titleP = sg(progress, 0.12, 0.92);
  } else if (index === 1) {
    titleP = 1;
    prodP = sg(progress, 0.02, 0.98, Easing.linear);
  } else if (index === 2) {
    titleP = 1;
    prodP = 1;
    lineP = sg(progress, 0.05, 0.9, Easing.linear);
  } else {
    titleP = 1;
    prodP = 1;
    lineP = 1;
    brandP = sg(progress, 0.05, 0.32);
  }

  return <SetM1 t={t} titleP={titleP} prodP={prodP} lineP={lineP} brandP={brandP} cam={cam} />;
}
