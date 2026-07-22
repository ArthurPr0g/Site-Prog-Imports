'use client';

import { useState, useTransition } from 'react';
import { createCouponAction, toggleCouponAction, deleteCouponAction } from '@/app/actions/admin';
import { useToast } from '@/components/ui/Toast';

type Coupon = { id: string; code: string; pct: number; uses: number; active: boolean };

export function CouponsPanel({ coupons }: { coupons: Coupon[] }) {
  const [code, setCode] = useState('');
  const [pct, setPct] = useState('');
  const [error, setError] = useState('');
  const [, startTransition] = useTransition();
  const toast = useToast();

  function add() {
    setError('');
    const p = parseInt(pct, 10);
    if (!code.trim()) return setError('Informe o código do cupom.');
    if (!Number.isFinite(p) || p < 1 || p > 100) return setError('O desconto deve ser um número entre 1 e 100.');
    startTransition(async () => {
      const result = await createCouponAction(code, p);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCode('');
      setPct('');
    });
  }

  function remove(c: Coupon) {
    if (!window.confirm(`Excluir o cupom "${c.code}"?`)) return;
    startTransition(async () => {
      const result = await deleteCouponAction(c.id);
      if (!result.ok) toast(result.message);
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
          {error && <div className="text-[13px] font-semibold text-error">{error}</div>}
          <button onClick={add} className="rounded-control bg-accent py-3 text-[13.5px] font-extrabold text-page">
            Criar cupom
          </button>
        </div>
      </div>
      <div className="rounded-[18px] border border-border bg-card p-6">
        <div className="mb-4 text-[15px] font-extrabold">Cupons ativos</div>
        {coupons.length === 0 && <div className="text-sm text-fg-tertiary">Nenhum cupom cadastrado ainda.</div>}
        {coupons.map((c) => (
          <div key={c.id} className="flex items-center gap-3.5 border-b border-divider py-3 last:border-b-0">
            <div className="rounded-[10px] border border-dashed border-accent/50 bg-accent/10 px-3.5 py-1.75 font-mono text-sm font-bold text-accent">
              {c.code}
            </div>
            <div className="text-[13.5px] font-bold">{c.pct}% de desconto</div>
            <div className="text-[12.5px] text-fg-tertiary">{c.uses} usos</div>
            <button
              onClick={() =>
                startTransition(async () => {
                  const result = await toggleCouponAction(c.id, c.active);
                  if (!result.ok) toast(result.message);
                })
              }
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
              onClick={() => remove(c)}
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
