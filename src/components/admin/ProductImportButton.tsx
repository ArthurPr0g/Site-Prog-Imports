'use client';

import { useRef, useState, useTransition } from 'react';
import { importProductsFromSpreadsheetAction, type ImportRowResult } from '@/app/actions/admin';
import { useToast } from '@/components/ui/Toast';

export function ProductImportButton() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [results, setResults] = useState<ImportRowResult[] | null>(null);
  const toast = useToast();

  function handlePick() {
    fileInputRef.current?.click();
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setResults(null);
    const fd = new FormData();
    fd.set('file', file);
    startTransition(async () => {
      const result = await importProductsFromSpreadsheetAction(fd);
      if (!result.ok) {
        toast(result.message);
        return;
      }
      toast(result.message);
      setResults(result.results ?? null);
    });
  }

  const errors = results?.filter((r) => !r.ok) ?? [];

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <a
          href="/admin/produtos/modelo"
          className="rounded-control border border-border-strong px-4.5 py-2.75 text-[13px] font-bold text-fg-secondary transition-all hover:border-accent hover:text-accent"
        >
          Baixar modelo (.xlsx)
        </a>
        <button
          type="button"
          onClick={handlePick}
          disabled={pending}
          className="rounded-control border border-border-strong px-4.5 py-2.75 text-[13px] font-bold text-fg-secondary transition-all hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Importando…' : 'Importar planilha'}
        </button>
        <input ref={fileInputRef} type="file" accept=".xlsx" hidden onChange={handleFileSelected} />
      </div>
      {errors.length > 0 && (
        <div className="w-full max-w-[420px] rounded-2xl border border-error/35 bg-error/8 p-4 text-[12.5px]">
          <div className="mb-2 font-extrabold text-error">
            {errors.length} linha{errors.length > 1 ? 's' : ''} com problema:
          </div>
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto text-fg-secondary">
            {errors.map((r) => (
              <div key={r.row}>
                <span className="font-bold">Linha {r.row}</span> ({r.name}): {r.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
