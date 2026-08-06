'use client';

import { useState, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { Trash2, Plus, X, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { ProdutoMiniatura } from '@/components/admin/ProdutoMiniatura';
import { formatBRL, parseNumeroBR, formatDateBR, formatNumeroInput } from '@/lib/format';
import {
  totalizarTroca,
  lucroDoItem,
  statusDaVendaGerada,
  efeitoNoCaixa,
  CONDICOES,
  MAX_ITENS_RECEBIDOS,
  type Trade,
  type TradeItem,
  type CondicaoItem,
} from '@/lib/trades';
import { ParcelamentoFields } from '@/components/admin/ParcelamentoFields';
import { SeloAdimplencia } from '@/components/admin/SeloAdimplencia';
import type { Adimplencia } from '@/lib/customer-history';
import { createTradeAction, deleteTradeAction, type TradeFormInput } from '@/app/actions/trades';

const inputClass =
  'rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13.5px] outline-none focus:border-accent';

const VERDE = '#4ade80';
const VERMELHO = '#e05555';

const COLUNAS = 'grid grid-cols-[1.6fr_1fr_120px_120px_120px_90px_70px] gap-2';

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function itemVazio(): TradeItem {
  return {
    name: '',
    category: '',
    specs: '',
    condition: 'Seminovo - Bom',
    marketValue: 0,
    paidValue: 0,
    resaleValue: 0,
    notes: '',
  };
}

function formVazio(): TradeFormInput {
  return {
    customerId: null,
    stockItemId: '',
    tradeDate: hojeISO(),
    paymentMethod: 'PIX',
    installmentCount: 3,
    downPayment: 0,
    interestPct: 0,
    firstDueDate: hojeISO(),
    installmentNotes: '',
    notes: '',
    items: [itemVazio()],
  };
}

export function TradesTable({
  trades,
  stockItems,
  customers,
}: {
  trades: Trade[];
  /** Itens à venda: o principal sai daqui. */
  stockItems: { id: string; name: string; paidAmount: number; saleAmount: number }[];
  customers: { id: string; name: string; adimplencia: Adimplencia; parcelasAtrasadas: number }[];
}) {
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState<TradeFormInput | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return trades;
    return trades.filter((t) =>
      [t.mainProductName, t.customerName, ...t.items.map((i) => i.name)].some((c) =>
        c.toLowerCase().includes(termo)
      )
    );
  }, [trades, busca]);

  const principal = form ? stockItems.find((s) => s.id === form.stockItemId) : undefined;
  const precoPrincipal = principal?.saleAmount ?? 0;
  const custoPrincipal = principal?.paidAmount ?? 0;

  // Mesma função que a action usa para gravar: a tela não pode prometer um
  // lucro e o banco registrar outro.
  const totais = useMemo(
    () => totalizarTroca(form?.items ?? [], precoPrincipal, custoPrincipal),
    [form, precoPrincipal, custoPrincipal]
  );

  const clienteEscolhido = form?.customerId ? customers.find((c) => c.id === form.customerId) : undefined;
  const caixa = efeitoNoCaixa(totais, custoPrincipal);

  function salvar() {
    if (!form) return;
    startTransition(async () => {
      const result = await createTradeAction(form);
      toast(result);
      if (result.ok) setForm(null);
    });
  }

  function excluir(t: Trade) {
    if (
      !window.confirm(
        `Excluir a negociação de "${t.mainProductName}"?\n\n` +
          `A venda gerada é revertida e o produto principal volta ao estoque.` +
          (t.items.length > 0
            ? `\n\nOs ${t.items.length} produto(s) recebido(s) SAEM do estoque — se a negociação não aconteceu, eles nunca entraram na loja.`
            : '')
      )
    )
      return;
    startTransition(async () => {
      toast(await deleteTradeAction(t.id));
    });
  }

  const set = <K extends keyof TradeFormInput>(campo: K, valor: TradeFormInput[K]) =>
    setForm((f) => (f ? { ...f, [campo]: valor } : f));

  function setItem(indice: number, patch: Partial<TradeItem>) {
    setForm((f) => (f ? { ...f, items: f.items.map((it, i) => (i === indice ? { ...it, ...patch } : it)) } : f));
  }

  const totalRecebidoGeral = trades.reduce((s, t) => s + t.totalReceived, 0);
  const lucroGeral = trades.reduce((s, t) => s + t.totalProfit, 0);

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-faded" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por produto, cliente ou item recebido"
            className={`w-full pl-10 ${inputClass}`}
          />
        </div>
        <button
          onClick={() => setForm(formVazio())}
          className="flex items-center gap-1.5 rounded-control bg-accent px-5 py-2.5 text-[13.5px] font-extrabold text-page transition-all hover:-translate-y-0.5"
        >
          <Plus size={15} /> Nova negociação
        </button>
      </div>

      <div className="mb-3.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card rotulo="Negociações" valor={String(trades.length)} nota="concluídas" />
        <Card rotulo="Recebido em produtos" valor={formatBRL(totalRecebidoGeral)} nota="virou estoque" />
        <Card rotulo="Lucro total" valor={formatBRL(lucroGeral)} nota="principal + revenda esperada" cor={lucroGeral >= 0 ? VERDE : VERMELHO} />
      </div>

      <div className="overflow-x-auto rounded-[18px] border border-border bg-card p-6">
        <div className="min-w-[980px]">
          <div className={`${COLUNAS} border-b border-border pb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded`}>
            <div>Produto principal</div>
            <div>Cliente</div>
            <div className="text-right">Recebido</div>
            <div className="text-right">Diferença</div>
            <div className="text-right">Lucro</div>
            <div>Venda</div>
            <div className="text-right">Ações</div>
          </div>

          {filtradas.length === 0 && (
            <div className="py-5 text-[13px] text-fg-tertiary">
              {trades.length === 0
                ? 'Nenhuma negociação ainda. Aqui o cliente entrega produtos usados como parte do pagamento de um item do estoque.'
                : 'Nada encontrado para essa busca.'}
            </div>
          )}

          {filtradas.map((t) => (
            <div key={t.id} className="border-b border-divider last:border-b-0">
              <div className={`${COLUNAS} items-center py-2.5 text-[13px]`}>
                <div className="min-w-0">
                  <button
                    onClick={() => setAberta(aberta === t.id ? null : t.id)}
                    className="flex w-full items-center gap-1.5 text-left"
                  >
                    {aberta === t.id ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    <ProdutoMiniatura src={t.mainPhotoUrl} alt={t.mainProductName} tamanho={36} />
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{t.mainProductName}</span>
                      <span className="block text-[11px] text-fg-faded">
                        {formatDateBR(t.tradeDate + 'T12:00:00')} · {t.items.length} recebido(s)
                      </span>
                    </span>
                  </button>
                </div>
                <div className="truncate text-fg-secondary">{t.customerName || '—'}</div>
                <div className="text-right text-fg-secondary">{formatBRL(t.totalReceived)}</div>
                <div className="text-right font-bold">{formatBRL(t.differenceToPay)}</div>
                <div className="text-right font-extrabold" style={{ color: t.totalProfit >= 0 ? VERDE : VERMELHO }}>
                  {formatBRL(t.totalProfit)}
                </div>
                <div>
                  {t.orderNumber ? (
                    <Link href="/admin/vendas" className="text-[12px] font-bold text-accent hover:underline">
                      #{t.orderNumber}
                    </Link>
                  ) : (
                    <span className="text-[11.5px] text-error">sem venda</span>
                  )}
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => excluir(t)}
                    disabled={pending}
                    title="Excluir negociação"
                    aria-label={`Excluir negociação de ${t.mainProductName}`}
                    className="grid h-7 w-7 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-error hover:text-error disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {aberta === t.id && (
                <div className="mb-3 rounded-control border border-border bg-card-dark p-4">
                  <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
                    Produtos recebidos
                  </div>
                  {t.items.length === 0 ? (
                    <div className="text-[12.5px] text-fg-tertiary">
                      Nenhum produto recebido — foi uma venda comum registrada como troca.
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-[1.6fr_130px_100px_100px_100px_100px] gap-2 border-b border-divider pb-1.5 text-[10.5px] font-extrabold uppercase tracking-[.06em] text-fg-faded">
                        <div>Produto</div>
                        <div>Estado</div>
                        <div className="text-right">Mercado</div>
                        <div className="text-right">Pago</div>
                        <div className="text-right">Revenda</div>
                        <div className="text-right">Lucro</div>
                      </div>
                      {t.items.map((i, n) => (
                        <div
                          key={i.id ?? n}
                          className="grid grid-cols-[1.6fr_130px_100px_100px_100px_100px] items-center gap-2 border-b border-divider py-1.5 text-[12.5px] last:border-b-0"
                        >
                          <div className="min-w-0 truncate font-bold">{i.name}</div>
                          <div className="text-[11.5px] text-fg-tertiary">{i.condition}</div>
                          <div className="text-right text-fg-secondary">{formatBRL(i.marketValue)}</div>
                          <div className="text-right">{formatBRL(i.paidValue)}</div>
                          <div className="text-right text-fg-secondary">{formatBRL(i.resaleValue)}</div>
                          <div
                            className="text-right font-bold"
                            style={{ color: lucroDoItem(i) >= 0 ? VERDE : VERMELHO }}
                          >
                            {formatBRL(lucroDoItem(i))}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                  {!!t.notes && <div className="mt-2 text-[12px] text-fg-tertiary">{t.notes}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-[980px] overflow-y-auto rounded-[20px] border border-border-strong bg-card p-7">
            <div className="mb-1 text-[15px] font-extrabold">Nova negociação de troca</div>
            <div className="mb-5 text-[12.5px] text-fg-tertiary">
              O cliente entrega produtos usados como parte do pagamento de um item do estoque.
            </div>

            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <div className="mb-1.5 text-[11px] text-fg-faded">Cliente</div>
                <select
                  value={form.customerId ?? ''}
                  onChange={(e) => set('customerId', e.target.value || null)}
                  className={`w-full ${inputClass}`}
                >
                  <option value="">Sem cliente vinculado</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="mb-1.5 text-[11px] text-fg-faded">Produto principal (do estoque) *</div>
                <select
                  value={form.stockItemId}
                  onChange={(e) => set('stockItemId', e.target.value)}
                  className={`w-full ${inputClass}`}
                >
                  <option value="">Escolha o item que está sendo vendido</option>
                  {stockItems.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="mb-1.5 text-[11px] text-fg-faded">Data da negociação</div>
                <input
                  type="date"
                  value={form.tradeDate}
                  onChange={(e) => set('tradeDate', e.target.value)}
                  className={`w-full ${inputClass}`}
                />
              </div>
            </div>

            {clienteEscolhido && clienteEscolhido.adimplencia !== 'Adimplente' && (
              <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-control border border-border bg-card-dark px-4 py-3">
                <SeloAdimplencia situacao={clienteEscolhido.adimplencia} atrasadas={clienteEscolhido.parcelasAtrasadas} />
                <span className="text-[12px] text-fg-tertiary">
                  {clienteEscolhido.adimplencia === 'Inadimplente'
                    ? 'Este cliente tem parcela vencida e não paga.'
                    : 'Este cliente tem parcelas a vencer.'}
                </span>
                <Link href={`/admin/clientes/${clienteEscolhido.id}`} target="_blank" className="text-[12px] font-bold text-accent hover:underline">
                  ver histórico
                </Link>
              </div>
            )}

            {principal && (
              <div className="mb-4 grid grid-cols-3 gap-3 rounded-control border border-border bg-card-dark p-4">
                <Numero rotulo="Valor de venda" valor={formatBRL(precoPrincipal)} />
                <Numero rotulo="Custo" valor={formatBRL(custoPrincipal)} />
                <Numero
                  rotulo="Lucro do principal"
                  valor={formatBRL(totais.lucroPrincipal)}
                  cor={totais.lucroPrincipal >= 0 ? VERDE : VERMELHO}
                />
              </div>
            )}

            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
                Produtos recebidos ({form.items.filter((i) => i.name.trim()).length}/{MAX_ITENS_RECEBIDOS})
              </div>
              <button
                onClick={() => set('items', [...form.items, itemVazio()])}
                disabled={form.items.length >= MAX_ITENS_RECEBIDOS}
                className="flex items-center gap-1 rounded-control border border-border-strong px-3 py-1.5 text-[12px] font-bold text-fg-secondary hover:border-accent hover:text-accent disabled:opacity-40"
              >
                <Plus size={13} /> Adicionar produto
              </button>
            </div>

            <div className="mb-4 flex flex-col gap-2.5">
              {form.items.map((item, i) => (
                <div key={i} className="rounded-control border border-border-strong p-3">
                  <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-[1.5fr_1fr_150px_36px]">
                    <input
                      value={item.name}
                      onChange={(e) => setItem(i, { name: e.target.value })}
                      placeholder="Nome do produto recebido"
                      className={inputClass}
                    />
                    <input
                      value={item.category}
                      onChange={(e) => setItem(i, { category: e.target.value })}
                      placeholder="Categoria"
                      className={inputClass}
                    />
                    <select
                      value={item.condition}
                      onChange={(e) => setItem(i, { condition: e.target.value as CondicaoItem })}
                      className={inputClass}
                    >
                      {CONDICOES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => set('items', form.items.filter((_, x) => x !== i))}
                      disabled={form.items.length === 1}
                      title="Remover produto"
                      aria-label={`Remover produto recebido ${i + 1}`}
                      className="grid h-[42px] w-full place-items-center rounded-control border border-border-strong text-fg-faded hover:border-error hover:text-error disabled:opacity-30 sm:w-[36px]"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                    <div>
                      <div className="mb-1 text-[10.5px] text-fg-faded">Valor de mercado</div>
                      <input
                        defaultValue={formatNumeroInput(item.marketValue)}
                        onChange={(e) => setItem(i, { marketValue: parseNumeroBR(e.target.value) })}
                        inputMode="decimal"
                        placeholder="0,00"
                        className={`w-full ${inputClass}`}
                      />
                    </div>
                    <div>
                      <div className="mb-1 text-[10.5px] text-fg-faded">A loja paga</div>
                      <input
                        defaultValue={formatNumeroInput(item.paidValue)}
                        onChange={(e) => setItem(i, { paidValue: parseNumeroBR(e.target.value) })}
                        inputMode="decimal"
                        placeholder="0,00"
                        className={`w-full ${inputClass}`}
                      />
                    </div>
                    <div>
                      <div className="mb-1 text-[10.5px] text-fg-faded">Revenda estimada</div>
                      <input
                        defaultValue={formatNumeroInput(item.resaleValue)}
                        onChange={(e) => setItem(i, { resaleValue: parseNumeroBR(e.target.value) })}
                        inputMode="decimal"
                        placeholder="0,00"
                        className={`w-full ${inputClass}`}
                      />
                    </div>
                    <div>
                      <div className="mb-1 text-[10.5px] text-fg-faded">Lucro esperado</div>
                      <div
                        className="rounded-control border border-border bg-input-alt px-3.5 py-2.5 text-[13.5px] font-extrabold"
                        style={{ color: lucroDoItem(item) >= 0 ? VERDE : VERMELHO }}
                      >
                        {formatBRL(lucroDoItem(item))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 rounded-control border border-accent/40 bg-[rgb(var(--brand-accent-rgb)/.05)] p-4 sm:grid-cols-4">
              <Numero rotulo="Recebido em produtos" valor={formatBRL(totais.totalRecebido)} />
              <Numero rotulo="Diferença a pagar" valor={formatBRL(totais.diferenca)} destaque />
              <Numero
                rotulo="Lucro total"
                valor={formatBRL(totais.lucroTotal)}
                cor={totais.lucroTotal >= 0 ? VERDE : VERMELHO}
              />
              <Numero rotulo="Margem" valor={`${totais.margemPct.toFixed(2)}%`} />
            </div>

            {totais.excedente > 0 && (
              <div className="mb-4 rounded-control border border-warning/50 bg-warning/[0.06] px-4 py-3 text-[12.5px] text-fg-secondary">
                Os produtos recebidos valem <strong>{formatBRL(totais.excedente)}</strong> a mais que o item
                vendido. O cliente não paga nada em dinheiro, e essa sobra <strong>não é registrada</strong> como
                dívida da loja — acerte por fora ou ajuste os valores acima.
              </div>
            )}

            <ParcelamentoFields
              condicoes={{
                paymentMethod: form.paymentMethod,
                installmentCount: form.installmentCount,
                downPayment: form.downPayment,
                interestPct: form.interestPct,
                firstDueDate: form.firstDueDate,
                installmentNotes: form.installmentNotes,
              }}
              // O carnê é sobre a DIFERENÇA: o resto já foi pago em mercadoria.
              total={totais.diferenca}
              onChange={(patch) => setForm((f) => (f ? { ...f, ...patch } : f))}
            />

            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Observações da negociação"
              rows={2}
              className={`mb-4 w-full resize-none ${inputClass}`}
            />

            <div className="mb-5 rounded-control border border-border bg-card-dark px-4 py-3 text-[12px] text-fg-tertiary">
              Ao concluir: os produtos recebidos entram no <strong>Estoque</strong>, o item principal passa a{' '}
              <strong>Vendido</strong> e nasce a <strong>venda</strong> como{' '}
              <strong>{statusDaVendaGerada(totais.diferenca, form.paymentMethod)}</strong>.
              {form.items.some((i) => i.name.trim()) && (
                <div className="mt-2">
                  Os produtos recebidos entram <strong>sem vínculo com o catálogo</strong>, então{' '}
                  <strong>não aparecem no site</strong> nem contam como pronta entrega. Para publicar um deles
                  depois, ligue-o a um produto pela tela de Estoque.
                </div>
              )}
              <div className="mt-2">
                No Financeiro entra <strong className="text-accent">{formatBRL(totais.diferenca)}</strong> de
                receita — só o dinheiro. <strong>Produto recebido não é caixa</strong>: vira estoque e só vale
                dinheiro quando for revendido.
                {caixa < 0 && (
                  <>
                    {' '}Com o custo do principal ({formatBRL(custoPrincipal)}), o resultado imediato fica em{' '}
                    <strong style={{ color: VERMELHO }}>{formatBRL(caixa)}</strong> — o que falta está nos{' '}
                    {formatBRL(totais.totalRecebido)} que entraram em estoque.
                  </>
                )}
              </div>
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
                disabled={pending || !form.stockItemId}
                className="rounded-control bg-accent px-6 py-2.5 text-[13.5px] font-extrabold text-page disabled:opacity-60"
              >
                {pending ? 'Concluindo…' : 'Concluir negociação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ rotulo, valor, nota, cor }: { rotulo: string; valor: string; nota: string; cor?: string }) {
  return (
    <div className="rounded-[18px] border border-border bg-card px-5 py-4">
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">{rotulo}</span>
        <span className="text-[10.5px] text-fg-faded/70">{nota}</span>
      </div>
      <div className="text-[22px] font-extrabold" style={cor ? { color: cor } : undefined}>{valor}</div>
    </div>
  );
}

function Numero({ rotulo, valor, cor, destaque }: { rotulo: string; valor: string; cor?: string; destaque?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-[10.5px] uppercase tracking-[.06em] text-fg-faded">{rotulo}</div>
      <div
        className={`text-[15px] font-extrabold ${destaque ? 'text-accent' : ''}`}
        style={cor ? { color: cor } : undefined}
      >
        {valor}
      </div>
    </div>
  );
}
