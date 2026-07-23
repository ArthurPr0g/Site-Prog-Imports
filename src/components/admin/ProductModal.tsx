'use client';

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { saveProductAction, uploadProductImageAction, removeProductImageAction, type ProductFormInput } from '@/app/actions/admin';
import { CATEGORY_OPTIONS } from '@/lib/constants';
import { useToast } from '@/components/ui/Toast';

export type ProductImageData = { id: string; url: string | null; label: string };

export type ProductModalData = {
  id?: string;
  name: string;
  sku: string;
  brand: string;
  category: string;
  collection: string;
  price: string;
  promoPrice: string;
  stock: string;
  description: string;
  images?: ProductImageData[];
};

const inputClass =
  'rounded-control border border-border-strong bg-input px-4 py-3 text-[13.5px] outline-none focus:border-accent';

const MAX_IMAGES = 8;
const MAX_IMAGE_MB = 5;

export function ProductModal({
  open,
  onClose,
  initial,
  collections,
}: {
  open: boolean;
  onClose: () => void;
  initial: ProductModalData | null;
  collections: string[];
}) {
  const [form, setForm] = useState<ProductModalData>(
    initial ?? {
      name: '',
      sku: '',
      brand: '',
      category: CATEGORY_OPTIONS[0],
      collection: '',
      price: '',
      promoPrice: '',
      stock: '',
      description: '',
    }
  );
  const [images, setImages] = useState<ProductImageData[]>(initial?.images ?? []);
  const [pending, startTransition] = useTransition();
  const [uploading, startUpload] = useTransition();
  const [error, setError] = useState('');
  const [imageError, setImageError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  if (!open) return null;

  const set = (key: keyof ProductModalData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  function save() {
    setError('');
    if (!form.name.trim()) return setError('Informe o nome do produto.');
    if (!form.sku.trim()) return setError('Informe o SKU do produto.');

    const price = parseFloat(form.price.replace(',', '.'));
    if (!Number.isFinite(price) || price <= 0) return setError('Informe um preço válido, maior que zero.');

    const promoPrice = form.promoPrice.trim() ? parseFloat(form.promoPrice.replace(',', '.')) : null;
    if (promoPrice !== null && (!Number.isFinite(promoPrice) || promoPrice <= 0)) {
      return setError('O preço promocional precisa ser um número válido.');
    }

    const stock = parseInt(form.stock, 10);
    if (form.stock.trim() && !Number.isFinite(stock)) return setError('Informe um estoque válido.');

    const input: ProductFormInput = {
      id: form.id,
      name: form.name.trim(),
      sku: form.sku.trim(),
      brand: form.brand.trim(),
      category: form.category,
      collection: form.collection,
      price,
      promoPrice,
      stock: Number.isFinite(stock) ? stock : 0,
      description: form.description.trim(),
    };
    const wasNew = !form.id;
    startTransition(async () => {
      const result = await saveProductAction(input);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast(result.message);
      if (wasNew && result.id) {
        setForm((f) => ({ ...f, id: result.id }));
        return;
      }
      onClose();
    });
  }

  function handlePickFiles() {
    if (!form.id) {
      setImageError('Salve o produto antes de anexar fotos.');
      return;
    }
    fileInputRef.current?.click();
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0 || !form.id) return;

    setImageError('');
    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      setImageError(`Cada produto pode ter no máximo ${MAX_IMAGES} imagens.`);
      return;
    }
    const toUpload = files.slice(0, room);
    if (files.length > room) {
      setImageError(`Só cabiam mais ${room} imagem(ns) — o restante foi ignorado.`);
    }

    const productId = form.id;
    startUpload(async () => {
      for (const file of toUpload) {
        if (!file.type.startsWith('image/')) {
          setImageError('Um dos arquivos não é uma imagem válida.');
          continue;
        }
        if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
          setImageError(`"${file.name}" excede ${MAX_IMAGE_MB}MB e não foi enviada.`);
          continue;
        }
        const fd = new FormData();
        fd.set('file', file);
        const result = await uploadProductImageAction(productId, fd);
        if (!result.ok) {
          setImageError(result.message);
          continue;
        }
        if (result.image) {
          setImages((imgs) => [...imgs, result.image!]);
        }
      }
    });
  }

  function handleRemoveImage(imageId: string) {
    setImageError('');
    startUpload(async () => {
      const result = await removeProductImageAction(imageId);
      if (!result.ok) {
        setImageError(result.message);
        return;
      }
      setImages((imgs) => imgs.filter((img) => img.id !== imageId));
    });
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-99 bg-black/65 backdrop-blur-sm" />
      <div className="fixed left-1/2 top-1/2 z-100 max-h-[88vh] w-[min(620px,94vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[22px] border border-border-strong bg-card p-8 shadow-[0_40px_100px_rgba(0,0,0,.7)]">
        <div className="mb-6 flex items-center justify-between">
          <div className="font-display text-xl font-bold">{form.id ? 'Editar produto' : 'Novo produto'}</div>
          <button onClick={onClose} className="grid h-8.5 w-8.5 place-items-center rounded-full border border-border-strong text-fg-secondary hover:border-accent hover:text-accent">
            ✕
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input value={form.name} onChange={set('name')} placeholder="Nome do produto" className={`sm:col-span-2 ${inputClass}`} />
          <input value={form.sku} onChange={set('sku')} placeholder="SKU" className={inputClass} />
          <input value={form.brand} onChange={set('brand')} placeholder="Marca" className={inputClass} />
          <select value={form.category} onChange={set('category')} className={inputClass}>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={form.collection} onChange={set('collection')} className={inputClass}>
            <option value="">Sem coleção</option>
            {collections.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input value={form.price} onChange={set('price')} placeholder="Preço (R$)" className={inputClass} />
          <input value={form.promoPrice} onChange={set('promoPrice')} placeholder="Preço promocional (opcional)" className={inputClass} />
          <input value={form.stock} onChange={set('stock')} placeholder="Estoque" className={inputClass} />
          <textarea
            value={form.description}
            onChange={set('description')}
            placeholder="Descrição do produto…"
            rows={3}
            className={`resize-y sm:col-span-2 ${inputClass}`}
          />

          <div className="sm:col-span-2">
            {images.length > 0 && (
              <div className="mb-3 grid grid-cols-4 gap-2.5">
                {images.map((img) => (
                  <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl border border-border-strong">
                    {img.url && <Image src={img.url} alt={img.label} fill className="object-cover" sizes="120px" />}
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(img.id)}
                      disabled={uploading}
                      aria-label="Remover imagem"
                      className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-error disabled:opacity-50"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handleFilesSelected} />
            <button
              type="button"
              onClick={handlePickFiles}
              disabled={uploading || images.length >= MAX_IMAGES}
              className="w-full rounded-2xl border border-dashed border-border-hover p-5.5 text-center text-[13px] text-fg-tertiary transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {!form.id
                ? 'Salve o produto antes de anexar fotos'
                : uploading
                  ? 'Enviando…'
                  : images.length >= MAX_IMAGES
                    ? `Limite de ${MAX_IMAGES} imagens atingido`
                    : `Clique para enviar fotos (${images.length}/${MAX_IMAGES})`}
            </button>
            {imageError && <div className="mt-2 text-[13px] font-semibold text-error">{imageError}</div>}
          </div>
        </div>
        {error && <div className="mt-3 text-[13px] font-semibold text-error">{error}</div>}
        <div className="mt-6 flex justify-end gap-2.5">
          <button onClick={onClose} className="rounded-control border border-border-strong px-5.5 py-3 text-[13.5px] font-bold text-fg-secondary">
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={pending}
            className="rounded-control bg-accent px-6.5 py-3 text-[13.5px] font-extrabold text-page disabled:opacity-60"
          >
            {pending ? 'Salvando…' : 'Salvar produto'}
          </button>
        </div>
      </div>
    </>
  );
}
