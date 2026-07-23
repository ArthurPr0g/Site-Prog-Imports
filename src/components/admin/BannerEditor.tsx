'use client';

import { useState, useTransition } from 'react';
import { updateBannerAction, setSmallBannersVisibleAction } from '@/app/actions/admin';
import { useToast } from '@/components/ui/Toast';

type Banner = { id: string; tag: string; title: string; subtitle: string; image_label: string };

export function BannerEditor({ banners, initialShowSmallBanners }: { banners: Banner[]; initialShowSmallBanners: boolean }) {
  const [state, setState] = useState(banners);
  const [showSmallBanners, setShowSmallBanners] = useState(initialShowSmallBanners);
  const [, startTransition] = useTransition();
  const [, startVisibilityTransition] = useTransition();
  const toast = useToast();

  function update(id: string, patch: Partial<Banner>) {
    setState((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function commit(id: string, patch: Partial<Banner>) {
    startTransition(async () => {
      const result = await updateBannerAction(id, patch);
      if (!result.ok) toast(result.message);
    });
  }

  function toggleVisible() {
    const next = !showSmallBanners;
    setShowSmallBanners(next);
    startVisibilityTransition(async () => {
      const result = await setSmallBannersVisibleAction(next);
      if (!result.ok) {
        setShowSmallBanners(!next);
        toast(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-4 rounded-[18px] border border-border bg-card p-5">
        <div>
          <div className="text-[13.5px] font-extrabold">Exibir esta seção na home</div>
          <div className="mt-0.5 text-[12.5px] text-fg-tertiary">
            Desative para ocultar a grade de 3 banners pequenos do site sem apagar o conteúdo.
          </div>
        </div>
        <button
          type="button"
          onClick={toggleVisible}
          role="switch"
          aria-checked={showSmallBanners}
          className="relative h-7 w-13 flex-shrink-0 rounded-full transition-colors"
          style={{ background: showSmallBanners ? '#F28705' : '#26262b' }}
        >
          <span
            className="absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform"
            style={{ transform: showSmallBanners ? 'translateX(1.5rem)' : 'translateX(0.125rem)' }}
          />
        </button>
      </div>
      {state.map((b, i) => (
        <div key={b.id} className="grid grid-cols-1 items-center gap-6 rounded-[18px] border border-border bg-card p-6 sm:grid-cols-[180px_1fr]">
          <div className="stripe-placeholder grid h-27.5 place-items-center rounded-[14px] border border-border-strong">
            <span className="px-2.5 text-center font-mono text-[10.5px] text-fg-faded">[ banner {i + 1} ]</span>
          </div>
          <div className="flex flex-col gap-2">
            <input
              value={b.tag}
              onChange={(e) => update(b.id, { tag: e.target.value })}
              onBlur={(e) => commit(b.id, { tag: e.target.value })}
              placeholder="Tag (ex: Novo · Direto dos EUA)"
              className="max-w-[340px] rounded-[10px] border border-border-strong bg-input px-3.5 py-2.25 text-xs font-extrabold text-accent outline-none focus:border-accent"
            />
            <input
              value={b.title}
              onChange={(e) => update(b.id, { title: e.target.value })}
              onBlur={(e) => commit(b.id, { title: e.target.value })}
              placeholder="Título do banner"
              className="rounded-[10px] border border-border-strong bg-input px-3.5 py-2.75 font-display text-base font-extrabold outline-none focus:border-accent"
            />
            <input
              value={b.subtitle}
              onChange={(e) => update(b.id, { subtitle: e.target.value })}
              onBlur={(e) => commit(b.id, { subtitle: e.target.value })}
              placeholder="Subtítulo"
              className="rounded-[10px] border border-border-strong bg-input px-3.5 py-2.25 text-[13px] text-fg-secondary outline-none focus:border-accent"
            />
          </div>
        </div>
      ))}
      <div className="text-[12.5px] text-fg-faded">As alterações são aplicadas ao carrossel da home automaticamente.</div>
    </div>
  );
}
