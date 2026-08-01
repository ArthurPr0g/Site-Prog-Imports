'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { Pencil, Trash2, Copy, PackageCheck, FilePlus2, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { formatBRL } from '@/lib/format';
import { calculateQuote, QUOTE_STATUSES, type QuoteStatus } from '@/lib/quotes';
import {
  saveQuoteAction,
  deleteQuoteAction,
  duplicateQuoteAction,
  sendQuoteToStockAction,
  recalculateQuotesAction,
  type QuoteFormInput,
} from '@/app/actions/quotes';
import { checkUsdRateFreshnessAction } from '@/app/actions/settings';
import type { StoreQuote } from '@/lib/data/quotes';

const inputClass =
  'rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13.5px] outline-none focus:border-accent';
const readOnlyClass =
  'rounded-control border border-border bg-input-alt px-3.5 py-2.5 text-[13.5px] text-fg-tertiary';

const STATUS_COR: Record<QuoteStatus, string> = {
  'Em elaboração': '#a8a8b0',
  Enviado: '#60a5fa',
  'Aguardando Cliente': '#d9a441',
  Aprovado: '#4ade80',
  Reprovado: '#e05555',
  'Convertido em Estoque': '#60a5fa',
};

const VAZIO: QuoteFormInput = {
  customerId: null,
  productId: null,
  name: '',
  category: '',
  specs: '',
  productLink: '',
  productValueUsd: 0,
  taxUsd: 0,
  travelerFeeUsd: 0,
  grabrFeeUsd: 0,
  processingUsd: 0,
  shippingBrl: 0,
  salePriceBrl: 0,
  notes: '',
  status: 'Em elaboração',
};

function paraFormulario(q: StoreQuote): QuoteFormInput {
  return {
    id: q.id,
    customerId: q.customerId,
    productId: q.productId,
    name: q.name,
    category: q.category,
    specs: q.specs,
    productLink: q.productLink,
    productValueUsd: q.productValueUsd,
    taxUsd: q.taxUsd,
    travelerFeeUsd: q.travelerFeeUsd,
    grabrFeeUsd: q.grabrFeeUsd,
    processingUsd: q.processingUsd,
    shippingBrl: q.shippingBrl,
    salePriceBrl: q.salePriceBrl,
    notes: q.notes,
    status: q.status,
  };
}

function paraNumero(valor: string): number {
  const n = Number(valor.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

const fmtUSD = (v: number) => `US$ ${v.toFixed(2).replace('.', ',')}`;

/** Os 5 componentes digitados em dólar, na ordem em que aparecem na tabela. */
const COMPONENTES = [
  { campo: 'productValueUsd', rotulo: 'Valor do produto', chave: 'productValue' },
  { campo: 'taxUsd', rotulo: 'Imposto', chave: 'tax' },
  { campo: 'travelerFeeUsd', rotulo: 'Taxa viajante', chave: 'travelerFee' },
  { campo: 'grabrFeeUsd', rotulo: 'Taxa Grabr', chave: 'grabrFee' },
  { campo: 'processingUsd', rotulo: 'Processamento', chave: 'processing' },
] as const;

export function QuotesTable({
  quotes,
  customers,
  products,
  usdRate,
}: {
  quotes: StoreQuote[];
  customers: { id: string; name: string }[];
  products: { id: string; name: string; category: string }[];
  usdRate: number | null;
}) {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [form, setForm] = useState<QuoteFormInput | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return quotes.filter((q) => {
      if (filtroStatus && q.status !== filtroStatus) return false;
      if (termo && ![q.name, q.customerName].some((v) => v.toLowerCase().includes(termo))) return false;
      return true;
    });
  }, [quotes, busca, filtroStatus]);

  // O mesmo motor que a action usa no servidor: uma implementação só, sem risco
  // de a tela mostrar um número e o banco gravar outro.
  const totais = useMemo(
    () =>
      form
        ? calculateQuote(
            {
              productValue: form.productValueUsd,
              tax: form.taxUsd,
              travelerFee: form.travelerFeeUsd,
              grabrFee: form.grabrFeeUsd,
              processing: form.processingUsd,
              shippingBrl: form.shippingBrl,
              salePriceBrl: form.salePriceBrl,
            },
            usdRate ?? 0
          )
        : null,
    [form, usdRate]
  );

  const semCotacao = usdRate === null || usdRate <= 0;

  // Como a cotação é atualizada à mão, por decisão do dono, o sistema precisa
  // avisar quando ela envelhece — senão um orçamento sai com câmbio de semanas
  // atrás e o erro só aparece na hora de pagar o fornecedor.
  const [cotacaoVelha, setCotacaoVelha] = useState<{ suggested: number; market: number } | null>(null);
  useEffect(() => {
    let ativo = true;
    checkUsdRateFreshnessAction().then((r) => {
      if (ativo && r.ok && r.stale && r.suggested !== null && r.market !== null) {
        setCotacaoVelha({ suggested: r.suggested, market: r.market });
      }
    });
    return () => {
      ativo = false;
    };
  }, []);

  function salvar() {
    if (!form) return;
    startTransition(async () => {
      const result = await saveQuoteAction(form);
      toast(result.message);
      if (result.ok) setForm(null);
    });
  }

  function executar(acao: () => Promise<{ ok: boolean; message: string }>, confirmar?: string) {
    if (confirmar && !window.confirm(confirmar)) return;
    startTransition(async () => {
      const result = await acao();
      toast(result.message);
    });
  }

  const set = <K extends keyof QuoteFormInput>(campo: K, valor: QuoteFormInput[K]) =>
    setForm((f) => (f ? { ...f, [campo]: valor } : f));

  function escolherProduto(id: string) {
    const p = products.find((x) => x.id === id);
    setForm((f) =>
      f ? { ...f, productId: id || null, name: p?.name ?? f.name, category: p?.category ?? f.category } : f
    );
  }

  return (
    <div>
      {semCotacao && (
        <div className="mb-3.5 rounded-[18px] border border-warning/40 bg-warning/10 px-5 py-4 text-[13.5px] text-warning">
          A cotação do dólar ainda não foi configurada. Defina em <strong>Configurações</strong> antes de criar
          orçamentos — sem ela o cálculo não acontece.
        </div>
      )}

      {!semCotacao && cotacaoVelha && (
        <div className="mb-3.5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[18px] border border-warning/40 bg-warning/10 px-5 py-4 text-[13.5px] text-warning">
          <span>
            A cotação salva é <strong>R$ {(usdRate ?? 0).toFixed(2)}</strong>, mas o mercado está em{' '}
            <strong>R$ {cotacaoVelha.market.toFixed(4)}</strong> — com sua taxa, daria{' '}
            <strong>R$ {cotacaoVelha.suggested.toFixed(2)}</strong>.
          </span>
          <Link href="/admin/configuracoes" className="font-extrabold underline underline-offset-2">
            Atualizar em Configurações
          </Link>
        </div>
      )}

      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por produto ou cliente…"
          className={`min-w-[240px] flex-1 ${inputClass}`}
        />
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className={inputClass}>
          <option value="">Todos os status</option>
          {QUOTE_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {(busca || filtroStatus) && (
          <button
            onClick={() => { setBusca(''); setFiltroStatus(''); }}
            className="text-[13px] font-bold text-fg-tertiary hover:text-accent"
          >
            Limpar
          </button>
        )}
        <button
          onClick={() =>
            executar(
              recalculateQuotesAction,
              'Reaplicar a cotação atual nos orçamentos ainda não aprovados? Os aprovados ficam congelados.'
            )
          }
          disabled={pending || semCotacao}
          title="O recálculo já acontece sozinho ao salvar a cotação em Configurações"
          className="flex items-center gap-2 rounded-control border border-border-strong px-4 py-2.5 text-[13.5px] font-bold text-fg-secondary hover:border-accent hover:text-accent disabled:opacity-50"
        >
          <RefreshCw size={15} />
          Reaplicar cotação
        </button>
        <button
          onClick={() => setForm({ ...VAZIO })}
          disabled={semCotacao}
          className="flex items-center gap-2 rounded-control bg-accent px-5 py-2.5 text-[13.5px] font-extrabold text-page transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
        >
          <FilePlus2 size={16} />
          Novo orçamento
        </button>
      </div>

      <div className="overflow-x-auto rounded-[18px] border border-border bg-card p-6">
        <div className="min-w-[960px]">
          <div className="grid grid-cols-[1.7fr_1.1fr_150px_110px_110px_110px_80px_130px] gap-3 border-b border-border pb-2.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
            <div>Produto</div>
            <div>Cliente</div>
            <div>Status</div>
            <div className="text-right">Custo</div>
            <div className="text-right">Venda</div>
            <div className="text-right">Lucro</div>
            <div className="text-right">Margem</div>
            <div className="text-right">Ações</div>
          </div>

          {visiveis.length === 0 && (
            <div className="py-6 text-sm text-fg-tertiary">
              {quotes.length === 0
                ? 'Nenhum orçamento ainda. Use "Novo orçamento" para criar o primeiro.'
                : 'Nenhum orçamento encontrado com esses filtros.'}
            </div>
          )}

          {visiveis.map((q) => {
            const convertido = q.status === 'Convertido em Estoque';
            return (
              <div
                key={q.id}
                className="grid grid-cols-[1.7fr_1.1fr_150px_110px_110px_110px_80px_130px] items-center gap-3 border-b border-divider py-3 text-[13.5px] last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="truncate font-bold">{q.name}</div>
                  {q.category && <div className="truncate text-[12px] text-fg-tertiary">{q.category}</div>}
                </div>
                <div className="truncate text-[13px] text-fg-secondary">{q.customerName || '—'}</div>
                <div>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-extrabold"
                    style={{ background: `${STATUS_COR[q.status]}1a`, color: STATUS_COR[q.status] }}
                  >
                    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: STATUS_COR[q.status] }} />
                    {q.status}
                  </span>
                </div>
                <div className="text-right text-[13px] text-fg-secondary">{formatBRL(q.totalBrl)}</div>
                <div className="text-right text-[13px] font-bold">{formatBRL(q.salePriceBrl)}</div>
                <div
                  className="text-right text-[13px] font-extrabold"
                  style={{ color: q.profitBrl >= 0 ? '#4ade80' : '#e05555' }}
                >
                  {formatBRL(q.profitBrl)}
                </div>
                <div className="text-right text-[13px] text-fg-secondary">{q.marginPct.toFixed(1)}%</div>
                <div className="flex justify-end gap-1.5">
                  <button
                    onClick={() => setForm(paraFormulario(q))}
                    disabled={pending}
                    title="Editar"
                    aria-label={`Editar orçamento de ${q.name}`}
                    className="grid h-8 w-8 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-accent hover:text-accent disabled:opacity-50"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => executar(() => duplicateQuoteAction(q.id))}
                    disabled={pending}
                    title="Duplicar"
                    aria-label={`Duplicar orçamento de ${q.name}`}
                    className="grid h-8 w-8 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-accent hover:text-accent disabled:opacity-50"
                  >
                    <Copy size={14} />
                  </button>
                  {!convertido && (
                    <button
                      onClick={() =>
                        executar(
                          () => sendQuoteToStockAction(q.id),
                          `Criar um item de estoque a partir de "${q.name}"? O orçamento passa a Convertido em Estoque.`
                        )
                      }
                      disabled={pending}
                      title="Enviar para o estoque"
                      aria-label={`Enviar ${q.name} para o estoque`}
                      className="grid h-8 w-8 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-success hover:text-success disabled:opacity-50"
                    >
                      <PackageCheck size={14} />
                    </button>
                  )}
                  <button
                    onClick={() =>
                      executar(() => deleteQuoteAction(q.id), `Excluir o orçamento de "${q.name}"?`)
                    }
                    disabled={pending}
                    title="Excluir"
                    aria-label={`Excluir orçamento de ${q.name}`}
                    className="grid h-8 w-8 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-error hover:text-error disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {form && totais && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-[880px] overflow-y-auto rounded-[20px] border border-border-strong bg-card p-7">
            <div className="mb-5 text-[15px] font-extrabold">
              {form.id ? 'Editar orçamento' : 'Novo orçamento'}
            </div>

            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
              Solicitante e produto
            </div>
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select
                value={form.customerId ?? ''}
                onChange={(e) => set('customerId', e.target.value || null)}
                className={inputClass}
              >
                <option value="">Escolha o cliente *</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select value={form.productId ?? ''} onChange={(e) => escolherProduto(e.target.value)} className={inputClass}>
                <option value="">Sem produto do catálogo</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Nome do produto *" className={`sm:col-span-2 ${inputClass}`} />
              <input value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="Categoria" className={inputClass} />
              <input value={form.productLink} onChange={(e) => set('productLink', e.target.value)} placeholder="Link do produto" className={inputClass} />
              <textarea value={form.specs} onChange={(e) => set('specs', e.target.value)} rows={2} placeholder="Especificações" className={`resize-y sm:col-span-2 ${inputClass}`} />
            </div>

            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
                Valores e cálculos
              </span>
              <span className="text-[12px] text-fg-tertiary">
                Cotação oficial: <strong className="text-accent">R$ {(usdRate ?? 0).toFixed(2)}</strong>
              </span>
            </div>

            <div className="mb-5 overflow-hidden rounded-[14px] border border-border">
              <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-px bg-border text-[11px] font-extrabold uppercase tracking-[.06em] text-fg-faded">
                <div className="bg-card-dark px-3.5 py-2">Item</div>
                <div className="bg-card-dark px-3.5 py-2">US$</div>
                <div className="bg-card-dark px-3.5 py-2">R$</div>
              </div>

              {COMPONENTES.map((c) => (
                <div key={c.campo} className="grid grid-cols-[1.4fr_1fr_1fr] items-center gap-px border-t border-divider">
                  <div className="px-3.5 py-2 text-[13px] text-fg-secondary">{c.rotulo}</div>
                  <div className="p-1.5">
                    <input
                      defaultValue={form[c.campo] || ''}
                      onChange={(e) => set(c.campo, paraNumero(e.target.value))}
                      inputMode="decimal"
                      placeholder="0,00"
                      className={`w-full ${inputClass}`}
                    />
                  </div>
                  <div className="p-1.5">
                    <div className={readOnlyClass}>{formatBRL(totais.brl[c.chave])}</div>
                  </div>
                </div>
              ))}

              {/* Frete é o único de mão inversa: digitado em reais, o dólar é derivado. */}
              <div className="grid grid-cols-[1.4fr_1fr_1fr] items-center gap-px border-t border-divider">
                <div className="px-3.5 py-2 text-[13px] text-fg-secondary">
                  Frete
                  <span className="ml-1.5 text-[11px] text-fg-faded">(digite em R$)</span>
                </div>
                <div className="p-1.5">
                  <div className={readOnlyClass}>{fmtUSD(totais.usd.shipping)}</div>
                </div>
                <div className="p-1.5">
                  <input
                    defaultValue={form.shippingBrl || ''}
                    onChange={(e) => set('shippingBrl', paraNumero(e.target.value))}
                    inputMode="decimal"
                    placeholder="0,00"
                    className={`w-full ${inputClass}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-[1.4fr_1fr_1fr] items-center gap-px border-t border-border-strong bg-card-dark">
                <div className="px-3.5 py-2.5 text-[13px] font-extrabold">Total</div>
                <div className="px-3.5 py-2.5 text-[13px] font-extrabold">{fmtUSD(totais.usd.total)}</div>
                <div className="px-3.5 py-2.5 text-[13px] font-extrabold">{formatBRL(totais.brl.total)}</div>
              </div>
            </div>

            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <div className="mb-1.5 text-[11px] text-fg-faded">Valor de venda (R$)</div>
                <input
                  defaultValue={form.salePriceBrl || ''}
                  onChange={(e) => set('salePriceBrl', paraNumero(e.target.value))}
                  inputMode="decimal"
                  placeholder="0,00"
                  className={`w-full ${inputClass}`}
                />
              </div>
              <div>
                <div className="mb-1.5 text-[11px] text-fg-faded">Lucro</div>
                <div
                  className="rounded-control border border-border bg-input-alt px-3.5 py-2.5 text-[13.5px] font-extrabold"
                  style={{ color: totais.profitBrl >= 0 ? '#4ade80' : '#e05555' }}
                >
                  {formatBRL(totais.profitBrl)}
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-[11px] text-fg-faded">Margem</div>
                <div className={readOnlyClass}>{totais.marginPct.toFixed(2)}%</div>
              </div>
            </div>

            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Finalização</div>
            <div className="mb-5 grid grid-cols-1 gap-3">
              <select value={form.status} onChange={(e) => set('status', e.target.value as QuoteStatus)} className={inputClass}>
                {QUOTE_STATUSES.filter((s) => s !== 'Convertido em Estoque' || form.status === 'Convertido em Estoque').map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Observações" className={`resize-y ${inputClass}`} />
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
