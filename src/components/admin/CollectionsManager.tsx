'use client';

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { GripVertical, ChevronDown } from 'lucide-react';
import {
  addCatalogItemAction,
  deleteCatalogItemAction,
  reorderCatalogItemsAction,
  renameCollectionAction,
  toggleCollectionShowOnSiteAction,
  toggleCollectionShowInFeedAction,
  setCollectionSitePositionAction,
  uploadCollectionImageAction,
  removeCollectionImageAction,
} from '@/app/actions/admin';
import { useToast } from '@/components/ui/Toast';
import { useDragReorder } from '@/lib/useDragReorder';
import { CollectionProductsPanel, type CollectionProductRow } from './CollectionProductsPanel';

type Item = {
  id: string;
  name: string;
  image_url: string | null;
  show_on_site: boolean;
  show_in_feed: boolean;
  site_position: number;
};

export function CollectionsManager({ collections, products }: { collections: Item[]; products: CollectionProductRow[] }) {
  const [draft, setDraft] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const toast = useToast();

  const { items, rowRef, handlePointerDown } = useDragReorder(collections, (orderedIds) => {
    startTransition(async () => {
      const result = await reorderCatalogItemsAction('collections', orderedIds);
      if (!result.ok) toast(result.message);
    });
  });

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

  function remove(item: Item) {
    if (!window.confirm(`Excluir "${item.name}"? Os produtos vinculados não serão excluídos, só deixam de fazer parte dela.`)) return;
    startTransition(async () => {
      const result = await deleteCatalogItemAction('collections', item.id);
      if (!result.ok) toast(result.message);
    });
  }

  const productCount = (name: string) => products.filter((p) => p.collectionNames.includes(name)).length;

  return (
    <div className="rounded-[18px] border border-border bg-card p-6">
      <div className="mb-3.5 text-[12px] leading-relaxed text-fg-tertiary">
        &ldquo;Mostrar no topo&rdquo; exibe a coleção no carrossel com capa da home; &ldquo;Mostrar no feed&rdquo; cria uma seção com os
        produtos dela na home. Pode ativar as duas, só uma, ou nenhuma — sem limite de quantidade.
      </div>
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
      {items.length === 0 && <div className="text-[13px] text-fg-tertiary">Nenhuma coleção ainda.</div>}
      <div className="flex flex-col gap-3">
        {items.map((item, index) => (
          <CollectionRow
            key={item.id}
            rowRef={rowRef(index)}
            onPointerDown={handlePointerDown(index)}
            item={item}
            count={productCount(item.name)}
            expanded={expandedId === item.id}
            onToggleExpanded={() => setExpandedId((cur) => (cur === item.id ? null : item.id))}
            onRemove={() => remove(item)}
            products={products}
          />
        ))}
      </div>
    </div>
  );
}

function CollectionRow({
  item,
  count,
  expanded,
  onToggleExpanded,
  onRemove,
  products,
  rowRef,
  onPointerDown,
}: {
  item: Item;
  count: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  onRemove: () => void;
  products: CollectionProductRow[];
  rowRef: (el: HTMLElement | null) => void;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState(false);
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
      const result = await uploadCollectionImageAction(item.id, formData);
      if (!result.ok) toast(result.message);
    });
  }

  function removeCover() {
    startTransition(async () => {
      const result = await removeCollectionImageAction(item.id);
      if (!result.ok) toast(result.message);
    });
  }

  function saveRename(value: string) {
    const trimmed = value.trim();
    setRenaming(false);
    if (!trimmed || trimmed === item.name) return;
    startTransition(async () => {
      const result = await renameCollectionAction(item.id, trimmed);
      if (!result.ok) toast(result.message);
    });
  }

  function toggleShowOnSite() {
    startTransition(async () => {
      const result = await toggleCollectionShowOnSiteAction(item.id, item.show_on_site);
      if (!result.ok) toast(result.message);
    });
  }

  function toggleShowInFeed() {
    startTransition(async () => {
      const result = await toggleCollectionShowInFeedAction(item.id, item.show_in_feed);
      if (!result.ok) toast(result.message);
    });
  }

  function changePosition(position: number) {
    startTransition(async () => {
      const result = await setCollectionSitePositionAction(item.id, position);
      if (!result.ok) toast(result.message);
    });
  }

  return (
    <div ref={rowRef} className="border-b border-divider pb-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2.5">
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
          {renaming ? (
            <input
              autoFocus
              defaultValue={item.name}
              onBlur={(e) => saveRename(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') setRenaming(false);
              }}
              className="w-full rounded-[8px] border border-accent bg-input px-2 py-1 text-[13.5px] font-bold outline-none"
            />
          ) : (
            <button onClick={() => setRenaming(true)} className="truncate text-left text-[13.5px] font-bold hover:text-accent" title="Renomear">
              {item.name}
            </button>
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <button onClick={pickFile} disabled={pending} className="text-fg-tertiary hover:text-accent">
              {pending ? 'Enviando…' : item.image_url ? 'Trocar capa' : 'Adicionar capa'}
            </button>
            {item.image_url && (
              <button onClick={removeCover} disabled={pending} className="text-fg-tertiary hover:text-error">
                Remover capa
              </button>
            )}
            <button onClick={onToggleExpanded} className="flex items-center gap-1 font-bold text-fg-tertiary hover:text-accent">
              {count} produto{count === 1 ? '' : 's'}
              <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1.5">
          <input
            key={item.site_position}
            type="number"
            min={1}
            defaultValue={item.site_position || ''}
            disabled={!item.show_on_site && !item.show_in_feed}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v > 0) changePosition(v);
            }}
            title="Posição de exibição"
            className="h-8 w-13 rounded-[8px] border border-border-strong bg-input px-1.5 text-center text-[12px] outline-none focus:border-accent disabled:opacity-40"
          />
        </div>
        <button
          onClick={toggleShowOnSite}
          className="flex-shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-extrabold"
          style={{
            background: item.show_on_site ? 'rgba(74,222,128,.1)' : 'rgba(168,168,176,.08)',
            borderColor: item.show_on_site ? 'rgba(74,222,128,.35)' : 'rgba(168,168,176,.3)',
            color: item.show_on_site ? '#4ade80' : '#a8a8b0',
          }}
        >
          {item.show_on_site ? 'No topo' : 'Mostrar no topo'}
        </button>
        <button
          onClick={toggleShowInFeed}
          className="flex-shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-extrabold"
          style={{
            background: item.show_in_feed ? 'rgba(74,222,128,.1)' : 'rgba(168,168,176,.08)',
            borderColor: item.show_in_feed ? 'rgba(74,222,128,.35)' : 'rgba(168,168,176,.3)',
            color: item.show_in_feed ? '#4ade80' : '#a8a8b0',
          }}
        >
          {item.show_in_feed ? 'No feed' : 'Mostrar no feed'}
        </button>
        <button onClick={onRemove} className="flex-shrink-0 text-fg-faded hover:text-error">
          ✕
        </button>
      </div>

      {expanded && <CollectionProductsPanel collectionId={item.id} collectionName={item.name} allProducts={products} />}
    </div>
  );
}
