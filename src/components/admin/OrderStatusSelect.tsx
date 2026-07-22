'use client';

import { useTransition } from 'react';
import { updateOrderStatusAction } from '@/app/actions/admin';
import { ORDER_STATUSES, STATUS_STYLES, type OrderStatus } from '@/lib/constants';

export function OrderStatusSelect({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const [pending, startTransition] = useTransition();
  const style = STATUS_STYLES[status];

  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => startTransition(() => updateOrderStatusAction(orderId, e.target.value as OrderStatus))}
      className="cursor-pointer rounded-[10px] border px-2.5 py-2 text-xs font-extrabold outline-none"
      style={{ background: style.bg, borderColor: style.border, color: style.color }}
    >
      {ORDER_STATUSES.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}
