'use client';

import { useState, useMemo, useTransition } from 'react';
import { Pencil, Trash2, Plus, Search } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { formatBRL, parseNumeroBR, formatNumeroInput } from '@/lib/format';
import { formatPrazo, type InternalService } from '@/lib/services';
import { saveInternalServiceAction, deleteInternalServiceAction, type InternalServiceInput } from '@/app/actions/internal-services';

const inputClass =
  'rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13.5px] outline-none focus:border-accent';

const COLUNAS = 'grid grid-cols-[1.8fr_1fr_120px_110px_90px_70px] gap-2';

function formVazio(): InternalServiceInput {
  return { name: '', description: '', category: '', price: 0, leadTimeDays: 0, active: true };
}

export function InternalServicesTable({ services }: { services: InternalService[] }) {
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState<InternalServiceInput | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return services;
    return services.filter((s) =>
      [s.name, s.description, s.category].some((campo) => campo.toLowerCase().includes(termo))
    );
  }, [services, busca]);

  const ativos = services.filter((s) => s.active).length;

  function salvar() {
    if (!form) return;
    startTransition(async () => {
      const result = await saveInternalServiceAction(form);
      toast(result);
      if (result.ok) setForm(null);
    });
  }

  function excluir(s: InternalService) {
    if (!window.confirm(`Excluir o serviço "${s.name}"?`)) return;
    startTransition(async () => {
      toast(await deleteInternalServiceAction(s.id));
    });
  }

  const set = <K extends keyof InternalServiceInput>(campo: K, valor: InternalServiceInput[K]) =>
    setForm((f) => (f ? { ...f, [campo]: valor } : f));

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-faded" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, descrição ou categoria"
            className={`w-full pl-10 ${inputClass}`}
          />
        </div>
        <div className="text-[12.5px] text-fg-tertiary">
          {services.length} cadastrado(s) · <strong className="text-fg-secondary">{ativos} ativo(s)</strong>
        </div>
        <button
          onClick={() => setForm(formVazio())}
          className="flex items-center gap-1.5 rounded-control bg-accent px-5 py-2.5 text-[13.5px] font-extrabold text-page transition-all hover:-translate-y-0.5"
        >
          <Plus size={15} /> Novo serviço
        </button>
      </div>

      <div className="rounded-[18px] border border-border bg-card p-6">
        <div className={`${COLUNAS} border-b border-border pb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded`}>
          <div>Serviço</div>
          <div>Categoria</div>
          <div className="text-right">Valor</div>
          <div>Prazo</div>
          <div>Situação</div>
          <div className="text-right">Ações</div>
        </div>

        {filtrados.length === 0 && (
          <div className="py-5 text-[13px] text-fg-tertiary">
            {services.length === 0
              ? 'Nenhum serviço cadastrado. Estes são os serviços que a Prog presta fora da loja — sites, sistemas, design — e não aparecem no site público.'
              : 'Nada encontrado para essa busca.'}
          </div>
        )}

        {filtrados.map((s) => (
          <div
            key={s.id}
            className={`${COLUNAS} items-center border-b border-divider py-2.5 text-[13px] last:border-b-0 ${s.active ? '' : 'opacity-55'}`}
          >
            <div className="min-w-0">
              <div className="truncate font-bold">{s.name}</div>
              {s.description && <div className="truncate text-[11.5px] text-fg-tertiary">{s.description}</div>}
            </div>
            <div className="truncate text-fg-secondary">{s.category || '—'}</div>
            <div className="text-right font-bold text-accent">{formatBRL(s.price)}</div>
            <div className="text-fg-secondary">{formatPrazo(s.leadTimeDays)}</div>
            <div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                  s.active ? 'bg-accent/12 text-accent' : 'bg-fg-faded/12 text-fg-tertiary'
                }`}
              >
                {s.active ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <div className="flex justify-end gap-1.5">
              <button
                onClick={() =>
                  setForm({
                    id: s.id,
                    name: s.name,
                    description: s.description,
                    category: s.category,
                    price: s.price,
                    leadTimeDays: s.leadTimeDays,
                    active: s.active,
                  })
                }
                disabled={pending}
                title="Editar"
                aria-label={`Editar ${s.name}`}
                className="grid h-7 w-7 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-accent hover:text-accent disabled:opacity-50"
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={() => excluir(s)}
                disabled={pending}
                title="Excluir"
                aria-label={`Excluir ${s.name}`}
                className="grid h-7 w-7 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-error hover:text-error disabled:opacity-50"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-[20px] border border-border-strong bg-card p-7">
            <div className="mb-5 text-[15px] font-extrabold">
              {form.id ? 'Editar serviço' : 'Novo serviço'}
            </div>

            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Título do serviço *"
                className={`sm:col-span-2 ${inputClass}`}
              />
              <textarea
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Descrição"
                rows={3}
                className={`resize-none sm:col-span-2 ${inputClass}`}
              />
              <div>
                <div className="mb-1.5 text-[11px] text-fg-faded">Categoria</div>
                <input
                  value={form.category}
                  onChange={(e) => set('category', e.target.value)}
                  placeholder="Ex: Desenvolvimento"
                  className={`w-full ${inputClass}`}
                />
              </div>
              <div>
                <div className="mb-1.5 text-[11px] text-fg-faded">Valor (R$)</div>
                <input
                  defaultValue={formatNumeroInput(form.price)}
                  onChange={(e) => set('price', parseNumeroBR(e.target.value))}
                  inputMode="decimal"
                  placeholder="0,00"
                  className={`w-full ${inputClass}`}
                />
              </div>
              <div>
                <div className="mb-1.5 text-[11px] text-fg-faded">Prazo (dias)</div>
                <input
                  defaultValue={form.leadTimeDays || ''}
                  onChange={(e) => set('leadTimeDays', Math.round(parseNumeroBR(e.target.value)))}
                  inputMode="numeric"
                  placeholder="Ex: 20"
                  className={`w-full ${inputClass}`}
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2.5 self-end pb-2.5 text-[13.5px]">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => set('active', e.target.checked)}
                  className="h-4 w-4 accent-accent"
                />
                Ativo
                <span className="text-[11px] text-fg-faded">(aparece em novos orçamentos)</span>
              </label>
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setForm(null)}
                disabled={pending}
                className="rounded-control border border-border-strong px-5 py-2.5 text-[13.5px] font-extrabold text-fg-secondary disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={pending}
                className="rounded-control bg-accent px-6 py-2.5 text-[13.5px] font-extrabold text-page disabled:opacity-60"
              >
                {pending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
