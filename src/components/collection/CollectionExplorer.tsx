'use client';

import { useMemo, useState } from 'react';
import { ProductCardTile } from '@/components/home/ProductCardTile';
import { formatBRL } from '@/lib/format';
import {
  CPU_SUGGESTIONS,
  RAM_OPTIONS,
  STORAGE_OPTIONS,
  SCREEN_TYPE_OPTIONS,
  CONDITION_OPTIONS,
  sortByCanonicalOrder,
} from '@/lib/product-specs';
import type { ProductCard } from '@/lib/data/catalog';

type SortOption = 'relevancia' | 'menor-preco' | 'maior-preco' | 'nome-az';

const SORT_LABELS: Record<SortOption, string> = {
  relevancia: 'Relevância',
  'menor-preco': 'Menor preço',
  'maior-preco': 'Maior preço',
  'nome-az': 'Nome (A-Z)',
};

export function CollectionExplorer({ products }: { products: ProductCard[] }) {
  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(), [products]);
  const brands = useMemo(() => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort(), [products]);
  const gpus = useMemo(
    () => [...new Set(products.map((p) => p.gpu).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [products]
  );
  const cpus = useMemo(
    () => sortByCanonicalOrder([...new Set(products.map((p) => p.cpu).filter(Boolean))], CPU_SUGGESTIONS),
    [products]
  );
  const rams = useMemo(
    () => sortByCanonicalOrder([...new Set(products.map((p) => p.ram).filter(Boolean))], RAM_OPTIONS),
    [products]
  );
  const storages = useMemo(
    () => sortByCanonicalOrder([...new Set(products.map((p) => p.storage).filter(Boolean))], STORAGE_OPTIONS),
    [products]
  );
  const screenTypes = useMemo(
    () => sortByCanonicalOrder([...new Set(products.map((p) => p.screenType).filter(Boolean))], SCREEN_TYPE_OPTIONS),
    [products]
  );
  const colors = useMemo(() => [...new Set(products.map((p) => p.color).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [products]);
  const conditions = useMemo(
    () => sortByCanonicalOrder([...new Set(products.map((p) => p.condition).filter(Boolean))], CONDITION_OPTIONS),
    [products]
  );
  const priceBounds = useMemo(() => {
    const prices = products.map((p) => p.promoPrice ?? p.price);
    return { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 };
  }, [products]);

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedGpus, setSelectedGpus] = useState<string[]>([]);
  const [selectedCpus, setSelectedCpus] = useState<string[]>([]);
  const [selectedRams, setSelectedRams] = useState<string[]>([]);
  const [selectedStorages, setSelectedStorages] = useState<string[]>([]);
  const [selectedScreenTypes, setSelectedScreenTypes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [cpuSearch, setCpuSearch] = useState('');
  const [onlyPromo, setOnlyPromo] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState<SortOption>('relevancia');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const visibleCpus = useMemo(() => {
    const q = cpuSearch.trim().toLowerCase();
    if (!q) return cpus;
    return cpus.filter((c) => c.toLowerCase().includes(q));
  }, [cpus, cpuSearch]);

  function toggleFrom(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function clearFilters() {
    setSelectedCategories([]);
    setSelectedBrands([]);
    setSelectedGpus([]);
    setSelectedCpus([]);
    setSelectedRams([]);
    setSelectedStorages([]);
    setSelectedScreenTypes([]);
    setSelectedColors([]);
    setSelectedConditions([]);
    setCpuSearch('');
    setOnlyPromo(false);
    setMinPrice('');
    setMaxPrice('');
    setSort('relevancia');
  }

  const hasActiveFilters =
    selectedCategories.length > 0 ||
    selectedBrands.length > 0 ||
    selectedGpus.length > 0 ||
    selectedCpus.length > 0 ||
    selectedRams.length > 0 ||
    selectedStorages.length > 0 ||
    selectedScreenTypes.length > 0 ||
    selectedColors.length > 0 ||
    selectedConditions.length > 0 ||
    onlyPromo ||
    minPrice.trim() !== '' ||
    maxPrice.trim() !== '';

  const filtered = useMemo(() => {
    const min = minPrice.trim() ? parseFloat(minPrice.replace(',', '.')) : null;
    const max = maxPrice.trim() ? parseFloat(maxPrice.replace(',', '.')) : null;

    let list = products.filter((p) => {
      const activePrice = p.promoPrice ?? p.price;
      if (selectedCategories.length && !selectedCategories.includes(p.category)) return false;
      if (selectedBrands.length && !selectedBrands.includes(p.brand)) return false;
      if (selectedGpus.length && !selectedGpus.includes(p.gpu)) return false;
      if (selectedCpus.length && !selectedCpus.includes(p.cpu)) return false;
      if (selectedRams.length && !selectedRams.includes(p.ram)) return false;
      if (selectedStorages.length && !selectedStorages.includes(p.storage)) return false;
      if (selectedScreenTypes.length && !selectedScreenTypes.includes(p.screenType)) return false;
      if (selectedColors.length && !selectedColors.includes(p.color)) return false;
      if (selectedConditions.length && !selectedConditions.includes(p.condition)) return false;
      if (onlyPromo && !p.promoPrice) return false;
      if (min !== null && Number.isFinite(min) && activePrice < min) return false;
      if (max !== null && Number.isFinite(max) && activePrice > max) return false;
      return true;
    });

    list = [...list];
    if (sort === 'menor-preco') list.sort((a, b) => (a.promoPrice ?? a.price) - (b.promoPrice ?? b.price));
    else if (sort === 'maior-preco') list.sort((a, b) => (b.promoPrice ?? b.price) - (a.promoPrice ?? a.price));
    else if (sort === 'nome-az') list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    return list;
  }, [
    products,
    selectedCategories,
    selectedBrands,
    selectedGpus,
    selectedCpus,
    selectedRams,
    selectedStorages,
    selectedScreenTypes,
    selectedColors,
    selectedConditions,
    onlyPromo,
    minPrice,
    maxPrice,
    sort,
  ]);

  return (
    <div className="mx-auto max-w-[1280px] px-6 pb-20 pt-8">
      <div className="mb-5 flex items-center justify-between gap-3 md:hidden">
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className="rounded-full border border-border-hover px-4.5 py-2.5 text-[13px] font-bold text-fg-secondary transition-all hover:border-accent hover:text-accent"
        >
          {filtersOpen ? '✕ Fechar filtros' : '⚙ Filtros'}
        </button>
        <span className="text-[13px] text-fg-tertiary">{filtered.length} produtos</span>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[240px_1fr]">
        <aside className={`${filtersOpen ? 'block' : 'hidden'} md:block`}>
          <div className="rounded-[18px] border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[13px] font-extrabold">Filtros</div>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-xs font-bold text-accent hover:underline">
                  Limpar
                </button>
              )}
            </div>

            {categories.length > 0 && (
              <div className="mb-5">
                <div className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Categoria</div>
                <div className="flex flex-col gap-2">
                  {categories.map((c) => (
                    <label key={c} className="flex cursor-pointer items-center gap-2 text-[13px] text-fg-secondary">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(c)}
                        onChange={() => toggleFrom(selectedCategories, setSelectedCategories, c)}
                        className="h-4 w-4 accent-accent"
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {brands.length > 0 && (
              <div className="mb-5">
                <div className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Marca</div>
                <div className="flex flex-col gap-2">
                  {brands.map((b) => (
                    <label key={b} className="flex cursor-pointer items-center gap-2 text-[13px] text-fg-secondary">
                      <input
                        type="checkbox"
                        checked={selectedBrands.includes(b)}
                        onChange={() => toggleFrom(selectedBrands, setSelectedBrands, b)}
                        className="h-4 w-4 accent-accent"
                      />
                      {b}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {gpus.length > 0 && (
              <div className="mb-5">
                <div className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Placa de vídeo</div>
                <div className="flex max-h-44 flex-col gap-2 overflow-y-auto pr-1">
                  {gpus.map((g) => (
                    <label key={g} className="flex cursor-pointer items-center gap-2 text-[13px] text-fg-secondary">
                      <input
                        type="checkbox"
                        checked={selectedGpus.includes(g)}
                        onChange={() => toggleFrom(selectedGpus, setSelectedGpus, g)}
                        className="h-4 w-4 accent-accent"
                      />
                      {g}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {cpus.length > 0 && (
              <div className="mb-5">
                <div className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Processador</div>
                {cpus.length > 6 && (
                  <input
                    value={cpuSearch}
                    onChange={(e) => setCpuSearch(e.target.value)}
                    placeholder="Buscar processador…"
                    className="mb-2.5 w-full rounded-control border border-border-strong bg-input px-3 py-2 text-[12.5px] outline-none focus:border-accent"
                  />
                )}
                <div className="flex max-h-44 flex-col gap-2 overflow-y-auto pr-1">
                  {visibleCpus.length === 0 ? (
                    <div className="text-[12.5px] text-fg-faded">Nenhum processador encontrado.</div>
                  ) : (
                    visibleCpus.map((c) => (
                      <label key={c} className="flex cursor-pointer items-center gap-2 text-[13px] text-fg-secondary">
                        <input
                          type="checkbox"
                          checked={selectedCpus.includes(c)}
                          onChange={() => toggleFrom(selectedCpus, setSelectedCpus, c)}
                          className="h-4 w-4 accent-accent"
                        />
                        {c}
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            {rams.length > 0 && (
              <div className="mb-5">
                <div className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Memória RAM</div>
                <div className="flex flex-col gap-2">
                  {rams.map((r) => (
                    <label key={r} className="flex cursor-pointer items-center gap-2 text-[13px] text-fg-secondary">
                      <input
                        type="checkbox"
                        checked={selectedRams.includes(r)}
                        onChange={() => toggleFrom(selectedRams, setSelectedRams, r)}
                        className="h-4 w-4 accent-accent"
                      />
                      {r}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {storages.length > 0 && (
              <div className="mb-5">
                <div className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Armazenamento</div>
                <div className="flex flex-col gap-2">
                  {storages.map((s) => (
                    <label key={s} className="flex cursor-pointer items-center gap-2 text-[13px] text-fg-secondary">
                      <input
                        type="checkbox"
                        checked={selectedStorages.includes(s)}
                        onChange={() => toggleFrom(selectedStorages, setSelectedStorages, s)}
                        className="h-4 w-4 accent-accent"
                      />
                      {s}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {screenTypes.length > 0 && (
              <div className="mb-5">
                <div className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Tipo de tela</div>
                <div className="flex flex-col gap-2">
                  {screenTypes.map((s) => (
                    <label key={s} className="flex cursor-pointer items-center gap-2 text-[13px] text-fg-secondary">
                      <input
                        type="checkbox"
                        checked={selectedScreenTypes.includes(s)}
                        onChange={() => toggleFrom(selectedScreenTypes, setSelectedScreenTypes, s)}
                        className="h-4 w-4 accent-accent"
                      />
                      {s}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {colors.length > 0 && (
              <div className="mb-5">
                <div className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Cor</div>
                <div className="flex flex-col gap-2">
                  {colors.map((c) => (
                    <label key={c} className="flex cursor-pointer items-center gap-2 text-[13px] text-fg-secondary">
                      <input
                        type="checkbox"
                        checked={selectedColors.includes(c)}
                        onChange={() => toggleFrom(selectedColors, setSelectedColors, c)}
                        className="h-4 w-4 accent-accent"
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {conditions.length > 0 && (
              <div className="mb-5">
                <div className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Estado</div>
                <div className="flex flex-col gap-2">
                  {conditions.map((c) => (
                    <label key={c} className="flex cursor-pointer items-center gap-2 text-[13px] text-fg-secondary">
                      <input
                        type="checkbox"
                        checked={selectedConditions.includes(c)}
                        onChange={() => toggleFrom(selectedConditions, setSelectedConditions, c)}
                        className="h-4 w-4 accent-accent"
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-5">
              <div className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
                Preço {priceBounds.max > 0 && `(${formatBRL(priceBounds.min)} – ${formatBRL(priceBounds.max)})`}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="Mín"
                  inputMode="decimal"
                  className="w-full min-w-0 rounded-control border border-border-strong bg-input px-3 py-2 text-[12.5px] outline-none focus:border-accent"
                />
                <span className="text-fg-faded">–</span>
                <input
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Máx"
                  inputMode="decimal"
                  className="w-full min-w-0 rounded-control border border-border-strong bg-input px-3 py-2 text-[12.5px] outline-none focus:border-accent"
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-fg-secondary">
              <input type="checkbox" checked={onlyPromo} onChange={(e) => setOnlyPromo(e.target.checked)} className="h-4 w-4 accent-accent" />
              Somente promoções
            </label>
          </div>
        </aside>

        <div>
          <div className="mb-5 hidden items-center justify-between md:flex">
            <span className="text-[13px] text-fg-tertiary">{filtered.length} produtos</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13px] outline-none focus:border-accent"
            >
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-5 md:hidden">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="w-full rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13px] outline-none focus:border-accent"
            >
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  Ordenar: {label}
                </option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-[18px] border border-border bg-card p-10 text-center text-[14px] text-fg-tertiary">
              Nenhum produto encontrado com esses filtros.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] sm:gap-4.5">
              {filtered.map((p) => (
                <ProductCardTile key={p.id} p={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
