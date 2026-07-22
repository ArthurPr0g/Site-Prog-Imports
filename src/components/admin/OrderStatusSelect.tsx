'use client';

import { useState, useTransition } from 'react';
import { updateOrderStatusAction } from '@/app/actions/admin';
import { ORDER_STATUSES, STATUS_STYLES, type OrderStatus } from '@/lib/constants';
import { useToast } from '@/components/ui/Toast';

export function OrderStatusSelect({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const [value, setValue] = useState(status);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const style = STATUS_STYLES[value];

  function onChange(next: OrderStatus) {
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const result = await updateOrderStatusAction(orderId, next);
      if (!result.ok) {
        setValue(previous);
        toast(result.message);
      }
    });
  }

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => onChange(e.target.value as OrderStatus)}
      className="cursor-pointer rounded-[10px] border px-2.5 py-2 text-xs font-extrabold outline-none disabled:opacity-60"
      style={{ background: style.bg, borderColor: style.border, color: style.color }}
    >
      {ORDER_STATUSES.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}
