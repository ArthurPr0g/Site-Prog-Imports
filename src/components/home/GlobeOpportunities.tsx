'use client';

import { useEffect, useRef } from 'react';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';

type Vec3 = [number, number, number];
type Deal = { t: string; img: string; image?: HTMLImageElement };
type City = { lat: number; lon: number; city: string };
type Opportunity = {
  v: Vec3;
  city: string;
  deal: Deal;
  age: number;
  life: number;
  plane: boolean;
  fired: boolean;
};
type Plane = { a: Vec3; b: Vec3; t: number; dur: number; landed: number };

const GOIANIA = { lat: -16.6869, lon: -49.2648, name: 'Goiânia · GO' };

const CITIES: City[] = [
  { lat: 37.77, lon: -122.42, city: 'San Francisco' },
  { lat: 40.71, lon: -74.0, city: 'Nova York' },
  { lat: 25.76, lon: -80.19, city: 'Miami' },
  { lat: 34.05, lon: -118.24, city: 'Los Angeles' },
  { lat: 47.61, lon: -122.33, city: 'Seattle' },
  { lat: 30.27, lon: -97.74, city: 'Austin' },
  { lat: 51.51, lon: -0.13, city: 'Londres' },
  { lat: 52.52, lon: 13.4, city: 'Berlim' },
  { lat: 25.2, lon: 55.27, city: 'Dubai' },
  { lat: 35.68, lon: 139.69, city: 'Tóquio' },
  { lat: 22.54, lon: 114.06, city: 'Shenzhen' },
  { lat: 1.35, lon: 103.82, city: 'Singapura' },
  { lat: 37.57, lon: 126.98, city: 'Seul' },
  { lat: 19.43, lon: -99.13, city: 'Cidade do México' },
  { lat: 43.65, lon: -79.38, city: 'Toronto' },
];

const DEALS: Deal[] = [
  { t: 'MacBook Pro M4 · $1.999', img: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=120&q=60' },
  { t: 'iPhone 16 Pro Max · $1.199', img: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=120&q=60' },
  { t: 'RTX 5090 · $1.999', img: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=120&q=60' },
  { t: 'Alienware m18 · $2.499', img: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=120&q=60' },
  { t: 'iPad Pro M4 · $999', img: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=120&q=60' },
  { t: 'Apple Watch Ultra · $799', img: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=120&q=60' },
  { t: 'Monitor OLED 4K · $899', img: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=120&q=60' },
  { t: 'MacBook Air M3 · $1.099', img: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=120&q=60' },
  { t: 'AirPods Max · $549', img: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=120&q=60' },
  { t: 'Galaxy S25 Ultra · $1.299', img: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=120&q=60' },
];

const ORANGE = '#f59e0b';
const ORANGE2 = '#fb923c';

function ll2v(lat: number, lon: number): Vec3 {
  const la = (lat * Math.PI) / 180;
  const lo = (-lon * Math.PI) / 180;
  return [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)];
}

function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  d = Math.max(-1, Math.min(1, d));
  const th = Math.acos(d);
  if (th < 1e-4) return [...a];
  const s = Math.sin(th);
  const f1 = Math.sin((1 - t) * th) / s;
  const f2 = Math.sin(t * th) / s;
  return [a[0] * f1 + b[0] * f2, a[1] * f1 + b[1] * f2, a[2] * f1 + b[2] * f2];
}

function arcPoint(a: Vec3, b: Vec3, t: number): Vec3 {
  const p = slerp(a, b, t);
  const alt = 1 + Math.sin(t * Math.PI) * 0.26;
  return [p[0] * alt, p[1] * alt, p[2] * alt];
}

/**
 * Globo pontilhado 3D interativo — desenhado à mão em canvas 2D (sem lib de 3D).
 * Handoff completo em design_handoff_globo_oportunidades/. Roda inteiro dentro de
 * um único useEffect porque toda a simulação (rotação, oportunidades, aviões) é
 * estado local ao closure do canvas, não estado React — re-renderizar a cada
 * frame seria desperdício. Os helpers internos são `const` com arrow function
 * (não `function` hoisted) para o TypeScript preservar o narrowing de
 * canvas/ctx/container feito logo no início do efeito.
 */
export function GlobeOpportunities() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !container || !ctx) return;

    let cancelled = false;
    let rafId = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    let W = 0;
    let H = 0;
    let CX = 0;
    let CY = 0;
    let R = 0;
    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      W = w;
      H = h;
      canvas.width = w * DPR;
      canvas.height = h * DPR;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      CX = w / 2;
      CY = h / 2;
      R = Math.min(w, h) * 0.4;
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    let rotY = 1.9;
    let rotX = -0.32;
    const autoSpeed = 0.0014;
    let velY = 0;

    const project = (v: Vec3): Vec3 => {
      const cy = Math.cos(rotY);
      const sy = Math.sin(rotY);
      const x = v[0] * cy + v[2] * sy;
      let z = -v[0] * sy + v[2] * cy;
      const cx = Math.cos(rotX);
      const sx = Math.sin(rotX);
      const y = v[1] * cx - z * sx;
      z = v[1] * sx + z * cx;
      return [CX + x * R, CY - y * R, z];
    };

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let idleT = 0;
    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      velY = 0;
      canvas.classList.add('dragging');
      canvas.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      rotY += dx * 0.005;
      rotX = Math.max(-1.2, Math.min(1.2, rotX + dy * 0.004));
      velY = dx * 0.005;
      idleT = 0;
    };
    const endDrag = () => {
      dragging = false;
      canvas.classList.remove('dragging');
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    const GOI_V = ll2v(GOIANIA.lat, GOIANIA.lon);
    const opps: Opportunity[] = [];
    const planes: Plane[] = [];
    let spawnTimer = 40;
    let dots: Vec3[] = [];

    const spawnOpp = () => {
      const free = CITIES.filter((c) => !opps.some((o) => o.city === c.city));
      if (!free.length) return;
      const c = free[Math.floor(Math.random() * free.length)];
      opps.push({
        v: ll2v(c.lat, c.lon),
        city: c.city,
        deal: DEALS[Math.floor(Math.random() * DEALS.length)],
        age: 0,
        life: 360 + Math.random() * 240,
        plane: Math.random() < 0.55,
        fired: false,
      });
    };

    const launchPlane = (fromV: Vec3) => {
      planes.push({ a: [...fromV], b: GOI_V, t: 0, dur: 420 + Math.random() * 160, landed: 0 });
    };

    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    const drawLabel = (
      px: number,
      py: number,
      line1: string,
      line2: string | null,
      alpha: number,
      accent: string,
      image: HTMLImageElement | null
    ) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      const s = Math.max(0.85, Math.min(1.15, R / 280));
      const f1 = 15 * s;
      const f2 = 13 * s;
      ctx.font = `600 ${f1}px "Segoe UI", system-ui, sans-serif`;
      const w1 = ctx.measureText(line1).width;
      ctx.font = `${f2}px "Segoe UI", system-ui, sans-serif`;
      const w2 = line2 ? ctx.measureText(line2).width : 0;
      const pad = 10 * s;
      const imgSz = image ? 36 * s : 0;
      const imgGap = image ? 8 * s : 0;
      const w = Math.max(w1, w2) + pad * 2 + imgSz + imgGap;
      const h = (line2 ? 48 : 28) * s;
      let x = px + 9 * s;
      let y = py - h - 6 * s;
      if (x + w > W - 6) x = px - w - 14 * s;
      if (y < 6) y = py + 16 * s;
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x < px ? x + w : x, y + h);
      ctx.stroke();
      ctx.fillStyle = 'rgba(18,18,22,0.94)';
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      roundRect(x, y, w, h, 7 * s);
      ctx.fill();
      ctx.stroke();
      if (image) {
        ctx.save();
        roundRect(x + 6 * s, y + (h - imgSz) / 2, imgSz, imgSz, 5 * s);
        ctx.clip();
        ctx.drawImage(image, x + 6 * s, y + (h - imgSz) / 2, imgSz, imgSz);
        ctx.restore();
      }
      const tx = x + pad + (image ? imgSz : 0) + (image ? imgGap - 4 * s : 0);
      ctx.fillStyle = accent;
      ctx.font = `600 ${f1}px "Segoe UI", system-ui, sans-serif`;
      ctx.fillText(line1, tx, y + 19 * s);
      if (line2) {
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.font = `${f2}px "Segoe UI", system-ui, sans-serif`;
        ctx.fillText(line2, tx, y + 37 * s);
      }
      ctx.restore();
    };

    let frame = 0;
    const tick = () => {
      frame++;
      if (!dragging) {
        idleT++;
        if (Math.abs(velY) > 0.0005) {
          rotY += velY;
          velY *= 0.95;
        } else if (idleT > 60) {
          rotY += autoSpeed;
        } else {
          rotY += autoSpeed * Math.min(1, idleT / 60);
        }
      }

      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const g = ctx.createRadialGradient(CX - R * 0.35, CY - R * 0.4, R * 0.1, CX, CY, R * 1.05);
      g.addColorStop(0, 'rgba(255,255,255,0.055)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.018)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(CX, CY, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(CX, CY, R, 0, Math.PI * 2);
      ctx.stroke();

      const dr = Math.max(0.9, R * 0.006);
      for (let i = 0; i < dots.length; i++) {
        const p = project(dots[i]);
        if (p[2] <= 0.02) continue;
        const a = 0.14 + p[2] * 0.5;
        ctx.fillStyle = `rgba(235,235,240,${a})`;
        ctx.fillRect(p[0] - dr / 2, p[1] - dr / 2, dr, dr);
      }

      {
        const p = project(GOI_V);
        if (p[2] > 0) {
          const pulse = (frame % 120) / 120;
          ctx.strokeStyle = `rgba(245,158,11,${(1 - pulse) * 0.5 * p[2]})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(p[0], p[1], 4 + pulse * 14, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = ORANGE;
          ctx.beginPath();
          ctx.arc(p[0], p[1], 4.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#0a0a0d';
          ctx.beginPath();
          ctx.arc(p[0], p[1], 1.8, 0, Math.PI * 2);
          ctx.fill();
          drawLabel(p[0], p[1], GOIANIA.name, null, Math.min(1, p[2] * 2.2), '#fff', null);
        }
      }

      spawnTimer--;
      if (spawnTimer <= 0 && opps.length < 6) {
        spawnOpp();
        spawnTimer = 60 + Math.random() * 90;
      }
      for (let i = opps.length - 1; i >= 0; i--) {
        const o = opps[i];
        o.age++;
        if (o.plane && !o.fired && o.age > 100) {
          o.fired = true;
          launchPlane(o.v);
        }
        if (o.age > o.life) {
          opps.splice(i, 1);
          continue;
        }
        const p = project(o.v);
        if (p[2] <= 0) continue;
        const fadeIn = Math.min(1, o.age / 25);
        const fadeOut = Math.min(1, (o.life - o.age) / 30);
        const a = fadeIn * fadeOut * Math.min(1, p[2] * 2.5);
        const pulse = ((frame + i * 40) % 90) / 90;
        ctx.strokeStyle = `rgba(251,146,60,${(1 - pulse) * 0.6 * a})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p[0], p[1], 3 + pulse * 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(251,146,60,${a})`;
        ctx.beginPath();
        ctx.arc(p[0], p[1], 2.6, 0, Math.PI * 2);
        ctx.fill();
        drawLabel(p[0], p[1], o.deal.t, o.city, a, ORANGE2, o.deal.image ?? null);
      }

      for (let i = planes.length - 1; i >= 0; i--) {
        const pl = planes[i];
        pl.t += 1 / pl.dur;
        if (pl.t >= 1) {
          pl.landed++;
          if (pl.landed > 50) {
            planes.splice(i, 1);
            continue;
          }
          const p = project(GOI_V);
          if (p[2] > 0) {
            const k = pl.landed / 50;
            ctx.strokeStyle = `rgba(245,158,11,${(1 - k) * 0.8})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p[0], p[1], 3 + k * 22, 0, Math.PI * 2);
            ctx.stroke();
          }
          continue;
        }
        const t = pl.t;
        const t0 = Math.max(0, t - 0.4);
        ctx.lineWidth = 2.6;
        ctx.lineCap = 'round';
        let prev: Vec3 | null = null;
        const SEG = 24;
        for (let s = 0; s <= SEG; s++) {
          const tt = t0 + (t - t0) * (s / SEG);
          const p = project(arcPoint(pl.a, pl.b, tt));
          if (prev && p[2] > -0.05 && prev[2] > -0.05) {
            const seg = s / SEG;
            ctx.strokeStyle = `rgba(245,158,11,${seg * 0.55 * Math.max(0.15, Math.min(1, p[2] + 0.4))})`;
            ctx.beginPath();
            ctx.moveTo(prev[0], prev[1]);
            ctx.lineTo(p[0], p[1]);
            ctx.stroke();
          }
          prev = p;
        }
        const p1 = project(arcPoint(pl.a, pl.b, t));
        const p2 = project(arcPoint(pl.a, pl.b, Math.min(1, t + 0.01)));
        if (p1[2] > 0) {
          const ang = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
          const sc = Math.max(0.8, Math.min(1.15, R / 280));
          ctx.save();
          ctx.translate(p1[0], p1[1]);
          ctx.rotate(ang);
          ctx.fillStyle = '#fff';
          ctx.shadowColor = ORANGE;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.moveTo(7 * sc, 0);
          ctx.lineTo(-4 * sc, 4.5 * sc);
          ctx.lineTo(-2 * sc, 0);
          ctx.lineTo(-4 * sc, -4.5 * sc);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    (async () => {
      try {
        const res = await fetch('/countries-110m.json');
        const topo = (await res.json()) as Topology;
        if (cancelled) return;
        const land = feature(topo, topo.objects.countries);

        const MW = 1024;
        const MH = 512;
        const off = document.createElement('canvas');
        off.width = MW;
        off.height = MH;
        const octx = off.getContext('2d');
        if (!octx) return;
        const proj = geoEquirectangular().fitSize([MW, MH], { type: 'Sphere' });
        const path = geoPath(proj, octx);
        octx.fillStyle = '#fff';
        octx.beginPath();
        path(land);
        octx.fill();
        const imgData = octx.getImageData(0, 0, MW, MH).data;
        const isLand = (lon: number, lat: number) => {
          const p = proj([lon, lat]);
          if (!p) return false;
          const x = Math.round(p[0]);
          const y = Math.round(p[1]);
          if (x < 0 || x >= MW || y < 0 || y >= MH) return false;
          return imgData[(y * MW + x) * 4 + 3] > 120;
        };

        const STEP = 1.55;
        const generatedDots: Vec3[] = [];
        for (let lat = -80; lat <= 85; lat += STEP) {
          const c = Math.cos((lat * Math.PI) / 180);
          const n = Math.max(1, Math.floor((360 * c) / STEP));
          for (let i = 0; i < n; i++) {
            const lon = -180 + i * (360 / n);
            if (isLand(lon, lat)) generatedDots.push(ll2v(lat, lon));
          }
        }
        if (cancelled) return;
        dots = generatedDots;

        DEALS.forEach((d) => {
          const im = new Image();
          im.crossOrigin = 'anonymous';
          im.onload = () => {
            d.image = im;
          };
          im.src = d.img;
        });

        spawnOpp();
        spawnOpp();
        spawnOpp();
        rafId = requestAnimationFrame(tick);
      } catch {
        // sem conexão com a fonte de dados do mapa — a seção segue normal sem o globo
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', endDrag);
      canvas.removeEventListener('pointercancel', endDrag);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative aspect-square w-full min-w-[300px]">
      <canvas ref={canvasRef} className="block touch-none cursor-grab active:cursor-grabbing" />
    </div>
  );
}
