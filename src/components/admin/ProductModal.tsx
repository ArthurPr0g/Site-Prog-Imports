'use client';

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import {
  saveProductAction,
  uploadProductImageAction,
  removeProductImageAction,
  saveProductVariantAction,
  deleteProductVariantAction,
  type ProductFormInput,
} from '@/app/actions/admin';
import { CATEGORY_OPTIONS } from '@/lib/constants';
import {
  CPU_SUGGESTIONS,
  RAM_OPTIONS,
  STORAGE_OPTIONS,
  SCREEN_TYPE_OPTIONS,
  CONDITION_OPTIONS,
  COLOR_SUGGESTIONS,
  specFieldsForCategory,
} from '@/lib/product-specs';
import { useToast } from '@/components/ui/Toast';

export type ProductImageData = { id: string; url: string | null; label: string };

export type ProductVariantData = {
  id?: string;
  gpu: string;
  cpu: string;
  ram: string;
  storage: string;
  screenType: string;
  price: string;
  promoPrice: string;
  stock: string;
};

export type ProductModalData = {
  id?: string;
  name: string;
  sku?: string;
  brand: string;
  category: string;
  collections: string[];
  price: string;
  promoPrice: string;
  stock: string;
  description: string;
  images?: ProductImageData[];
  rating?: string;
  reviewCount?: string;
  highlights?: string[];
  gpu?: string;
  cpu?: string;
  ram?: string;
  storage?: string;
  screenType?: string;
  color?: string;
  condition?: string;
  variants?: ProductVariantData[];
};

const inputClass =
  'rounded-control border border-border-strong bg-input px-4 py-3 text-[13.5px] outline-none focus:border-accent';

const MAX_IMAGES = 8;
const MAX_IMAGE_MB = 5;
const MAX_HIGHLIGHTS = 8;
const DEFAULT_HIGHLIGHTS = [
  'Modelo exclusivo do mercado americano — não vendido no Brasil',
  'Garantia de 12 meses + suporte pós-venda Prog Imports',
  'Rastreamento completo da importação, etapa por etapa',
  'Frete grátis — envio segurado para todo o Brasil',
];

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
      brand: '',
      category: CATEGORY_OPTIONS[0],
      collections: [],
      price: '',
      promoPrice: '',
      stock: '',
      description: '',
      rating: '4.9',
      reviewCount: '0',
      gpu: '',
      cpu: '',
      ram: '',
      storage: '',
      screenType: '',
      color: '',
      condition: CONDITION_OPTIONS[0],
    }
  );
  const [images, setImages] = useState<ProductImageData[]>(initial?.images ?? []);
  const [highlights, setHighlights] = useState<string[]>(initial?.highlights ?? DEFAULT_HIGHLIGHTS);
  const [variants, setVariants] = useState<ProductVariantData[]>(initial?.variants ?? []);
  const [variantErrors, setVariantErrors] = useState<Record<number, string>>({});
  const [savingVariant, startSavingVariant] = useTransition();
  const [pending, startTransition] = useTransition();
  const [uploading, startUpload] = useTransition();
  const [error, setError] = useState('');
  const [imageError, setImageError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  if (!open) return null;

  const set = (key: keyof ProductModalData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const visibleSpecFields = specFieldsForCategory(form.category);

  function toggleCollection(name: string) {
    setForm((f) => ({
      ...f,
      collections: f.collections.includes(name) ? f.collections.filter((c) => c !== name) : [...f.collections, name],
    }));
  }

  function updateHighlight(i: number, value: string) {
    setHighlights((hs) => hs.map((h, idx) => (idx === i ? value : h)));
  }
  function removeHighlight(i: number) {
    setHighlights((hs) => hs.filter((_, idx) => idx !== i));
  }
  function addHighlight() {
    setHighlights((hs) => (hs.length >= MAX_HIGHLIGHTS ? hs : [...hs, '']));
  }

  function addVariant() {
    setVariants((vs) => [
      ...vs,
      {
        gpu: form.gpu ?? '',
        cpu: form.cpu ?? '',
        ram: form.ram ?? '',
        storage: form.storage ?? '',
        screenType: form.screenType ?? '',
        price: form.price,
        promoPrice: form.promoPrice,
        stock: form.stock,
      },
    ]);
  }

  function updateVariant(i: number, patch: Partial<ProductVariantData>) {
    setVariants((vs) => vs.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }

  function removeVariant(i: number) {
    const variant = variants[i];
    setVariantErrors((errs) => {
      const next = { ...errs };
      delete next[i];
      return next;
    });
    if (!variant.id) {
      setVariants((vs) => vs.filter((_, idx) => idx !== i));
      return;
    }
    startSavingVariant(async () => {
      const result = await deleteProductVariantAction(variant.id!);
      if (!result.ok) {
        setVariantErrors((errs) => ({ ...errs, [i]: result.message }));
        return;
      }
      setVariants((vs) => vs.filter((_, idx) => idx !== i));
    });
  }

  function saveVariant(i: number) {
    if (!form.id) return;
    const variant = variants[i];
    setVariantErrors((errs) => {
      const next = { ...errs };
      delete next[i];
      return next;
    });

    const price = parseFloat(variant.price.replace(',', '.'));
    if (!Number.isFinite(price) || price <= 0) {
      setVariantErrors((errs) => ({ ...errs, [i]: 'Informe um preço válido para essa variação.' }));
      return;
    }
    const promoPrice = variant.promoPrice.trim() ? parseFloat(variant.promoPrice.replace(',', '.')) : null;
    if (promoPrice !== null && (!Number.isFinite(promoPrice) || promoPrice <= 0)) {
      setVariantErrors((errs) => ({ ...errs, [i]: 'Preço promocional inválido.' }));
      return;
    }
    const stock = variant.stock.trim() ? parseInt(variant.stock, 10) : 0;
    if (!Number.isFinite(stock) || stock < 0) {
      setVariantErrors((errs) => ({ ...errs, [i]: 'Informe um estoque válido.' }));
      return;
    }

    startSavingVariant(async () => {
      const result = await saveProductVariantAction({
        id: variant.id,
        productId: form.id!,
        gpu: variant.gpu.trim(),
        cpu: variant.cpu.trim(),
        ram: variant.ram,
        storage: variant.storage,
        screenType: variant.screenType,
        price,
        promoPrice,
        stock,
      });
      if (!result.ok) {
        setVariantErrors((errs) => ({ ...errs, [i]: result.message }));
        return;
      }
      if (result.variant) updateVariant(i, { id: result.variant.id });
      toast(result.message);
    });
  }

  function save() {
    setError('');
    if (!form.name.trim()) return setError('Informe o nome do produto.');

    const price = parseFloat(form.price.replace(',', '.'));
    if (!Number.isFinite(price) || price <= 0) return setError('Informe um preço válido, maior que zero.');

    const promoPrice = form.promoPrice.trim() ? parseFloat(form.promoPrice.replace(',', '.')) : null;
    if (promoPrice !== null && (!Number.isFinite(promoPrice) || promoPrice <= 0)) {
      return setError('O preço promocional precisa ser um número válido.');
    }

    const stock = parseInt(form.stock, 10);
    if (form.stock.trim() && !Number.isFinite(stock)) return setError('Informe um estoque válido.');

    const rating = parseFloat((form.rating ?? '').replace(',', '.'));
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
      return setError('A avaliação precisa ser um número entre 0 e 5.');
    }

    const reviewCount = parseInt(form.reviewCount ?? '', 10);
    if (!Number.isFinite(reviewCount) || reviewCount < 0) {
      return setError('Informe um número de avaliações válido (0 ou mais).');
    }

    const input: ProductFormInput = {
      id: form.id,
      name: form.name.trim(),
      brand: form.brand.trim(),
      category: form.category,
      collections: form.collections,
      price,
      promoPrice,
      stock: Number.isFinite(stock) ? stock : 0,
      description: form.description.trim(),
      rating,
      reviewCount,
      highlights,
      gpu: visibleSpecFields.includes('gpu') ? (form.gpu ?? '').trim() : '',
      cpu: visibleSpecFields.includes('cpu') ? (form.cpu ?? '').trim() : '',
      ram: visibleSpecFields.includes('ram') ? form.ram ?? '' : '',
      storage: visibleSpecFields.includes('storage') ? form.storage ?? '' : '',
      screenType: visibleSpecFields.includes('screenType') ? form.screenType ?? '' : '',
      color: visibleSpecFields.includes('color') ? (form.color ?? '').trim() : '',
      condition: form.condition ?? CONDITION_OPTIONS[0],
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
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <div className="font-display text-xl font-bold">{form.id ? 'Editar produto' : 'Novo produto'}</div>
            {form.sku && (
              <div className="mt-0.5 font-mono text-[11px] text-fg-faded">SKU {form.sku} (gerado automaticamente)</div>
            )}
          </div>
          <button onClick={onClose} className="grid h-8.5 w-8.5 flex-shrink-0 place-items-center rounded-full border border-border-strong text-fg-secondary hover:border-accent hover:text-accent">
            ✕
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input value={form.name} onChange={set('name')} placeholder="Nome do produto" className={`sm:col-span-2 ${inputClass}`} />
          <input value={form.brand} onChange={set('brand')} placeholder="Marca" className={inputClass} />
          <select value={form.category} onChange={set('category')} className={inputClass}>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input value={form.price} onChange={set('price')} placeholder="Preço (R$)" className={inputClass} />
          <input value={form.promoPrice} onChange={set('promoPrice')} placeholder="Preço promocional (opcional)" className={inputClass} />
          <input value={form.stock} onChange={set('stock')} placeholder="Estoque" className={inputClass} />
          <input value={form.rating ?? ''} onChange={set('rating')} placeholder="Avaliação (0 a 5, ex: 4.9)" className={inputClass} />
          <input value={form.reviewCount ?? ''} onChange={set('reviewCount')} placeholder="Nº de avaliações" className={inputClass} />

          <div className="sm:col-span-2">
            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
              Coleções (pode selecionar mais de uma)
            </div>
            {collections.length === 0 ? (
              <div className="text-[13px] text-fg-tertiary">Nenhuma coleção cadastrada ainda — crie em Catálogo.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {collections.map((c) => {
                  const checked = form.collections.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCollection(c)}
                      className="rounded-full border px-3.5 py-2 text-[12.5px] font-bold transition-all"
                      style={{
                        background: checked ? '#F28705' : '#151518',
                        color: checked ? '#0a0a0c' : '#a8a8b0',
                        borderColor: checked ? '#F28705' : '#26262b',
                      }}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="sm:col-span-2">
            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
              Especificações técnicas (opcional — variam conforme a categoria escolhida acima)
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {visibleSpecFields.includes('gpu') && (
                <input
                  value={form.gpu ?? ''}
                  onChange={set('gpu')}
                  placeholder="Placa de vídeo (ex: RTX 4060)"
                  className={inputClass}
                />
              )}
              {visibleSpecFields.includes('cpu') && (
                <>
                  <input
                    list="cpu-suggestions"
                    value={form.cpu ?? ''}
                    onChange={set('cpu')}
                    placeholder="Processador (ex: Intel Core i7 (13ª Geração))"
                    className={inputClass}
                  />
                  <datalist id="cpu-suggestions">
                    {CPU_SUGGESTIONS.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </>
              )}
              {visibleSpecFields.includes('ram') && (
                <select value={form.ram ?? ''} onChange={set('ram')} className={inputClass}>
                  <option value="">Memória RAM (não informado)</option>
                  {RAM_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              )}
              {visibleSpecFields.includes('storage') && (
                <select value={form.storage ?? ''} onChange={set('storage')} className={inputClass}>
                  <option value="">Armazenamento (não informado)</option>
                  {STORAGE_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}
              {visibleSpecFields.includes('screenType') && (
                <select value={form.screenType ?? ''} onChange={set('screenType')} className={inputClass}>
                  <option value="">Tipo de tela (não informado)</option>
                  {SCREEN_TYPE_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}
              {visibleSpecFields.includes('color') && (
                <>
                  <input
                    list="color-suggestions"
                    value={form.color ?? ''}
                    onChange={set('color')}
                    placeholder="Cor"
                    className={inputClass}
                  />
                  <datalist id="color-suggestions">
                    {COLOR_SUGGESTIONS.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </>
              )}
              <select value={form.condition ?? CONDITION_OPTIONS[0]} onChange={set('condition')} className={inputClass}>
                {CONDITION_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <textarea
            value={form.description}
            onChange={set('description')}
            placeholder="Descrição do produto…"
            rows={6}
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

          <div className="sm:col-span-2">
            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
              Variações de configuração (opcional — cada uma com preço e estoque próprios)
            </div>
            {!form.id ? (
              <div className="text-[13px] text-fg-tertiary">Salve o produto antes de adicionar variações.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {variants.map((v, i) => (
                  <div key={v.id ?? `new-${i}`} className="rounded-2xl border border-border-strong p-4">
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      <input
                        value={v.gpu}
                        onChange={(e) => updateVariant(i, { gpu: e.target.value })}
                        placeholder="Placa de vídeo"
                        className={inputClass}
                      />
                      <input
                        list="cpu-suggestions"
                        value={v.cpu}
                        onChange={(e) => updateVariant(i, { cpu: e.target.value })}
                        placeholder="Processador"
                        className={inputClass}
                      />
                      <select value={v.ram} onChange={(e) => updateVariant(i, { ram: e.target.value })} className={inputClass}>
                        <option value="">Memória RAM</option>
                        {RAM_OPTIONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      <select value={v.storage} onChange={(e) => updateVariant(i, { storage: e.target.value })} className={inputClass}>
                        <option value="">Armazenamento</option>
                        {STORAGE_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <select value={v.screenType} onChange={(e) => updateVariant(i, { screenType: e.target.value })} className={inputClass}>
                        <option value="">Tipo de tela</option>
                        {SCREEN_TYPE_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <input
                        value={v.stock}
                        onChange={(e) => updateVariant(i, { stock: e.target.value })}
                        placeholder="Estoque"
                        className={inputClass}
                      />
                      <input
                        value={v.price}
                        onChange={(e) => updateVariant(i, { price: e.target.value })}
                        placeholder="Preço (R$)"
                        className={inputClass}
                      />
                      <input
                        value={v.promoPrice}
                        onChange={(e) => updateVariant(i, { promoPrice: e.target.value })}
                        placeholder="Preço promocional (opcional)"
                        className={`sm:col-span-2 ${inputClass}`}
                      />
                    </div>
                    {variantErrors[i] && <div className="mt-2 text-[12.5px] font-semibold text-error">{variantErrors[i]}</div>}
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => removeVariant(i)}
                        disabled={savingVariant}
                        className="rounded-control border border-border-strong px-4 py-2 text-[12.5px] font-bold text-fg-tertiary hover:border-error hover:text-error disabled:opacity-60"
                      >
                        Remover
                      </button>
                      <button
                        type="button"
                        onClick={() => saveVariant(i)}
                        disabled={savingVariant}
                        className="rounded-control bg-accent px-4 py-2 text-[12.5px] font-extrabold text-page disabled:opacity-60"
                      >
                        {v.id ? 'Salvar variação' : 'Criar variação'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {form.id && (
              <button
                type="button"
                onClick={addVariant}
                className="mt-2 rounded-control border border-dashed border-border-hover px-4 py-2.5 text-[13px] font-bold text-fg-tertiary transition-colors hover:border-accent hover:text-accent"
              >
                + Adicionar variação
              </button>
            )}
          </div>

          <div className="sm:col-span-2">
            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
              Destaques (lista de benefícios exibida na página do produto)
            </div>
            <div className="flex flex-col gap-2">
              {highlights.map((h, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={h}
                    onChange={(e) => updateHighlight(i, e.target.value)}
                    placeholder="Ex: Garantia de 12 meses + suporte pós-venda"
                    className={`flex-1 ${inputClass}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeHighlight(i)}
                    className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-control border border-border-strong text-fg-tertiary hover:border-error hover:text-error"
                    aria-label="Remover destaque"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addHighlight}
              disabled={highlights.length >= MAX_HIGHLIGHTS}
              className="mt-2 rounded-control border border-dashed border-border-hover px-4 py-2.5 text-[13px] font-bold text-fg-tertiary transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              + Adicionar linha
            </button>
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
