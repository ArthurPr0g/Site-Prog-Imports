'use client';

import { useState, useTransition } from 'react';
import { formatBRL } from '@/lib/format';
import { toggleProductActiveAction, deleteProductAction } from '@/app/actions/admin';
import { ProductModal, type ProductModalData } from './ProductModal';

type Row = {
  id: string;
  name: string;
  sku: string;
  category: string;
  brand: string;
  collection: string;
  price: number;
  stock: number;
  active: boolean;
  description: string;
};

export function ProductsTable({ products, collections }: { products: Row[]; collections: string[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductModalData | null>(null);
  const [, startTransition] = useTransition();

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(p: Row) {
    setEditing({
      id: p.id,
      name: p.name,
      sku: p.sku,
      brand: p.brand,
      category: p.category,
      collection: p.collection,
      price: String(p.price),
      promoPrice: '',
      stock: String(p.stock),
      description: p.description,
    });
    setModalOpen(true);
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={openNew}
          className="rounded-control bg-accent px-5 py-2.75 text-[13.5px] font-extrabold text-page transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(242,135,5,.35)]"
        >
          + Novo produto
        </button>
      </div>
      <div className="overflow-x-auto rounded-[18px] border border-border bg-card p-6">
        <div className="min-w-[940px]">
          <div className="grid grid-cols-[1.8fr_110px_1fr_.8fr_110px_80px_90px_130px] gap-3 border-b border-border pb-2.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
            <div>Produto</div>
            <div>SKU</div>
            <div>Categoria</div>
            <div>Marca</div>
            <div>Preço</div>
            <div>Estoque</div>
            <div>Status</div>
            <div>Ações</div>
          </div>
          {products.map((p) => {
            const stockColor = p.stock <= 3 ? '#e05555' : p.stock <= 6 ? '#d9a441' : '#4ade80';
            return (
              <div
                key={p.id}
                className="grid grid-cols-[1.8fr_110px_1fr_.8fr_110px_80px_90px_130px] items-center gap-3 border-b border-divider py-3 text-[13.5px] last:border-b-0"
                style={{ opacity: p.active ? 1 : 0.45 }}
              >
                <div className="font-bold">{p.name}</div>
                <div className="font-mono text-xs text-fg-tertiary">{p.sku}</div>
                <div className="text-[13px] text-fg-secondary">{p.category}</div>
                <div className="text-[13px] text-fg-secondary">{p.brand}</div>
                <div className="font-bold">{formatBRL(p.price)}</div>
                <div className="font-extrabold" style={{ color: stockColor }}>{p.stock}</div>
                <div>
                  <button
                    onClick={() => startTransition(() => toggleProductActiveAction(p.id, p.active))}
                    className="rounded-full border px-2.75 py-1.25 text-[11px] font-extrabold"
                    style={{
                      background: p.active ? 'rgba(74,222,128,.1)' : 'rgba(168,168,176,.08)',
                      borderColor: p.active ? 'rgba(74,222,128,.35)' : 'rgba(168,168,176,.3)',
                      color: p.active ? '#4ade80' : '#a8a8b0',
                    }}
                  >
                    {p.active ? 'Ativo' : 'Inativo'}
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => openEdit(p)}
                    className="rounded-[9px] border border-border-hover px-3 py-1.5 text-xs font-bold hover:border-accent"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => startTransition(() => deleteProductAction(p.id))}
                    className="rounded-[9px] border border-border-hover px-2.5 py-1.5 text-xs text-fg-tertiary hover:border-error hover:text-error"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <ProductModal
        key={editing?.id ?? 'new'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={editing}
        collections={collections}
      />
    </div>
  );
}
