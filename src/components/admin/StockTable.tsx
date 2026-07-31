'use client';

import { useState, useMemo, useTransition } from 'react';
import { Pencil, Trash2, PackagePlus } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { formatBRL } from '@/lib/format';
import { saveStockItemAction, deleteStockItemAction, type StockFormInput } from '@/app/actions/stock';
import {
  STOCK_STATUSES,
  STOCK_ORIGINS,
  computeIndicators,
  type StockItem,
  type StockStatus,
} from '@/lib/stock';

const inputClass =
  'rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13.5px] outline-none focus:border-accent';

// Cada status tem uma leitura: verde = pronto para vender, amarelo = tem dono,
// azul = a caminho, cinza = saiu do estoque.
const STATUS_COR: Record<StockStatus, string> = {
  'Disponível': '#4ade80',
  Reservado: '#d9a441',
  'Em Transporte': '#60a5fa',
  Vendido: '#a8a8b0',
};

const VAZIO: StockFormInput = {
  status: 'Disponível',
  productId: null,
  reservedCustomerId: null,
  name: '',
  category: '',
  specs: '',
  productLink: '',
  purchaseDate: '',
  entryDate: new Date().toISOString().slice(0, 10),
  usdRate: null,
  paidAmount: 0,
  saleAmount: 0,
  notes: '',
};

function paraFormulario(i: StockItem): StockFormInput {
  return {
    id: i.id,
    status: i.status,
    productId: i.productId,
    reservedCustomerId: i.reservedCustomerId,
    name: i.name,
    category: i.category,
    specs: i.specs,
    productLink: i.productLink,
    purchaseDate: i.purchaseDate,
    entryDate: i.entryDate,
    usdRate: i.usdRate,
    paidAmount: i.paidAmount,
    saleAmount: i.saleAmount,
    notes: i.notes,
  };
}

/** Aceita "5,42" e "5.42" — o operador digita como está acostumado. */
function paraNumero(valor: string): number {
  const n = Number(valor.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function StockTable({
  items,
  customers,
  products,
  usdRate,
}: {
  items: StockItem[];
  customers: { id: string; name: string }[];
  products: { id: string; name: string; category: string }[];
  usdRate: number | null;
}) {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroOrigem, setFiltroOrigem] = useState('');
  const [form, setForm] = useState<StockFormInput | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const indicadores = useMemo(() => computeIndicators(items), [items]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return items.filter((i) => {
      if (filtroStatus && i.status !== filtroStatus) return false;
      if (filtroOrigem && i.origin !== filtroOrigem) return false;
      if (termo && ![i.name, i.category].some((v) => v.toLowerCase().includes(termo))) return false;
      return true;
    });
  }, [items, busca, filtroStatus, filtroOrigem]);

  const temFiltro = !!(busca || filtroStatus || filtroOrigem);

  function salvar() {
    if (!form) return;
    startTransition(async () => {
      const result = await saveStockItemAction(form);
      toast(result.message);
      if (result.ok) setForm(null);
    });
  }

  function excluir(i: StockItem) {
    if (!window.confirm(`Excluir "${i.name}" do estoque? Esta ação não pode ser desfeita.`)) return;
    startTransition(async () => {
      const result = await deleteStockItemAction(i.id);
      toast(result.message);
    });
  }

  const set = <K extends keyof StockFormInput>(campo: K, valor: StockFormInput[K]) =>
    setForm((f) => (f ? { ...f, [campo]: valor } : f));

  // Escolher um produto do catálogo copia o que já está cadastrado, evitando
  // redigitar nome e categoria — e é o que liga o item ao selo de pronta
  // entrega na loja.
  function escolherProduto(id: string) {
    const p = products.find((x) => x.id === id);
    setForm((f) =>
      f ? { ...f, productId: id || null, name: p?.name ?? f.name, category: p?.category ?? f.category } : f
    );
  }

  const lucroPrevisto = form ? form.saleAmount - form.paidAmount : 0;

  return (
    <div>
      <div className="mb-3.5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { rotulo: 'Valor total do estoque', valor: formatBRL(indicadores.totalSaleValue) },
          { rotulo: 'Valor de custo total', valor: formatBRL(indicadores.totalCostValue) },
          { rotulo: 'Itens vendidos', valor: String(indicadores.soldCount) },
          { rotulo: 'Em transporte', valor: String(indicadores.inTransitCount) },
        ].map((c) => (
          <div key={c.rotulo} className="rounded-[18px] border border-border bg-card px-5 py-4">
            <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">{c.rotulo}</div>
            <div className="text-[22px] font-extrabold">{c.valor}</div>
          </div>
        ))}
      </div>

      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por produto ou categoria…"
          className={`min-w-[240px] flex-1 ${inputClass}`}
        />
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className={inputClass}>
          <option value="">Todos os status</option>
          {STOCK_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={filtroOrigem} onChange={(e) => setFiltroOrigem(e.target.value)} className={inputClass}>
          <option value="">Todas as origens</option>
          {STOCK_ORIGINS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        {temFiltro && (
          <button
            onClick={() => { setBusca(''); setFiltroStatus(''); setFiltroOrigem(''); }}
            className="text-[13px] font-bold text-fg-tertiary hover:text-accent"
          >
            Limpar
          </button>
        )}
        <button
          onClick={() => setForm({ ...VAZIO, usdRate: usdRate })}
          className="flex items-center gap-2 rounded-control bg-accent px-5 py-2.5 text-[13.5px] font-extrabold text-page transition-all hover:-translate-y-0.5"
        >
          <PackagePlus size={16} />
          Adicionar ao estoque
        </button>
      </div>

      <div className="overflow-x-auto rounded-[18px] border border-border bg-card p-6">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[1.8fr_100px_120px_1.1fr_110px_110px_110px_90px] gap-3 border-b border-border pb-2.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
            <div>Produto</div>
            <div>Origem</div>
            <div>Status</div>
            <div>Reservado para</div>
            <div className="text-right">Pago</div>
            <div className="text-right">Venda</div>
            <div className="text-right">Lucro</div>
            <div className="text-right">Ações</div>
          </div>

          {visiveis.length === 0 && (
            <div className="py-6 text-sm text-fg-tertiary">
              {items.length === 0
                ? 'Nenhum item no estoque ainda. Use "Adicionar ao estoque" para cadastrar o primeiro.'
                : 'Nenhum item encontrado com esses filtros.'}
            </div>
          )}

          {visiveis.map((i) => (
            <div
              key={i.id}
              className="grid grid-cols-[1.8fr_100px_120px_1.1fr_110px_110px_110px_90px] items-center gap-3 border-b border-divider py-3 text-[13.5px] last:border-b-0"
            >
              <div className="min-w-0">
                <div className="truncate font-bold">{i.name}</div>
                {i.category && <div className="truncate text-[12px] text-fg-tertiary">{i.category}</div>}
              </div>
              <div className="text-[12px] text-fg-secondary">{i.origin}</div>
              <div>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-extrabold"
                  style={{ background: `${STATUS_COR[i.status]}1a`, color: STATUS_COR[i.status] }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COR[i.status] }} />
                  {i.status}
                </span>
              </div>
              <div className="truncate text-[13px] text-fg-secondary">{i.reservedCustomerName || '—'}</div>
              <div className="text-right text-[13px] text-fg-secondary">{formatBRL(i.paidAmount)}</div>
              <div className="text-right text-[13px] font-bold">{formatBRL(i.saleAmount)}</div>
              <div
                className="text-right text-[13px] font-extrabold"
                style={{ color: i.expectedProfit >= 0 ? '#4ade80' : '#e05555' }}
              >
                {formatBRL(i.expectedProfit)}
              </div>
              <div className="flex justify-end gap-1.5">
                <button
                  onClick={() => setForm(paraFormulario(i))}
                  disabled={pending}
                  title="Editar"
                  aria-label={`Editar ${i.name}`}
                  className="grid h-8 w-8 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => excluir(i)}
                  disabled={pending}
                  title="Excluir"
                  aria-label={`Excluir ${i.name}`}
                  className="grid h-8 w-8 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-error hover:text-error disabled:opacity-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-[820px] overflow-y-auto rounded-[20px] border border-border-strong bg-card p-7">
            <div className="mb-5 text-[15px] font-extrabold">
              {form.id ? 'Editar item de estoque' : 'Adicionar ao estoque'}
            </div>

            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Produto</div>
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select
                value={form.productId ?? ''}
                onChange={(e) => escolherProduto(e.target.value)}
                className={`sm:col-span-2 ${inputClass}`}
              >
                <option value="">Sem vínculo com o catálogo do site</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Nome do produto *" className={`sm:col-span-2 ${inputClass}`} />
              <input value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="Categoria" className={inputClass} />
              <input value={form.productLink} onChange={(e) => set('productLink', e.target.value)} placeholder="Link do produto" className={inputClass} />
              <textarea value={form.specs} onChange={(e) => set('specs', e.target.value)} rows={2} placeholder="Especificações" className={`resize-y sm:col-span-2 ${inputClass}`} />
            </div>

            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Estoque</div>
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select value={form.status} onChange={(e) => set('status', e.target.value as StockStatus)} className={inputClass}>
                {STOCK_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={form.reservedCustomerId ?? ''}
                onChange={(e) => set('reservedCustomerId', e.target.value || null)}
                className={inputClass}
              >
                <option value="">Sem cliente reservado</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div>
                <div className="mb-1.5 text-[11px] text-fg-faded">Data de entrada</div>
                <input type="date" value={form.entryDate} onChange={(e) => set('entryDate', e.target.value)} className={`w-full ${inputClass}`} />
              </div>
              <div>
                <div className="mb-1.5 text-[11px] text-fg-faded">Data da compra</div>
                <input type="date" value={form.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} className={`w-full ${inputClass}`} />
              </div>
              <div className="sm:col-span-2">
                <div className="mb-1.5 text-[11px] text-fg-faded">Cotação utilizada</div>
                <input
                  value={form.usdRate ?? ''}
                  onChange={(e) => set('usdRate', e.target.value ? paraNumero(e.target.value) : null)}
                  inputMode="decimal"
                  placeholder="Ex: 5,42"
                  className={`w-full ${inputClass}`}
                />
              </div>
            </div>

            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Financeiro</div>
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <div className="mb-1.5 text-[11px] text-fg-faded">Valor pago (R$)</div>
                <input
                  defaultValue={form.paidAmount || ''}
                  onChange={(e) => set('paidAmount', paraNumero(e.target.value))}
                  inputMode="decimal"
                  placeholder="0,00"
                  className={`w-full ${inputClass}`}
                />
              </div>
              <div>
                <div className="mb-1.5 text-[11px] text-fg-faded">Valor de venda (R$)</div>
                <input
                  defaultValue={form.saleAmount || ''}
                  onChange={(e) => set('saleAmount', paraNumero(e.target.value))}
                  inputMode="decimal"
                  placeholder="0,00"
                  className={`w-full ${inputClass}`}
                />
              </div>
              <div>
                <div className="mb-1.5 text-[11px] text-fg-faded">Lucro esperado</div>
                <div
                  className="rounded-control border border-border bg-input-alt px-3.5 py-2.5 text-[13.5px] font-extrabold"
                  style={{ color: lucroPrevisto >= 0 ? '#4ade80' : '#e05555' }}
                >
                  {formatBRL(lucroPrevisto)}
                </div>
              </div>
              <textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                rows={2}
                placeholder="Observações"
                className={`resize-y sm:col-span-3 ${inputClass}`}
              />
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
