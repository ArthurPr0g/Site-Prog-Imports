'use client';

import { useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import { addProductToCollectionAction, removeProductFromCollectionAction } from '@/app/actions/admin';
import { useToast } from '@/components/ui/Toast';

export type CollectionProductRow = {
  id: string;
  name: string;
  sku: string;
  imageUrl: string | null;
  collectionNames: string[];
};

export function CollectionProductsPanel({
  collectionId,
  collectionName,
  allProducts,
}: {
  collectionId: string;
  collectionName: string;
  allProducts: CollectionProductRow[];
}) {
  const [query, setQuery] = useState('');
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const inCollection = useMemo(() => allProducts.filter((p) => p.collectionNames.includes(collectionName)), [allProducts, collectionName]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allProducts
      .filter((p) => !p.collectionNames.includes(collectionName))
      .filter((p) => (p.name + ' ' + p.sku).toLowerCase().includes(q))
      .slice(0, 8);
  }, [allProducts, collectionName, query]);

  function add(productId: string) {
    startTransition(async () => {
      const result = await addProductToCollectionAction(productId, collectionId);
      if (!result.ok) toast(result.message);
      else setQuery('');
    });
  }

  function remove(productId: string) {
    startTransition(async () => {
      const result = await removeProductFromCollectionAction(productId, collectionId);
      if (!result.ok) toast(result.message);
    });
  }

  return (
    <div className="mt-3 rounded-[14px] border border-border-strong bg-page p-4.5">
      <div className="mb-3.5">
        <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
          Adicionar produto a &ldquo;{collectionName}&rdquo;
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome ou SKU…"
          className="w-full rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13px] outline-none focus:border-accent"
        />
        {query.trim() && (
          <div className="mt-2 flex flex-col gap-1.5">
            {searchResults.length === 0 && <div className="text-[12.5px] text-fg-tertiary">Nenhum produto encontrado.</div>}
            {searchResults.map((p) => (
              <button
                key={p.id}
                disabled={pending}
                onClick={() => add(p.id)}
                className="flex items-center gap-2.5 rounded-[10px] border border-border-hover px-3 py-2 text-left text-[13px] hover:border-accent disabled:opacity-60"
              >
                <div className="grid h-8 w-8 flex-shrink-0 place-items-center overflow-hidden rounded-[7px] border border-border-strong bg-input-alt">
                  {p.imageUrl ? (
                    <Image src={p.imageUrl} alt={p.name} width={32} height={32} className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-mono text-[7px] text-fg-faded">s/ foto</span>
                  )}
                </div>
                <span className="min-w-0 flex-1 truncate font-bold">{p.name}</span>
                <span className="flex-shrink-0 font-mono text-[11px] text-fg-faded">{p.sku}</span>
                <span className="flex-shrink-0 text-accent">+ adicionar</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
        Produtos nessa coleção ({inCollection.length})
      </div>
      {inCollection.length === 0 && <div className="mt-2 text-[13px] text-fg-tertiary">Nenhum produto vinculado ainda.</div>}
      <div className="mt-2 flex flex-col gap-1.5">
        {inCollection.map((p) => (
          <div key={p.id} className="flex items-center gap-2.5 rounded-[10px] border border-divider px-3 py-2 text-[13px]">
            <div className="grid h-8 w-8 flex-shrink-0 place-items-center overflow-hidden rounded-[7px] border border-border-strong bg-input-alt">
              {p.imageUrl ? (
                <Image src={p.imageUrl} alt={p.name} width={32} height={32} className="h-full w-full object-cover" />
              ) : (
                <span className="font-mono text-[7px] text-fg-faded">s/ foto</span>
              )}
            </div>
            <span className="min-w-0 flex-1 truncate font-bold">{p.name}</span>
            <span className="flex-shrink-0 font-mono text-[11px] text-fg-faded">{p.sku}</span>
            <button
              disabled={pending}
              onClick={() => remove(p.id)}
              className="flex-shrink-0 text-fg-faded hover:text-error disabled:opacity-60"
              title="Remover da coleção"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
