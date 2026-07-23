'use client';

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { GripVertical } from 'lucide-react';
import {
  addCatalogItemAction,
  deleteCatalogItemAction,
  reorderCatalogItemsAction,
  toggleCategoryActiveAction,
  uploadCategoryImageAction,
  removeCategoryImageAction,
} from '@/app/actions/admin';
import { useToast } from '@/components/ui/Toast';
import { useDragReorder } from '@/lib/useDragReorder';

type Item = { id: string; name: string; image_url: string | null; active?: boolean };

export function CoverImageCatalogGroup({
  title,
  items: itemsProp,
  placeholder,
}: {
  title: string;
  items: Item[];
  placeholder: string;
}) {
  const [draft, setDraft] = useState('');
  const [, startTransition] = useTransition();
  const toast = useToast();

  const { items, rowRef, handlePointerDown } = useDragReorder(itemsProp, (orderedIds) => {
    startTransition(async () => {
      const result = await reorderCatalogItemsAction('categories', orderedIds);
      if (!result.ok) toast(result.message);
    });
  });

  function add() {
    if (!draft.trim()) return;
    startTransition(async () => {
      const result = await addCatalogItemAction('categories', draft);
      if (!result.ok) {
        toast(result.message);
        return;
      }
      setDraft('');
    });
  }

  function remove(item: Item) {
    if (!window.confirm(`Excluir "${item.name}"?`)) return;
    startTransition(async () => {
      const result = await deleteCatalogItemAction('categories', item.id);
      if (!result.ok) toast(result.message);
    });
  }

  function toggleActive(item: Item) {
    startTransition(async () => {
      const result = await toggleCategoryActiveAction(item.id, item.active ?? true);
      if (!result.ok) toast(result.message);
    });
  }

  return (
    <div className="rounded-[18px] border border-border bg-card p-6">
      <div className="mb-4 text-[15px] font-extrabold">{title}</div>
      <div className="mb-3.5 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13px] outline-none focus:border-accent"
        />
        <button onClick={add} className="rounded-control bg-accent px-4 py-2.5 text-[13px] font-extrabold text-page">
          +
        </button>
      </div>
      {items.length === 0 && <div className="text-[13px] text-fg-tertiary">Nenhum item ainda.</div>}
      <div className="flex flex-col gap-3">
        {items.map((item, index) => (
          <CoverImageRow
            key={item.id}
            rowRef={rowRef(index)}
            onPointerDown={handlePointerDown(index)}
            item={item}
            onRemove={() => remove(item)}
            onToggleActive={() => toggleActive(item)}
          />
        ))}
      </div>
    </div>
  );
}

function CoverImageRow({
  item,
  onRemove,
  onToggleActive,
  rowRef,
  onPointerDown,
}: {
  item: Item;
  onRemove: () => void;
  onToggleActive: () => void;
  rowRef: (el: HTMLElement | null) => void;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const active = item.active ?? true;

  function pickFile() {
    inputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const formData = new FormData();
    formData.set('file', file);
    startTransition(async () => {
      const result = await uploadCategoryImageAction(item.id, formData);
      if (!result.ok) toast(result.message);
    });
  }

  function removeCover() {
    startTransition(async () => {
      const result = await removeCategoryImageAction(item.id);
      if (!result.ok) toast(result.message);
    });
  }

  return (
    <div
      ref={rowRef}
      className="flex flex-wrap items-center gap-2.5 border-b border-divider pb-3 last:border-b-0"
      style={{ opacity: active ? 1 : 0.5 }}
    >
      <span
        onPointerDown={onPointerDown}
        className="flex-shrink-0 cursor-grab text-fg-faded active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        title="Arrastar para reordenar"
      >
        <GripVertical size={16} />
      </span>
      <button
        onClick={pickFile}
        disabled={pending}
        title="Trocar capa"
        className="stripe-placeholder relative grid h-14 w-14 flex-shrink-0 place-items-center overflow-hidden rounded-[12px] border border-border-strong hover:border-accent disabled:opacity-60"
      >
        {item.image_url ? (
          <Image src={item.image_url} alt={item.name} fill sizes="56px" draggable={false} className="object-cover" />
        ) : (
          <span className="font-mono text-[9px] text-fg-faded">capa</span>
        )}
      </button>
      <input ref={inputRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-bold">{item.name}</div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <button onClick={pickFile} disabled={pending} className="text-fg-tertiary hover:text-accent">
            {pending ? 'Enviando…' : item.image_url ? 'Trocar capa' : 'Adicionar capa'}
          </button>
          {item.image_url && (
            <button onClick={removeCover} disabled={pending} className="text-fg-tertiary hover:text-error">
              Remover capa
            </button>
          )}
        </div>
      </div>
      <button
        onClick={onToggleActive}
        className="flex-shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-extrabold"
        style={{
          background: active ? 'rgba(74,222,128,.1)' : 'rgba(168,168,176,.08)',
          borderColor: active ? 'rgba(74,222,128,.35)' : 'rgba(168,168,176,.3)',
          color: active ? '#4ade80' : '#a8a8b0',
        }}
      >
        {active ? 'Ativa' : 'Inativa'}
      </button>
      <button onClick={onRemove} className="flex-shrink-0 text-fg-faded hover:text-error">
        ✕
      </button>
    </div>
  );
}
