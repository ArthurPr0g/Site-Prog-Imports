'use client';

import { useState, useTransition } from 'react';
import { addServiceAction, deleteServiceAction, updateServiceAction } from '@/app/actions/admin';
import { useToast } from '@/components/ui/Toast';
import { getServiceIcon } from '@/lib/service-icons';

type Service = { id: string; name: string; description: string; price_label: string };

const inputClass = 'rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13px] outline-none focus:border-accent';

export function ServicesPanel({ services }: { services: Service[] }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const toast = useToast();

  function add() {
    setError('');
    if (!name.trim()) return setError('Informe o nome do serviço.');
    startTransition(async () => {
      const result = await addServiceAction(name, description, price);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setName('');
      setDescription('');
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
      <div className="mb-5 flex max-w-[560px] flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do serviço" className={`flex-[1.4] ${inputClass}`} />
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Preço (ex: R$ 149)" className={`flex-1 ${inputClass}`} />
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descrição"
          rows={2}
          className={`resize-none ${inputClass}`}
        />
        <button onClick={add} className="self-start rounded-control bg-accent px-4.5 py-2.75 text-[13px] font-extrabold text-page">
          Adicionar
        </button>
      </div>
      {error && <div className="mb-3 text-[13px] font-semibold text-error">{error}</div>}
      {services.length === 0 && <div className="py-3 text-[13px] text-fg-tertiary">Nenhum serviço cadastrado ainda.</div>}
      {services.map((s) =>
        editingId === s.id ? (
          <ServiceEditRow key={s.id} service={s} onDone={() => setEditingId(null)} />
        ) : (
          <ServiceRow key={s.id} service={s} onEdit={() => setEditingId(s.id)} onRemove={() => remove(s)} />
        )
      )}
    </div>
  );
}

function ServiceRow({ service, onEdit, onRemove }: { service: Service; onEdit: () => void; onRemove: () => void }) {
  const icon = { Icon: getServiceIcon(service.name) };
  return (
    <div className="flex items-center gap-3.5 border-b border-divider py-3 last:border-b-0">
      <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-[10px] border border-accent/30 bg-accent/10 text-accent">
        <icon.Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-bold">{service.name}</div>
        {service.description && <div className="truncate text-xs text-fg-tertiary">{service.description}</div>}
      </div>
      <span className="flex-shrink-0 text-[13px] font-extrabold text-accent">{service.price_label}</span>
      <div className="flex flex-shrink-0 gap-1.5">
        <button onClick={onEdit} className="rounded-[9px] border border-border-hover px-3 py-1.5 text-xs font-bold hover:border-accent">
          Editar
        </button>
        <button onClick={onRemove} className="rounded-[9px] border border-border-hover px-2.5 py-1.5 text-xs text-fg-tertiary hover:border-error hover:text-error">
          ✕
        </button>
      </div>
    </div>
  );
}

function ServiceEditRow({ service, onDone }: { service: Service; onDone: () => void }) {
  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description);
  const [price, setPrice] = useState(service.price_label);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function save() {
    setError('');
    if (!name.trim()) return setError('Informe o nome do serviço.');
    startTransition(async () => {
      const result = await updateServiceAction(service.id, name, description, price);
      if (!result.ok) {
        toast(result.message);
        return;
      }
      onDone();
    });
  }

  return (
    <div className="flex flex-col gap-2 border-b border-divider py-3 last:border-b-0">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={name} onChange={(e) => setName(e.target.value)} className={`flex-[1.4] ${inputClass}`} />
        <input value={price} onChange={(e) => setPrice(e.target.value)} className={`flex-1 ${inputClass}`} />
      </div>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={`resize-none ${inputClass}`} />
      {error && <div className="text-[13px] font-semibold text-error">{error}</div>}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-control bg-accent px-4 py-2 text-[13px] font-extrabold text-page disabled:opacity-60"
        >
          {pending ? 'Salvando…' : 'Salvar'}
        </button>
        <button onClick={onDone} disabled={pending} className="rounded-control border border-border-hover px-4 py-2 text-[13px] font-bold">
          Cancelar
        </button>
      </div>
    </div>
  );
}
