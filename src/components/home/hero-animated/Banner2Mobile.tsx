/* eslint-disable @next/next/no-img-element -- absolutely-positioned composited canvas, ported 1:1 from the design handoff */
'use client';

import { Easing, HERO_ASSET, HERO_COLORS as C, HERO_FONTS as F, segment as sg, clamp } from './scene-engine';

const US = { x: 575, y: 209 };
const BR = { x: 758, y: 478 };
const CTRLS = [
  { x: 820, y: 250 },
  { x: 880, y: 290 },
  { x: 760, y: 330 },
];
const bez = (c: { x: number; y: number }, t: number) => ({
  x: (1 - t) * (1 - t) * US.x + 2 * (1 - t) * t * c.x + t * t * BR.x,
  y: (1 - t) * (1 - t) * US.y + 2 * (1 - t) * t * c.y + t * t * BR.y,
});
const CHIPS = [HERO_ASSET('iphone.png'), HERO_ASSET('macbook-lid.png'), HERO_ASSET('ipad.png')];
const ARRIVALS = [
  { src: HERO_ASSET('iphone.png'), w: 92 },
  { src: HERO_ASSET('ipad.png'), w: 118 },
  { src: HERO_ASSET('macbook-lid.png'), w: 170 },
  { src: HERO_ASSET('mouse-white.png'), w: 56 },
];

function SetM2({ t, mapP, routeP, arriveP, msgP }: { t: number; mapP: number; routeP: number; arriveP: number; msgP: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.bg, overflow: 'hidden', fontFamily: F.body }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 800, transform: 'translate(-462px,-93px) scale(1.5)', transformOrigin: '0 0' }}>
        <img src={HERO_ASSET('map-world.png')} alt="" style={{ position: 'absolute', inset: 0, width: 1920, height: 800, opacity: 0.9 * mapP, transform: `scale(${1.05 - 0.05 * mapP})` }} />
        <div
          style={{
            position: 'absolute',
            left: US.x - 110,
            top: US.y - 80,
            width: 280,
            height: 220,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(242,135,5,0.16) 0%, rgba(242,135,5,0) 60%)',
            opacity: mapP,
          }}
        />
        <svg width="1920" height="800" viewBox="0 0 1920 800" style={{ position: 'absolute', inset: 0 }}>
          {CTRLS.map((c, i) => {
            const d = sg(routeP, i * 0.1, 0.55 + i * 0.1, Easing.easeInOutCubic);
            return (
              <path
                key={i}
                d={`M ${US.x} ${US.y} Q ${c.x} ${c.y} ${BR.x} ${BR.y}`}
                fill="none"
                stroke={C.orange}
                strokeWidth={i === 0 ? 2 : 1}
                opacity={(i === 0 ? 0.85 : 0.35) * Math.min(1, mapP)}
                pathLength={1}
                strokeDasharray="1"
                strokeDashoffset={1 - d}
              />
            );
          })}
          <circle cx={US.x} cy={US.y} r={5} fill={C.orange} opacity={mapP} />
          <circle cx={US.x} cy={US.y} r={9 + 5 * Math.sin(t * 2.4)} fill="none" stroke={C.orange} strokeWidth="1" opacity={0.5 * mapP} />
          <circle cx={BR.x} cy={BR.y} r={5} fill={C.orange} opacity={Math.min(1, routeP * 2)} />
          {arriveP > 0 &&
            [0, 1, 2].map((i) => {
              const rp = (t * 0.55 + i / 3) % 1;
              return <circle key={i} cx={BR.x} cy={BR.y} r={8 + rp * 46} fill="none" stroke={C.orange} strokeWidth="1.2" opacity={(1 - rp) * 0.6 * arriveP} />;
            })}
        </svg>
        {CHIPS.map((src, i) => {
          const tt = clamp(routeP * 1.45 - i * 0.16, 0, 1);
          const pos = bez(CTRLS[0], tt);
          const vis = tt > 0 && tt < 1 ? Math.min(1, Math.sin(Math.PI * tt) * 2.2) : 0;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: pos.x,
                top: pos.y,
                transform: 'translate(-50%,-50%)',
                opacity: vis,
                width: 44,
                height: 44,
                borderRadius: 9,
                background: 'rgba(20,21,25,0.9)',
                border: '1px solid rgba(242,135,5,0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 18px rgba(242,135,5,0.35)',
              }}
            >
              <img src={src} alt="" style={{ maxWidth: 32, maxHeight: 32 }} />
            </div>
          );
        })}
        <div style={{ position: 'absolute', left: US.x - 22, top: US.y - 38, fontFamily: F.mono, fontSize: 12, letterSpacing: '0.22em', color: C.white, opacity: 0.85 * mapP }}>EUA</div>
        <div
          style={{ position: 'absolute', left: BR.x + 16, top: BR.y - 6, fontFamily: F.mono, fontSize: 12, letterSpacing: '0.22em', color: C.white, opacity: 0.85 * Math.min(1, routeP * 2) }}
        >
          BRASIL
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,8,10,0) 38%, rgba(8,8,10,0.6) 56%, rgba(8,8,10,0.95) 74%)' }} />

      <div style={{ position: 'absolute', left: 72, right: 72, top: 735, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <img src="/images/logo.png" alt="Prog Imports" style={{ width: 170, opacity: msgP, transform: `translateY(${(1 - msgP) * -14}px)` }} />
        <div style={{ fontFamily: F.mono, fontSize: 16, letterSpacing: '0.3em', color: C.orange, opacity: Math.min(1, mapP) }}>DIRETO DOS EUA 🇺🇸</div>
        <div style={{ overflow: 'hidden' }}>
          <h1
            style={{
              margin: 0,
              fontFamily: F.display,
              fontWeight: 600,
              fontSize: 55,
              lineHeight: 1.1,
              color: C.white,
              letterSpacing: '-0.02em',
              transform: `translateY(${(1 - msgP) * 110}%)`,
            }}
          >
            Produtos exclusivos, importados dos EUA<span style={{ color: C.orange }}>.</span>
          </h1>
        </div>
        <div style={{ fontSize: 22, lineHeight: 1.5, color: C.gray, maxWidth: 760, opacity: msgP, transform: `translateY(${(1 - msgP) * 16}px)` }}>
          Do lançamento nos Estados Unidos até a sua casa, sem intermediários.
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
            opacity: msgP,
            transform: `translateY(${(1 - msgP) * 16}px)`,
          }}
        >
          VER PRODUTOS
        </a>
      </div>

      <div style={{ position: 'absolute', left: 72, right: 72, top: 1160, height: 142, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        {ARRIVALS.map((p, i) => {
          const a = sg(arriveP, i * 0.14, i * 0.14 + 0.36, Easing.easeOutCubic);
          return (
            <img
              key={i}
              src={p.src}
              alt=""
              style={{ display: 'block', width: p.w, opacity: a, transform: a >= 1 ? 'none' : `translateY(${(1 - a) * 30}px) scale(${0.8 + 0.2 * a})`, filter: 'drop-shadow(0 18px 22px rgba(0,0,0,0.6))' }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function Banner2Mobile({ index, progress, t }: { index: number; progress: number; t: number }) {
  let mapP = 0;
  let routeP = 0;
  let arriveP = 0;
  let msgP = 0;

  if (index === 0) {
    mapP = sg(progress, 0.05, 0.9);
  } else if (index === 1) {
    mapP = 1;
    routeP = sg(progress, 0.02, 0.98, Easing.linear);
  } else if (index === 2) {
    mapP = 1;
    routeP = 1;
    arriveP = sg(progress, 0.05, 0.9, Easing.linear);
  } else {
    mapP = 1;
    routeP = 1;
    arriveP = 1;
    msgP = sg(progress, 0.05, 0.32);
  }

  return <SetM2 t={t} mapP={mapP} routeP={routeP} arriveP={arriveP} msgP={msgP} />;
}
