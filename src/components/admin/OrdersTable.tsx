'use client';

import { useState, useTransition } from 'react';
import { OrderStatusSelect } from './OrderStatusSelect';
import { NewOrderModal } from './NewOrderModal';
import { deleteOrderAction } from '@/app/actions/admin';
import { useToast } from '@/components/ui/Toast';
import type { OrderStatus } from '@/lib/constants';

type Row = { id: string; orderNumber: number; client: string; items: string; date: string; total: string; status: OrderStatus };
type ProductOption = { id: string; name: string; price: number };

const GRID_COLS = '90px_1.2fr_1.5fr_110px_120px_170px_44px'.replace(/_/g, ' ');

export function OrdersTable({ orders, products }: { orders: Row[]; products: ProductOption[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [, startTransition] = useTransition();
  const toast = useToast();

  function remove(o: Row) {
    if (!window.confirm(`Excluir o pedido ${'#' + o.orderNumber} de ${o.client}? Essa ação não pode ser desfeita.`)) return;
    startTransition(async () => {
      const result = await deleteOrderAction(o.id);
      if (!result.ok) toast(result.message);
    });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-control bg-accent px-5 py-2.75 text-[13.5px] font-extrabold text-page transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(242,135,5,.35)]"
        >
          + Lançar pedido
        </button>
      </div>
      <div className="overflow-x-auto rounded-[18px] border border-border bg-card p-6">
        <div className="min-w-[900px]">
          <div
            className="grid gap-3 border-b border-border pb-2.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded"
            style={{ gridTemplateColumns: GRID_COLS }}
          >
            <div>Pedido</div>
            <div>Cliente</div>
            <div>Itens</div>
            <div>Data</div>
            <div>Total</div>
            <div>Status</div>
            <div></div>
          </div>
          {orders.length === 0 && <div className="py-6 text-sm text-fg-tertiary">Nenhum pedido lançado ainda.</div>}
          {orders.map((o) => (
            <div
              key={o.id}
              className="grid items-center gap-3 border-b border-divider py-3 text-[13.5px] last:border-b-0"
              style={{ gridTemplateColumns: GRID_COLS }}
            >
              <div className="font-extrabold text-accent">#{o.orderNumber}</div>
              <div className="font-bold">{o.client}</div>
              <div className="text-[13px] text-fg-secondary">{o.items}</div>
              <div className="text-[13px] text-fg-tertiary">{o.date}</div>
              <div className="font-bold">{o.total}</div>
              <OrderStatusSelect orderId={o.id} status={o.status} />
              <button
                onClick={() => remove(o)}
                title="Excluir pedido"
                className="justify-self-end rounded-[9px] border border-border-hover px-2.5 py-1.5 text-xs text-fg-tertiary hover:border-error hover:text-error"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
      <NewOrderModal open={modalOpen} onClose={() => setModalOpen(false)} products={products} />
    </div>
  );
}
