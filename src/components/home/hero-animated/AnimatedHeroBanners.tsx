'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Banner1, BANNER1_SCENES } from './Banner1';
import { Banner2, BANNER2_SCENES } from './Banner2';
import { Banner3, BANNER3_SCENES } from './Banner3';
import { Banner4, BANNER4_SCENES } from './Banner4';
import { useSceneClock, type SceneSpec } from './scene-engine';

const SLIDES: { Component: (p: { index: number; progress: number; t: number }) => React.ReactElement; scenes: SceneSpec[] }[] = [
  { Component: Banner1, scenes: BANNER1_SCENES },
  { Component: Banner2, scenes: BANNER2_SCENES },
  { Component: Banner3, scenes: BANNER3_SCENES },
  { Component: Banner4, scenes: BANNER4_SCENES },
];

const HOLD_MS = 3200;

function subscribeReducedMotion(callback: () => void) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}
function getReducedMotionSnapshot() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function getReducedMotionServerSnapshot() {
  return false;
}
function useReducedMotion() {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, getReducedMotionServerSnapshot);
}

function useCanvasScale(canvasWidth = 1920) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / canvasWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [canvasWidth]);
  return [ref, scale] as const;
}

function Slide({ index, active, reducedMotion, onDone }: { index: number; active: boolean; reducedMotion: boolean; onDone: () => void }) {
  const { Component, scenes } = SLIDES[index];
  const clock = useSceneClock(scenes, active, reducedMotion);
  const firedRef = useRef(false);

  useEffect(() => {
    if (clock.done && !firedRef.current) {
      firedRef.current = true;
      onDone();
    }
  }, [clock.done, onDone]);

  return <Component index={clock.index} progress={clock.progress} t={clock.t} />;
}

export function AnimatedHeroBanners() {
  const [active, setActive] = useState(0);
  const [slideKey, setSlideKey] = useState(0);
  const reducedMotion = useReducedMotion();
  const [containerRef, scale] = useCanvasScale();
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const goTo = useCallback((next: number) => {
    setActive(((next % SLIDES.length) + SLIDES.length) % SLIDES.length);
    setSlideKey((k) => k + 1);
  }, []);

  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  const handleDone = useCallback(() => {
    if (reducedMotion) return;
    advanceTimer.current = setTimeout(() => {
      setActive((prev) => {
        const next = (prev + 1) % SLIDES.length;
        setSlideKey((k) => k + 1);
        return next;
      });
    }, HOLD_MS);
  }, [reducedMotion]);

  return (
    <section className="mx-auto mt-6 max-w-[1280px] px-6">
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-2xl border border-border"
        style={{ aspectRatio: '1920 / 800' }}
      >
        {scale > 0 && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: 1920, height: 800, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <Slide key={slideKey} index={active} active reducedMotion={reducedMotion} onDone={handleDone} />
          </div>
        )}

        <button
          onClick={() => goTo(active - 1)}
          aria-label="Banner anterior"
          className="absolute left-3 top-1/2 z-2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-border-strong bg-page/70 text-base text-fg backdrop-blur-md transition-all hover:border-accent hover:text-accent active:scale-95 sm:h-11 sm:w-11"
        >
          ‹
        </button>
        <button
          onClick={() => goTo(active + 1)}
          aria-label="Próximo banner"
          className="absolute right-3 top-1/2 z-2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-border-strong bg-page/70 text-base text-fg backdrop-blur-md transition-all hover:border-accent hover:text-accent active:scale-95 sm:h-11 sm:w-11"
        >
          ›
        </button>

        <div className="absolute bottom-3 left-1/2 z-2 flex -translate-x-1/2 gap-2 sm:bottom-4">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Ir para o banner ${i + 1}`}
              className="h-1.5 rounded-full transition-all"
              style={{ width: i === active ? 22 : 7, background: i === active ? '#F28705' : 'rgba(245,245,243,.35)' }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
