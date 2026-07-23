'use client';

import { useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import { Plus } from 'lucide-react';
import { addProductsToCollectionAction, removeProductFromCollectionAction } from '@/app/actions/admin';
import { useToast } from '@/components/ui/Toast';

export type CollectionProductRow = {
  id: string;
  name: string;
  sku: string;
  imageUrl: string | null;
  collectionNames: string[];
};

function ProductThumb({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  return (
    <div className="grid h-8 w-8 flex-shrink-0 place-items-center overflow-hidden rounded-[7px] border border-border-strong bg-input-alt">
      {imageUrl ? (
        <Image src={imageUrl} alt={name} width={32} height={32} className="h-full w-full object-cover" />
      ) : (
        <span className="font-mono text-[7px] text-fg-faded">s/ foto</span>
      )}
    </div>
  );
}

export function CollectionProductsPanel({
  collectionId,
  collectionName,
  allProducts,
}: {
  collectionId: string;
  collectionName: string;
  allProducts: CollectionProductRow[];
}) {
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const inCollection = useMemo(() => allProducts.filter((p) => p.collectionNames.includes(collectionName)), [allProducts, collectionName]);

  const candidates = useMemo(() => {
    const notInCollection = allProducts.filter((p) => !p.collectionNames.includes(collectionName));
    const q = query.trim().toLowerCase();
    if (!q) return notInCollection;
    return notInCollection.filter((p) => (p.name + ' ' + p.sku).toLowerCase().includes(q));
  }, [allProducts, collectionName, query]);

  function openAdd() {
    setSelected([]);
    setQuery('');
    setAdding(true);
  }

  function toggleSelected(productId: string) {
    setSelected((cur) => (cur.includes(productId) ? cur.filter((id) => id !== productId) : [...cur, productId]));
  }

  function save() {
    if (selected.length === 0) {
      setAdding(false);
      return;
    }
    startTransition(async () => {
      const result = await addProductsToCollectionAction(selected, collectionId);
      if (!result.ok) {
        toast(result.message);
        return;
      }
      setAdding(false);
      setSelected([]);
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
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
          Produtos nessa coleção ({inCollection.length})
        </div>
        {!adding && (
          <button
            onClick={openAdd}
            className="flex flex-shrink-0 items-center gap-1 rounded-full border border-border-hover px-3 py-1.5 text-[11px] font-extrabold text-fg-secondary hover:border-accent hover:text-accent"
          >
            <Plus size={13} /> Adicionar produtos
          </button>
        )}
      </div>

      {inCollection.length === 0 && <div className="text-[13px] text-fg-tertiary">Nenhum produto vinculado ainda.</div>}
      <div className="flex flex-col gap-1.5">
        {inCollection.map((p) => (
          <div key={p.id} className="flex items-center gap-2.5 rounded-[10px] border border-divider px-3 py-2 text-[13px]">
            <ProductThumb imageUrl={p.imageUrl} name={p.name} />
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

      {adding && (
        <div className="mt-4 border-t border-divider pt-4">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
            Selecionar produtos para adicionar a &ldquo;{collectionName}&rdquo;
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou SKU…"
            className="mb-2.5 w-full rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13px] outline-none focus:border-accent"
          />
          <div className="max-h-64 overflow-y-auto rounded-[10px] border border-border-strong">
            {candidates.length === 0 && (
              <div className="p-3 text-[12.5px] text-fg-tertiary">
                {query.trim() ? 'Nenhum produto encontrado.' : 'Todos os produtos já estão nessa coleção.'}
              </div>
            )}
            {candidates.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-2.5 border-b border-divider px-3 py-2 text-[13px] last:border-b-0 hover:bg-input-alt"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={() => toggleSelected(p.id)}
                  className="h-4 w-4 flex-shrink-0 accent-accent"
                />
                <ProductThumb imageUrl={p.imageUrl} name={p.name} />
                <span className="min-w-0 flex-1 truncate font-bold">{p.name}</span>
                <span className="flex-shrink-0 font-mono text-[11px] text-fg-faded">{p.sku}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setAdding(false)}
              disabled={pending}
              className="rounded-control border border-border-hover px-4 py-2 text-[13px] font-bold disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={pending || selected.length === 0}
              className="rounded-control bg-accent px-4 py-2 text-[13px] font-extrabold text-page disabled:opacity-60"
            >
              {pending ? 'Salvando…' : `Salvar (${selected.length})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
