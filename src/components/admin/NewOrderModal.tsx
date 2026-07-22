'use client';

import { useMemo, useState, useTransition } from 'react';
import { createOrderAction } from '@/app/actions/admin';
import { formatBRL } from '@/lib/format';
import { ORDER_STATUSES, type OrderStatus } from '@/lib/constants';
import { useToast } from '@/components/ui/Toast';

type ProductOption = { id: string; name: string; price: number };
type Item = { productId: string; qty: number };

const inputClass =
  'rounded-control border border-border-strong bg-input px-4 py-3 text-[13.5px] outline-none focus:border-accent';

export function NewOrderModal({ open, onClose, products }: { open: boolean; onClose: () => void; products: ProductOption[] }) {
  const [clientName, setClientName] = useState('');
  const [status, setStatus] = useState<OrderStatus>('Aguardando pagamento');
  const [items, setItems] = useState<Item[]>([{ productId: products[0]?.id ?? '', qty: 1 }]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const toast = useToast();

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const total = items.reduce((sum, it) => sum + (byId.get(it.productId)?.price ?? 0) * it.qty, 0);

  if (!open) return null;

  function updateItem(i: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  }

  function save() {
    setError('');
    if (!clientName.trim()) return setError('Informe o nome do cliente.');
    if (products.length === 0) return setError('Cadastre ao menos um produto antes de lançar um pedido.');
    if (items.some((it) => !it.productId)) return setError('Selecione um produto em cada item.');

    startTransition(async () => {
      const result = await createOrderAction({ clientName: clientName.trim(), status, items });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast(result.message);
      setClientName('');
      setItems([{ productId: products[0]?.id ?? '', qty: 1 }]);
      setStatus('Aguardando pagamento');
      onClose();
    });
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-99 bg-black/65 backdrop-blur-sm" />
      <div className="fixed left-1/2 top-1/2 z-100 max-h-[88vh] w-[min(560px,94vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[22px] border border-border-strong bg-card p-8 shadow-[0_40px_100px_rgba(0,0,0,.7)]">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-display text-xl font-bold">Lançar pedido</div>
          <button onClick={onClose} className="grid h-8.5 w-8.5 place-items-center rounded-full border border-border-strong text-fg-secondary hover:border-accent hover:text-accent">
            ✕
          </button>
        </div>
        <div className="mb-5.5 text-[13px] text-fg-tertiary">
          Para vendas fechadas pelo WhatsApp — o pedido entra no rastreamento do cliente.
        </div>
        <div className="flex flex-col gap-3">
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nome do cliente" className={inputClass} />
          <div className="mt-1.5 text-xs font-extrabold uppercase tracking-[.08em] text-fg-tertiary">Itens do pedido</div>
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={it.productId}
                onChange={(e) => updateItem(i, { productId: e.target.value })}
                className={`min-w-0 flex-1 cursor-pointer ${inputClass}`}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatBRL(p.price)}
                  </option>
                ))}
              </select>
              <input
                value={it.qty}
                onChange={(e) => updateItem(i, { qty: Math.max(1, parseInt(e.target.value) || 1) })}
                className={`w-14 flex-shrink-0 text-center ${inputClass}`}
              />
              <button
                onClick={() => setItems((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : prev))}
                className="flex-shrink-0 rounded-[9px] border border-border-hover px-2.75 py-2.25 text-xs text-fg-tertiary hover:border-error hover:text-error"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={() => setItems((prev) => [...prev, { productId: products[0]?.id ?? '', qty: 1 }])}
            className="self-start rounded-[10px] border border-border-hover bg-[#1c1c21] px-4 py-2.25 text-xs font-bold text-fg-secondary hover:border-accent hover:text-accent"
          >
            + Adicionar item
          </button>
          <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)} className={`cursor-pointer ${inputClass}`}>
            {ORDER_STATUSES.filter((s) => s !== 'Cancelado').map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="flex items-center justify-between rounded-control border border-border bg-input px-4 py-3.5">
            <span className="text-[13px] font-bold text-fg-tertiary">Total do pedido</span>
            <span className="font-display text-[19px] font-bold text-accent">{formatBRL(total)}</span>
          </div>
        </div>
        {error && <div className="mt-3 text-[13px] font-semibold text-error">{error}</div>}
        <div className="mt-6 flex justify-end gap-2.5">
          <button onClick={onClose} className="rounded-control border border-border-strong px-5.5 py-3 text-[13.5px] font-bold text-fg-secondary">
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={pending}
            className="rounded-control bg-accent px-6.5 py-3 text-[13.5px] font-extrabold text-page disabled:opacity-60"
          >
            {pending ? 'Lançando…' : 'Lançar pedido'}
          </button>
        </div>
      </div>
    </>
  );
}
