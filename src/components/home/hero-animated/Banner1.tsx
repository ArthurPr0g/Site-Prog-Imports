/* eslint-disable @next/next/no-img-element -- absolutely-positioned composited canvas, ported 1:1 from the design handoff */
'use client';

import { Easing, HERO_ASSET, HERO_COLORS as C, HERO_FONTS as F, heroBgGrid, segment as sg, type SceneSpec } from './scene-engine';

export const BANNER1_SCENES: SceneSpec[] = [
  { name: 'Abertura', dur: 1.8 },
  { name: 'Produtos', dur: 3.6 },
  { name: 'Conexões', dur: 2.1 },
  { name: 'Marca', dur: 4.5 },
];

type Particle = { x: number; y: number; s: number; o: number; spd: number; ph: number; or: boolean };

const P1_PARTS: Particle[] = Array.from({ length: 80 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  return { x: r(1) * 1920, y: r(2) * 800, s: 1 + r(3) * 2.2, o: 0.06 + r(4) * 0.26, spd: 6 + r(5) * 18, ph: r(6) * 6.28, or: r(7) < 0.16 };
});

function Particles1({ t, vis }: { t: number; vis: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {P1_PARTS.map((p, i) => {
        const y = ((p.y - t * p.spd) % 800 + 800) % 800;
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
              opacity: p.o * tw * vis,
            }}
          />
        );
      })}
    </div>
  );
}

type Product1 = { src: string; x: number; y: number; w: number; hub?: boolean };

const P1_PRODUCTS: Product1[] = [
  { src: HERO_ASSET('macbook-top.png'), x: 1330, y: 425, w: 470, hub: true },
  { src: HERO_ASSET('iphone.png'), x: 1005, y: 280, w: 150 },
  { src: HERO_ASSET('ipad.png'), x: 1665, y: 255, w: 195 },
  { src: HERO_ASSET('alienware.png'), x: 1010, y: 590, w: 245 },
  { src: HERO_ASSET('monitor.png'), x: 1645, y: 585, w: 225 },
  { src: HERO_ASSET('headset.png'), x: 1400, y: 140, w: 145 },
  { src: HERO_ASSET('mouse-black.png'), x: 850, y: 445, w: 105 },
];
const HUB = P1_PRODUCTS[0];

function Set1({
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
          top: '118%',
          width: 2400,
          height: 900,
          transform: 'translate(-50%,-50%)',
          background: 'radial-gradient(ellipse at center, rgba(242,135,5,0.14) 0%, rgba(242,135,5,0.045) 34%, rgba(0,0,0,0) 62%)',
          opacity: 0.5 + 0.5 * Math.min(1, titleP),
        }}
      />
      <div style={heroBgGrid()} />
      <Particles1 t={t} vis={Math.min(1, titleP * 2)} />

      <div style={{ position: 'absolute', inset: 0, transform: `scale(${scale})`, transformOrigin: '62% 50%' }}>
        <svg width="1920" height="800" viewBox="0 0 1920 800" style={{ position: 'absolute', inset: 0 }}>
          {P1_PRODUCTS.slice(1).map((p, i) => {
            const d = sg(lineP, i * 0.09, i * 0.09 + 0.5);
            return (
              <g key={i} opacity={d > 0 ? 1 : 0}>
                <line
                  x1={HUB.x}
                  y1={HUB.y}
                  x2={HUB.x + (p.x - HUB.x) * d}
                  y2={HUB.y + (p.y - HUB.y) * d}
                  stroke={C.orange}
                  strokeWidth="1.4"
                  opacity="0.5"
                />
                <circle cx={HUB.x + (p.x - HUB.x) * d} cy={HUB.y + (p.y - HUB.y) * d} r="3" fill={C.orange} opacity={0.9 * Math.min(1, d * 3)} />
              </g>
            );
          })}
          <circle cx={HUB.x} cy={HUB.y} r={5 + 2 * Math.sin(t * 3)} fill={C.orange} opacity={lineP > 0 ? 0.85 : 0} />
        </svg>
        {P1_PRODUCTS.map((p, i) => {
          const a = sg(prodP, i * 0.105, i * 0.105 + 0.24, Easing.easeOutCubic);
          const flare = Math.sin(Math.PI * Math.max(0, Math.min(1, (prodP - i * 0.105) / 0.24)));
          return (
            <div key={i} style={{ position: 'absolute', left: p.x, top: p.y, transform: 'translate(-50%,-50%)', opacity: a }}>
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
                style={{
                  display: 'block',
                  width: p.w,
                  transform: `translateY(${(1 - a) * 46}px) scale(${0.75 + 0.25 * a})`,
                  filter: 'drop-shadow(0 30px 40px rgba(0,0,0,0.65))',
                }}
              />
            </div>
          );
        })}
      </div>

      <div style={{ position: 'absolute', left: 120, top: 0, bottom: 0, width: 640, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 26 }}>
        <img
          src="/images/logo.png"
          alt="Prog Imports"
          style={{ width: 210, alignSelf: 'flex-start', opacity: brandP, transform: `translateY(${(1 - brandP) * -16}px)` }}
        />
        <div style={{ overflow: 'hidden' }}>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 15,
              letterSpacing: '0.34em',
              color: C.orange,
              transform: `translateY(${(1 - Math.min(1, titleP * 1.6)) * 110}%)`,
            }}
          >
            O FUTURO CHEGOU
          </div>
        </div>
        <div style={{ overflow: 'hidden' }}>
          <h1
            style={{
              margin: 0,
              fontFamily: F.display,
              fontWeight: 600,
              fontSize: 64,
              lineHeight: 1.06,
              color: C.white,
              letterSpacing: '-0.02em',
              transform: `translateY(${(1 - titleP) * 110}%)`,
            }}
          >
            O melhor da tecnologia mundial<span style={{ color: C.orange }}>.</span>
          </h1>
        </div>
        <div style={{ fontSize: 23, lineHeight: 1.5, color: C.gray, maxWidth: 520, opacity: brandP, transform: `translateY(${(1 - brandP) * 20}px)` }}>
          Importado diretamente para você.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, opacity: brandP, transform: `translateY(${(1 - brandP) * 20}px)` }}>
          <a
            href="#produtos"
            style={{
              display: 'inline-block',
              background: C.orange,
              color: '#0A0A0C',
              textDecoration: 'none',
              fontFamily: F.display,
              fontWeight: 600,
              fontSize: 17,
              letterSpacing: '0.06em',
              padding: '16px 34px',
              borderRadius: 3,
            }}
          >
            VER PRODUTOS
          </a>
          <div style={{ fontFamily: F.mono, fontSize: 13, letterSpacing: '0.2em', color: C.faded }}>IMPORTADOS PREMIUM · EUA</div>
        </div>
      </div>
    </div>
  );
}

export function Banner1({ index, progress, t }: { index: number; progress: number; t: number }) {
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

  return <Set1 t={t} titleP={titleP} prodP={prodP} lineP={lineP} brandP={brandP} cam={cam} />;
}
