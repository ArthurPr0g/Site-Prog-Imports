'use client';

import { useState, useTransition } from 'react';
import { createCouponAction, toggleCouponAction, deleteCouponAction } from '@/app/actions/admin';

type Coupon = { id: string; code: string; pct: number; uses: number; active: boolean };

export function CouponsPanel({ coupons }: { coupons: Coupon[] }) {
  const [code, setCode] = useState('');
  const [pct, setPct] = useState('');
  const [, startTransition] = useTransition();

  function add() {
    const p = parseInt(pct);
    if (!code.trim() || !p) return;
    startTransition(async () => {
      await createCouponAction(code, p);
      setCode('');
      setPct('');
    });
  }

  return (
    <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[340px_1fr]">
      <div className="rounded-[18px] border border-border bg-card p-6">
        <div className="mb-4 text-[15px] font-extrabold">Novo cupom</div>
        <div className="flex flex-col gap-2.5">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Código (ex: BLACKFRIDAY)"
            className="rounded-control border border-border-strong bg-input px-4 py-3 text-[13px] uppercase outline-none focus:border-accent"
          />
          <input
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            placeholder="Desconto % (ex: 10)"
            className="rounded-control border border-border-strong bg-input px-4 py-3 text-[13px] outline-none focus:border-accent"
          />
          <button onClick={add} className="rounded-control bg-accent py-3 text-[13.5px] font-extrabold text-page">
            Criar cupom
          </button>
        </div>
      </div>
      <div className="rounded-[18px] border border-border bg-card p-6">
        <div className="mb-4 text-[15px] font-extrabold">Cupons ativos</div>
        {coupons.map((c) => (
          <div key={c.id} className="flex items-center gap-3.5 border-b border-divider py-3 last:border-b-0">
            <div className="rounded-[10px] border border-dashed border-accent/50 bg-accent/10 px-3.5 py-1.75 font-mono text-sm font-bold text-accent">
              {c.code}
            </div>
            <div className="text-[13.5px] font-bold">{c.pct}% de desconto</div>
            <div className="text-[12.5px] text-fg-tertiary">{c.uses} usos</div>
            <button
              onClick={() => startTransition(() => toggleCouponAction(c.id, c.active))}
              className="ml-auto rounded-full border px-2.75 py-1.25 text-[11px] font-extrabold"
              style={{
                background: c.active ? 'rgba(74,222,128,.1)' : 'rgba(168,168,176,.08)',
                borderColor: c.active ? 'rgba(74,222,128,.35)' : 'rgba(168,168,176,.3)',
                color: c.active ? '#4ade80' : '#a8a8b0',
              }}
            >
              {c.active ? 'Ativo' : 'Pausado'}
            </button>
            <button
              onClick={() => startTransition(() => deleteCouponAction(c.id))}
              className="rounded-[9px] border border-border-hover px-2.5 py-1.5 text-xs text-fg-tertiary hover:border-error hover:text-error"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
