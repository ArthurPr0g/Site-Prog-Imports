'use client';

import { useState, useTransition } from 'react';
import { addServiceAction, deleteServiceAction } from '@/app/actions/admin';
import { useToast } from '@/components/ui/Toast';

type Service = { id: string; name: string; price_label: string };

export function ServicesPanel({ services }: { services: Service[] }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [, startTransition] = useTransition();
  const toast = useToast();

  function add() {
    setError('');
    if (!name.trim()) return setError('Informe o nome do serviço.');
    startTransition(async () => {
      const result = await addServiceAction(name, price);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setName('');
      setPrice('');
    });
  }

  function remove(s: Service) {
    if (!window.confirm(`Excluir o serviço "${s.name}"?`)) return;
    startTransition(async () => {
      const result = await deleteServiceAction(s.id);
      if (!result.ok) toast(result.message);
    });
  }

  return (
    <div className="rounded-[18px] border border-border bg-card p-6">
      <div className="mb-2 flex max-w-[560px] flex-col gap-2 sm:flex-row">
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
      {error && <div className="mb-3 text-[13px] font-semibold text-error">{error}</div>}
      {services.length === 0 && <div className="py-3 text-[13px] text-fg-tertiary">Nenhum serviço cadastrado ainda.</div>}
      {services.map((s) => (
        <div key={s.id} className="flex items-center justify-between border-b border-divider py-3 text-[13.5px] last:border-b-0">
          <span className="font-bold">{s.name}</span>
          <div className="flex items-center gap-4">
            <span className="text-[13px] font-extrabold text-accent">{s.price_label}</span>
            <button
              onClick={() => remove(s)}
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
