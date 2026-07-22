'use client';

import { useState, useTransition } from 'react';
import { addCatalogItemAction, deleteCatalogItemAction } from '@/app/actions/admin';

type Item = { id: string; name: string };
type Table = 'categories' | 'brands' | 'collections';

export function CatalogGroup({ title, table, items, placeholder }: { title: string; table: Table; items: Item[]; placeholder: string }) {
  const [draft, setDraft] = useState('');
  const [, startTransition] = useTransition();

  function add() {
    if (!draft.trim()) return;
    startTransition(async () => {
      await addCatalogItemAction(table, draft);
      setDraft('');
    });
  }

  return (
    <div className="rounded-[18px] border border-border bg-card p-6">
      <div className="mb-4 text-[15px] font-extrabold">{title}</div>
      <div className="mb-3.5 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13px] outline-none focus:border-accent"
        />
        <button onClick={add} className="rounded-control bg-accent px-4 py-2.5 text-[13px] font-extrabold text-page">
          +
        </button>
      </div>
      {items.map((it) => (
        <div key={it.id} className="flex items-center justify-between border-b border-divider py-2.25 text-[13.5px] last:border-b-0">
          <span className="font-bold">{it.name}</span>
          <button
            onClick={() => startTransition(() => deleteCatalogItemAction(table, it.id))}
            className="text-fg-faded hover:text-error"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
