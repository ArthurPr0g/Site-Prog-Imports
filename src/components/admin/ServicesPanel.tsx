'use client';

import { useState, useTransition } from 'react';
import { addServiceAction, deleteServiceAction } from '@/app/actions/admin';

type Service = { id: string; name: string; price_label: string };

export function ServicesPanel({ services }: { services: Service[] }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [, startTransition] = useTransition();

  function add() {
    if (!name.trim()) return;
    startTransition(async () => {
      await addServiceAction(name, price);
      setName('');
      setPrice('');
    });
  }

  return (
    <div className="rounded-[18px] border border-border bg-card p-6">
      <div className="mb-4.5 flex max-w-[560px] gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do serviço"
          className="flex-[1.4] rounded-control border border-border-strong bg-input px-3.5 py-2.75 text-[13px] outline-none focus:border-accent"
        />
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Preço (ex: R$ 149)"
          className="flex-1 rounded-control border border-border-strong bg-input px-3.5 py-2.75 text-[13px] outline-none focus:border-accent"
        />
        <button onClick={add} className="rounded-control bg-accent px-4.5 py-2.75 text-[13px] font-extrabold text-page">
          Adicionar
        </button>
      </div>
      {services.map((s) => (
        <div key={s.id} className="flex items-center justify-between border-b border-divider py-3 text-[13.5px] last:border-b-0">
          <span className="font-bold">{s.name}</span>
          <div className="flex items-center gap-4">
            <span className="text-[13px] font-extrabold text-accent">{s.price_label}</span>
            <button
              onClick={() => startTransition(() => deleteServiceAction(s.id))}
              className="rounded-[9px] border border-border-hover px-2.5 py-1.5 text-xs text-fg-tertiary hover:border-error hover:text-error"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
