'use client';

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import {
  addCatalogItemAction,
  deleteCatalogItemAction,
  uploadCollectionImageAction,
  removeCollectionImageAction,
} from '@/app/actions/admin';
import { useToast } from '@/components/ui/Toast';

type Collection = { id: string; name: string; image_url: string | null };

export function CollectionsGroup({ collections }: { collections: Collection[] }) {
  const [draft, setDraft] = useState('');
  const [, startTransition] = useTransition();
  const toast = useToast();

  function add() {
    if (!draft.trim()) return;
    startTransition(async () => {
      const result = await addCatalogItemAction('collections', draft);
      if (!result.ok) {
        toast(result.message);
        return;
      }
      setDraft('');
    });
  }

  function remove(c: Collection) {
    if (!window.confirm(`Excluir a coleção "${c.name}"?`)) return;
    startTransition(async () => {
      const result = await deleteCatalogItemAction('collections', c.id);
      if (!result.ok) toast(result.message);
    });
  }

  return (
    <div className="rounded-[18px] border border-border bg-card p-6">
      <div className="mb-4 text-[15px] font-extrabold">Coleções</div>
      <div className="mb-3.5 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Nova coleção…"
          className="min-w-0 flex-1 rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13px] outline-none focus:border-accent"
        />
        <button onClick={add} className="rounded-control bg-accent px-4 py-2.5 text-[13px] font-extrabold text-page">
          +
        </button>
      </div>
      {collections.length === 0 && <div className="text-[13px] text-fg-tertiary">Nenhuma coleção ainda.</div>}
      <div className="flex flex-col gap-3">
        {collections.map((c) => (
          <CollectionRow key={c.id} collection={c} onRemove={() => remove(c)} />
        ))}
      </div>
    </div>
  );
}

function CollectionRow({ collection, onRemove }: { collection: Collection; onRemove: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

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
      const result = await uploadCollectionImageAction(collection.id, formData);
      if (!result.ok) toast(result.message);
    });
  }

  function removeCover() {
    startTransition(async () => {
      const result = await removeCollectionImageAction(collection.id);
      if (!result.ok) toast(result.message);
    });
  }

  return (
    <div className="flex items-center gap-3 border-b border-divider pb-3 last:border-b-0">
      <button
        onClick={pickFile}
        disabled={pending}
        title="Trocar capa"
        className="stripe-placeholder relative grid h-14 w-14 flex-shrink-0 place-items-center overflow-hidden rounded-[12px] border border-border-strong hover:border-accent disabled:opacity-60"
      >
        {collection.image_url ? (
          <Image src={collection.image_url} alt={collection.name} fill sizes="56px" className="object-cover" />
        ) : (
          <span className="font-mono text-[9px] text-fg-faded">capa</span>
        )}
      </button>
      <input ref={inputRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-bold">{collection.name}</div>
        <div className="flex gap-3 text-xs">
          <button onClick={pickFile} disabled={pending} className="text-fg-tertiary hover:text-accent">
            {pending ? 'Enviando…' : collection.image_url ? 'Trocar capa' : 'Adicionar capa'}
          </button>
          {collection.image_url && (
            <button onClick={removeCover} disabled={pending} className="text-fg-tertiary hover:text-error">
              Remover capa
            </button>
          )}
        </div>
      </div>
      <button onClick={onRemove} className="flex-shrink-0 text-fg-faded hover:text-error">
        ✕
      </button>
    </div>
  );
}
