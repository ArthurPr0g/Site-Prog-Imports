'use client';

import { useState } from 'react';
import { OrderStatusSelect } from './OrderStatusSelect';
import { NewOrderModal } from './NewOrderModal';
import type { OrderStatus } from '@/lib/constants';

type Row = { id: string; orderNumber: number; client: string; items: string; date: string; total: string; status: OrderStatus };
type ProductOption = { id: string; name: string; price: number };

export function OrdersTable({ orders, products }: { orders: Row[]; products: ProductOption[] }) {
  const [modalOpen, setModalOpen] = useState(false);

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
        <div className="min-w-[860px]">
          <div className="grid grid-cols-[90px_1.2fr_1.6fr_110px_120px_190px] gap-3 border-b border-border pb-2.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
            <div>Pedido</div>
            <div>Cliente</div>
            <div>Itens</div>
            <div>Data</div>
            <div>Total</div>
            <div>Status</div>
          </div>
          {orders.map((o) => (
            <div key={o.id} className="grid grid-cols-[90px_1.2fr_1.6fr_110px_120px_190px] items-center gap-3 border-b border-divider py-3 text-[13.5px] last:border-b-0">
              <div className="font-extrabold text-accent">#{o.orderNumber}</div>
              <div className="font-bold">{o.client}</div>
              <div className="text-[13px] text-fg-secondary">{o.items}</div>
              <div className="text-[13px] text-fg-tertiary">{o.date}</div>
              <div className="font-bold">{o.total}</div>
              <OrderStatusSelect orderId={o.id} status={o.status} />
            </div>
          ))}
        </div>
      </div>
      <NewOrderModal open={modalOpen} onClose={() => setModalOpen(false)} products={products} />
    </div>
  );
}
