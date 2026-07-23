'use client';

import { useEffect, useState } from 'react';

export const Easing = {
  linear: (t: number) => t,
  easeOutCubic: (t: number) => {
    const u = t - 1;
    return u * u * u + 1;
  },
  easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
};

export type EaseFn = (t: number) => number;

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/** Maps a scene-local progress into the [a,b] sub-window, eased. Mirrors the `sg` helper from the design handoff. */
export function segment(progress: number, a: number, b: number, ease: EaseFn = Easing.easeInOutCubic) {
  return ease(clamp((progress - a) / (b - a), 0, 1));
}

export type SceneSpec = { name: string; dur: number };

export type SceneClockState = {
  index: number;
  progress: number;
  t: number;
  done: boolean;
};

/**
 * Drives a sequence of scenes (cut transitions, play-once-then-hold) off a single
 * requestAnimationFrame loop, mirroring the handoff's SceneStage in "times: 1" mode.
 */
export function useSceneClock(scenes: SceneSpec[], playing: boolean, reducedMotion: boolean): SceneClockState {
  const total = scenes.reduce((acc, s) => acc + s.dur, 0);
  const [animState, setAnimState] = useState<SceneClockState>({ index: 0, progress: 0, t: 0, done: false });

  useEffect(() => {
    if (reducedMotion || !playing) return;

    let raf = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const elapsed = (now - startedAt) / 1000;
      if (elapsed >= total) {
        setAnimState({ index: scenes.length - 1, progress: 1, t: total, done: true });
        return;
      }
      let acc = 0;
      let idx = 0;
      let local = 0;
      for (let i = 0; i < scenes.length; i++) {
        if (elapsed < acc + scenes[i].dur) {
          idx = i;
          local = (elapsed - acc) / scenes[i].dur;
          break;
        }
        acc += scenes[i].dur;
      }
      setAnimState({ index: idx, progress: local, t: elapsed, done: false });
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // scenes/total are stable module-level constants per banner; only playing/reducedMotion should retrigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, reducedMotion]);

  if (reducedMotion) {
    return { index: scenes.length - 1, progress: 1, t: total, done: true };
  }
  return animState;
}

export const HERO_COLORS = {
  bg: '#08080A',
  white: '#F5F5F3',
  gray: '#9EA0A8',
  faded: '#5B5D64',
  orange: '#F28705',
  line: '#26272C',
  node: '#1B1C21',
};

export const HERO_FONTS = {
  display: "var(--font-space-grotesk), 'Space Grotesk', sans-serif",
  body: "var(--font-manrope), 'Manrope', sans-serif",
  mono: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
};

export const HERO_ASSET = (name: string) => `/hero-banners/${name}`;

export function heroBgGrid(opacity = 0.05, cell = 96): React.CSSProperties {
  return {
    position: 'absolute',
    inset: 0,
    opacity,
    backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
    backgroundSize: `${cell}px ${cell}px`,
  };
}
