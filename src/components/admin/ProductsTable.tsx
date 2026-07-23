'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { GripVertical } from 'lucide-react';
import { formatBRL } from '@/lib/format';
import { toggleProductActiveAction, deleteProductAction, reorderProductsAction } from '@/app/actions/admin';
import { ProductModal, type ProductModalData } from './ProductModal';
import { ProductImportButton } from './ProductImportButton';
import { useToast } from '@/components/ui/Toast';
import { useDragReorder } from '@/lib/useDragReorder';

type Row = {
  id: string;
  name: string;
  sku: string;
  category: string;
  brand: string;
  collections: string[];
  price: number;
  stock: number;
  active: boolean;
  description: string;
  imageUrl: string | null;
  images: { id: string; url: string | null; label: string }[];
  rating: number;
  reviewCount: number;
  highlights: string[];
};

export function ProductsTable({ products: productsProp, collections }: { products: Row[]; collections: string[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductModalData | null>(null);
  const [, startTransition] = useTransition();
  const toast = useToast();

  const { items: products, rowRef, handlePointerDown } = useDragReorder(productsProp, (orderedIds) => {
    startTransition(async () => {
      const result = await reorderProductsAction(orderedIds);
      if (!result.ok) toast(result.message);
    });
  });

  function toggleActive(p: Row) {
    startTransition(async () => {
      const result = await toggleProductActiveAction(p.id, p.active);
      if (!result.ok) toast(result.message);
    });
  }

  function removeProduct(p: Row) {
    if (!window.confirm(`Excluir "${p.name}"? Essa ação não pode ser desfeita.`)) return;
    startTransition(async () => {
      const result = await deleteProductAction(p.id);
      if (!result.ok) toast(result.message);
    });
  }

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
      collections: p.collections,
      price: String(p.price),
      promoPrice: '',
      stock: String(p.stock),
      description: p.description,
      images: p.images,
      rating: String(p.rating),
      reviewCount: String(p.reviewCount),
      highlights: p.highlights,
    });
    setModalOpen(true);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <ProductImportButton />
        <button
          onClick={openNew}
          className="rounded-control bg-accent px-5 py-2.75 text-[13.5px] font-extrabold text-page transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(242,135,5,.35)]"
        >
          + Novo produto
        </button>
      </div>
      <div className="overflow-x-auto rounded-[18px] border border-border bg-card p-6">
        <div className="min-w-[970px]">
          <div className="grid grid-cols-[22px_52px_1.8fr_110px_1fr_.8fr_110px_80px_90px_130px] gap-3 border-b border-border pb-2.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
            <div />
            <div>Foto</div>
            <div>Produto</div>
            <div>SKU</div>
            <div>Categoria</div>
            <div>Marca</div>
            <div>Preço</div>
            <div>Estoque</div>
            <div>Status</div>
            <div>Ações</div>
          </div>
          {products.map((p, index) => {
            const stockColor = p.stock <= 3 ? '#e05555' : p.stock <= 6 ? '#d9a441' : '#4ade80';
            return (
              <div
                key={p.id}
                ref={rowRef(index)}
                className="grid grid-cols-[22px_52px_1.8fr_110px_1fr_.8fr_110px_80px_90px_130px] items-center gap-3 border-b border-divider py-3 text-[13.5px] last:border-b-0"
                style={{ opacity: p.active ? 1 : 0.45 }}
              >
                <span
                  onPointerDown={handlePointerDown(index)}
                  className="cursor-grab text-fg-faded active:cursor-grabbing"
                  style={{ touchAction: 'none' }}
                  title="Arrastar para reordenar"
                >
                  <GripVertical size={15} />
                </span>
                <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-[10px] border border-border bg-input-alt">
                  {p.imageUrl ? (
                    <Image src={p.imageUrl} alt={p.name} width={44} height={44} draggable={false} className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-mono text-[9px] text-fg-faded">s/ foto</span>
                  )}
                </div>
                <div className="font-bold">{p.name}</div>
                <div className="font-mono text-xs text-fg-tertiary">{p.sku}</div>
                <div className="text-[13px] text-fg-secondary">{p.category}</div>
                <div className="text-[13px] text-fg-secondary">{p.brand}</div>
                <div className="font-bold">{formatBRL(p.price)}</div>
                <div className="font-extrabold" style={{ color: stockColor }}>{p.stock}</div>
                <div>
                  <button
                    onClick={() => toggleActive(p)}
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
                    onClick={() => removeProduct(p)}
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
