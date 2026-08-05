'use client';

import { useState, useMemo, useTransition } from 'react';
import { Pencil, Trash2, Plus, X, Search } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { formatBRL, parseNumeroBR, formatDateBR, formatNumeroInput } from '@/lib/format';
import {
  totalizarVenda,
  computeSaleIndicators,
  SALE_STATUSES,
  type Sale,
  type SaleItem,
  type SaleStatus,
} from '@/lib/sales';
import { geraParcelas, type Installment } from '@/lib/installments';
import { ParcelamentoFields } from '@/components/admin/ParcelamentoFields';
import { ParcelasList } from '@/components/admin/ParcelasList';
import { saveSaleAction, deleteSaleAction, type SaleFormInput } from '@/app/actions/sales';

const inputClass =
  'rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13.5px] outline-none focus:border-accent';

const COLUNAS = 'grid grid-cols-[70px_1.4fr_1fr_100px_110px_110px_110px_150px_70px] gap-2';

const VERDE = '#4ade80';
const VERMELHO = '#e05555';

const COR_STATUS: Record<SaleStatus, string> = {
  'Aguardando pagamento': '#d9a441',
  Pago: '#4ade80',
  Enviado: '#60a5fa',
  Entregue: '#4ade80',
  Cancelado: '#e05555',
};

function itemVazio(): SaleItem {
  return { productId: null, stockItemId: null, productName: '', qty: 1, unitPrice: 0, unitCost: 0 };
}

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formVazio(): SaleFormInput {
  return {
    customerId: null,
    customerName: '',
    status: 'Aguardando pagamento',
    paymentMethod: '',
    discount: 0,
    shipping: 0,
    installmentCount: 6,
    downPayment: 0,
    interestPct: 0,
    firstDueDate: hojeISO(),
    installmentNotes: '',
    items: [itemVazio()],
  };
}

export function SalesTable({
  sales,
  products,
  stockItems,
}: {
  sales: Sale[];
  products: { id: string; name: string; price: number }[];
  /** Itens disponíveis em estoque, para a venda dar baixa neles. */
  stockItems: { id: string; name: string; paidAmount: number; saleAmount: number }[];
}) {
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState<SaleFormInput | null>(null);
  /** Carnê já gravado da venda em edição. Só existe depois de salvar — no
   *  formulário de uma venda nova o que aparece é a prévia do cálculo. */
  const [parcelasDaEdicao, setParcelasDaEdicao] = useState<Installment[]>([]);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const ind = useMemo(() => computeSaleIndicators(sales), [sales]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return sales;
    return sales.filter((v) =>
      [v.customerName, v.status, v.origin, String(v.orderNumber), ...v.items.map((i) => i.productName)].some((c) =>
        c.toLowerCase().includes(termo)
      )
    );
  }, [sales, busca]);

  // Mesma função que a action usa para gravar: a tela não pode mostrar um lucro
  // e o banco guardar outro.
  const totais = useMemo(
    () => totalizarVenda(form?.items ?? [], form?.discount ?? 0, form?.shipping ?? 0),
    [form]
  );

  function salvar() {
    if (!form) return;
    startTransition(async () => {
      const result = await saveSaleAction(form);
      toast(result);
      if (result.ok) {
        setForm(null);
        setParcelasDaEdicao([]);
      }
    });
  }

  function excluir(v: Sale) {
    if (!window.confirm(`Excluir a venda #${v.orderNumber} de ${v.customerName}? Os lançamentos no Financeiro saem junto.`)) return;
    startTransition(async () => {
      toast(await deleteSaleAction(v.id));
    });
  }

  function editar(v: Sale) {
    setForm({
      id: v.id,
      customerId: v.customerId,
      customerName: v.customerName,
      status: v.status,
      paymentMethod: v.paymentMethod,
      discount: v.discount,
      shipping: v.shipping,
      installmentCount: v.installmentCount || 6,
      downPayment: v.downPayment,
      interestPct: v.interestPct,
      firstDueDate: v.firstDueDate ?? hojeISO(),
      installmentNotes: v.installmentNotes,
      items: v.items.length ? v.items : [itemVazio()],
    });
    setParcelasDaEdicao(v.installments);
  }

  const set = <K extends keyof SaleFormInput>(campo: K, valor: SaleFormInput[K]) =>
    setForm((f) => (f ? { ...f, [campo]: valor } : f));

  function setItem(indice: number, patch: Partial<SaleItem>) {
    setForm((f) => (f ? { ...f, items: f.items.map((it, i) => (i === indice ? { ...it, ...patch } : it)) } : f));
  }

  /** Do catálogo vem o preço; o custo fica com o dono para preencher, porque o
   *  produto do site é por encomenda e o custo só se conhece na compra. */
  function escolherProduto(indice: number, id: string) {
    const p = products.find((x) => x.id === id);
    if (!p) return setItem(indice, { productId: null });
    setItem(indice, { productId: p.id, stockItemId: null, productName: p.name, unitPrice: p.price });
  }

  /** Do estoque vem preço E custo: a unidade já foi comprada e tem os dois
   *  números gravados. Vender daqui dá baixa no item ao salvar. */
  function escolherEstoque(indice: number, id: string) {
    const s = stockItems.find((x) => x.id === id);
    if (!s) return setItem(indice, { stockItemId: null });
    setItem(indice, {
      stockItemId: s.id,
      productId: null,
      productName: s.name,
      qty: 1,
      unitPrice: s.saleAmount || 0,
      unitCost: s.paidAmount || 0,
    });
  }

  const cards = [
    { rotulo: 'Vendas', valor: String(ind.vendas), nota: 'sem canceladas' },
    { rotulo: 'Faturamento', valor: formatBRL(ind.faturamento), nota: 'total cobrado' },
    { rotulo: 'Custo', valor: formatBRL(ind.custo), nota: 'pago a fornecedor' },
    {
      rotulo: 'Lucro',
      valor: formatBRL(ind.lucro),
      nota: ind.semCusto > 0 ? `${ind.semCusto} venda(s) sem custo` : `${ind.margemPct.toFixed(1)}% de margem`,
    },
    { rotulo: 'A receber', valor: String(ind.aguardandoPagamento), nota: 'aguardando pagamento' },
  ];

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-faded" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, produto, número ou status"
            className={`w-full pl-10 ${inputClass}`}
          />
        </div>
        <button
          onClick={() => setForm(formVazio())}
          className="flex items-center gap-1.5 rounded-control bg-accent px-5 py-2.5 text-[13.5px] font-extrabold text-page transition-all hover:-translate-y-0.5"
        >
          <Plus size={15} /> Nova venda
        </button>
      </div>

      <div className="mb-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.rotulo} className="rounded-[18px] border border-border bg-card px-5 py-4">
            <div className="mb-1 flex items-baseline gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">{c.rotulo}</span>
              <span className="text-[10.5px] text-fg-faded/70">{c.nota}</span>
            </div>
            <div
              className="text-[22px] font-extrabold"
              style={c.rotulo === 'Lucro' ? { color: ind.lucro >= 0 ? VERDE : VERMELHO } : undefined}
            >
              {c.valor}
            </div>
          </div>
        ))}
      </div>

      {/* Sem este aviso o lucro agregado engana em silêncio: venda sem custo
          lançado conta como ganho integral e a margem sobe para perto de 100%. */}
      {ind.semCusto > 0 && (
        <div className="mb-3.5 rounded-control border border-warning/40 bg-warning/[0.06] px-4 py-3 text-[12.5px] text-fg-secondary">
          <strong>{ind.semCusto} venda(s) sem custo preenchido.</strong> Enquanto o custo não for informado, elas
          contam como lucro integral — o número acima está maior do que a realidade. Vendas do site nascem assim,
          porque o produto é por encomenda e o custo só se conhece na compra: edite a venda e preencha o custo do
          item para o Financeiro passar a registrar o lucro certo.
        </div>
      )}

      <div className="overflow-x-auto rounded-[18px] border border-border bg-card p-6">
        <div className="min-w-[1080px]">
          <div className={`${COLUNAS} border-b border-border pb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded`}>
            <div>Venda</div>
            <div>Cliente</div>
            <div>Itens</div>
            <div>Origem</div>
            <div className="text-right">Total</div>
            <div className="text-right">Custo</div>
            <div className="text-right">Lucro</div>
            <div>Status</div>
            <div className="text-right">Ações</div>
          </div>

          {filtradas.length === 0 && (
            <div className="py-5 text-[13px] text-fg-tertiary">
              {sales.length === 0
                ? 'Nenhuma venda ainda. Vendas do site entram aqui sozinhas; as manuais você lança pelo botão acima.'
                : 'Nada encontrado para essa busca.'}
            </div>
          )}

          {filtradas.map((v) => {
            const lucro = v.total - v.costTotal;
            return (
              <div
                key={v.id}
                className={`${COLUNAS} items-center border-b border-divider py-2.5 text-[13px] last:border-b-0 ${
                  v.status === 'Cancelado' ? 'opacity-55' : ''
                }`}
              >
                <div className="font-extrabold text-accent">#{v.orderNumber}</div>
                <div className="min-w-0">
                  <div className="truncate font-bold">{v.customerName}</div>
                  <div className="text-[11px] text-fg-faded">{formatDateBR(v.createdAt)}</div>
                </div>
                <div className="min-w-0 truncate text-fg-secondary">
                  {v.items.map((i) => (i.qty > 1 ? `${i.qty}× ${i.productName}` : i.productName)).join(' + ') || '—'}
                </div>
                <div className="text-[11.5px] text-fg-tertiary">{v.origin}</div>
                <div className="text-right font-bold">{formatBRL(v.total)}</div>
                <div className="text-right text-fg-secondary">
                  {v.costTotal > 0 ? formatBRL(v.costTotal) : '—'}
                </div>
                <div className="text-right font-extrabold" style={{ color: lucro >= 0 ? VERDE : VERMELHO }}>
                  {v.costTotal > 0 ? formatBRL(lucro) : '—'}
                </div>
                <div>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold"
                    style={{ background: `${COR_STATUS[v.status]}1f`, color: COR_STATUS[v.status] }}
                  >
                    {v.status}
                  </span>
                </div>
                <div className="flex justify-end gap-1.5">
                  <button
                    onClick={() => editar(v)}
                    disabled={pending}
                    title="Editar"
                    aria-label={`Editar venda ${v.orderNumber}`}
                    className="grid h-7 w-7 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-accent hover:text-accent disabled:opacity-50"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => excluir(v)}
                    disabled={pending}
                    title="Excluir"
                    aria-label={`Excluir venda ${v.orderNumber}`}
                    className="grid h-7 w-7 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-error hover:text-error disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-[960px] overflow-y-auto rounded-[20px] border border-border-strong bg-card p-7">
            <div className="mb-5 text-[15px] font-extrabold">{form.id ? 'Editar venda' : 'Nova venda'}</div>

            <div className="mb-5">
              <div className="mb-1.5 text-[11px] text-fg-faded">Cliente *</div>
              <input
                value={form.customerName}
                onChange={(e) => set('customerName', e.target.value)}
                placeholder="Nome de quem comprou"
                className={`w-full ${inputClass}`}
              />
            </div>

            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Produtos</div>
              <button
                onClick={() => set('items', [...form.items, itemVazio()])}
                className="flex items-center gap-1 rounded-control border border-border-strong px-3 py-1.5 text-[12px] font-bold text-fg-secondary hover:border-accent hover:text-accent"
              >
                <Plus size={13} /> Adicionar produto
              </button>
            </div>

            <div className="mb-3 overflow-hidden rounded-control border border-border-strong">
              <div className="grid grid-cols-[1.3fr_1.3fr_54px_110px_110px_36px] items-center gap-px bg-card-dark text-[11px] font-extrabold uppercase tracking-[.06em] text-fg-faded">
                <div className="px-3 py-2">Do estoque / catálogo</div>
                <div className="px-3 py-2">Produto</div>
                <div className="px-3 py-2">Qtd</div>
                <div className="px-3 py-2">Preço (R$)</div>
                <div className="px-3 py-2">Custo (R$)</div>
                <div />
              </div>

              {form.items.map((item, i) => (
                <div key={i} className="grid grid-cols-[1.3fr_1.3fr_54px_110px_110px_36px] items-center gap-px border-t border-divider">
                  <div className="p-1.5">
                    <select
                      value={item.stockItemId ? `s:${item.stockItemId}` : item.productId ? `p:${item.productId}` : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v.startsWith('s:')) escolherEstoque(i, v.slice(2));
                        else if (v.startsWith('p:')) escolherProduto(i, v.slice(2));
                        else setItem(i, { productId: null, stockItemId: null });
                      }}
                      className={`w-full ${inputClass}`}
                    >
                      <option value="">Avulso</option>
                      {stockItems.length > 0 && (
                        <optgroup label="Em estoque (baixa automática)">
                          {stockItems.map((s) => (
                            <option key={s.id} value={`s:${s.id}`}>{s.name}</option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Catálogo do site (por encomenda)">
                        {products.map((p) => (
                          <option key={p.id} value={`p:${p.id}`}>{p.name}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div className="p-1.5">
                    <input
                      value={item.productName}
                      onChange={(e) => setItem(i, { productName: e.target.value })}
                      placeholder="Nome do produto"
                      className={`w-full ${inputClass}`}
                    />
                  </div>
                  <div className="p-1.5">
                    <input
                      value={item.qty}
                      onChange={(e) => setItem(i, { qty: Math.max(1, Math.round(parseNumeroBR(e.target.value))) })}
                      inputMode="numeric"
                      className={`w-full ${inputClass}`}
                    />
                  </div>
                  <div className="p-1.5">
                    <input
                      key={`preco-${i}-${item.stockItemId ?? item.productId ?? 'avulso'}`}
                      defaultValue={formatNumeroInput(item.unitPrice)}
                      onChange={(e) => setItem(i, { unitPrice: parseNumeroBR(e.target.value) })}
                      inputMode="decimal"
                      placeholder="0,00"
                      className={`w-full ${inputClass}`}
                    />
                  </div>
                  <div className="p-1.5">
                    <input
                      key={`custo-${i}-${item.stockItemId ?? item.productId ?? 'avulso'}`}
                      defaultValue={formatNumeroInput(item.unitCost)}
                      onChange={(e) => setItem(i, { unitCost: parseNumeroBR(e.target.value) })}
                      inputMode="decimal"
                      placeholder="0,00"
                      className={`w-full ${inputClass}`}
                    />
                  </div>
                  <div className="flex justify-center p-1.5">
                    <button
                      onClick={() => set('items', form.items.filter((_, x) => x !== i))}
                      disabled={form.items.length === 1}
                      title="Remover produto"
                      aria-label={`Remover produto ${i + 1}`}
                      className="grid h-6 w-6 place-items-center rounded-full text-fg-faded hover:text-error disabled:opacity-30"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div>
                <div className="mb-1.5 text-[11px] text-fg-faded">Desconto (R$)</div>
                <input
                  defaultValue={formatNumeroInput(form.discount)}
                  onChange={(e) => set('discount', parseNumeroBR(e.target.value))}
                  inputMode="decimal"
                  placeholder="0,00"
                  className={`w-full ${inputClass}`}
                />
              </div>
              <div>
                <div className="mb-1.5 text-[11px] text-fg-faded">Frete (R$)</div>
                <input
                  defaultValue={formatNumeroInput(form.shipping)}
                  onChange={(e) => set('shipping', parseNumeroBR(e.target.value))}
                  inputMode="decimal"
                  placeholder="0,00"
                  className={`w-full ${inputClass}`}
                />
              </div>
              <div>
                <div className="mb-1.5 text-[11px] text-fg-faded">Total</div>
                <div className="rounded-control border border-border bg-input-alt px-3.5 py-2.5 text-[13.5px] font-extrabold">
                  {formatBRL(totais.total)}
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-[11px] text-fg-faded">Lucro ({totais.margemPct.toFixed(1)}%)</div>
                <div
                  className="rounded-control border border-border bg-input-alt px-3.5 py-2.5 text-[13.5px] font-extrabold"
                  style={{ color: totais.lucro >= 0 ? VERDE : VERMELHO }}
                >
                  {formatBRL(totais.lucro)}
                </div>
              </div>
            </div>

            <ParcelamentoFields
              condicoes={{
                paymentMethod: form.paymentMethod,
                installmentCount: form.installmentCount,
                downPayment: form.downPayment,
                interestPct: form.interestPct,
                firstDueDate: form.firstDueDate,
                installmentNotes: form.installmentNotes,
              }}
              total={totais.total}
              onChange={(patch) => setForm((f) => (f ? { ...f, ...patch } : f))}
            />

            {/* O carnê gravado só aparece na edição: numa venda nova ainda não
                existe parcela para dar baixa, e o bloco acima já mostra a
                prévia do que vai ser criado. */}
            {parcelasDaEdicao.length > 0 && (
              <div className="mb-4">
                <ParcelasList parcelas={parcelasDaEdicao} />
              </div>
            )}

            <div className="mb-5">
              <div className="mb-1.5 text-[11px] text-fg-faded">Status</div>
              <select
                value={form.status}
                onChange={(e) => set('status', e.target.value as SaleStatus)}
                className={`w-full ${inputClass}`}
              >
                {SALE_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="mb-5 rounded-control border border-border bg-card-dark px-4 py-3 text-[12px] text-fg-tertiary">
              {form.status === 'Cancelado' ? (
                <>Venda cancelada <strong>não lança nada</strong> no Financeiro, e os itens de estoque voltam para Disponível.</>
              ) : (
                <>
                  O Financeiro recebe{' '}
                  {geraParcelas(form.paymentMethod) ? (
                    <>
                      <strong>
                        {form.installmentCount || 1} parcela(s)
                        {form.downPayment > 0 ? ' mais a entrada' : ''}
                      </strong>
                      , cada uma como <strong>Previsto</strong> até você marcar como recebida
                    </>
                  ) : (
                    <>
                      <strong>uma receita</strong> de{' '}
                      <strong className="text-accent">{formatBRL(totais.total)}</strong> como{' '}
                      <strong>{form.status === 'Aguardando pagamento' ? 'Previsto' : 'Pago'}</strong>
                    </>
                  )}
                  {totais.custo > 0 && (
                    <>
                      , e <strong>uma despesa</strong> de{' '}
                      <strong className="text-accent">{formatBRL(totais.custo)}</strong>
                    </>
                  )}
                  . É lançando as duas pontas que o resultado do caixa vira o lucro, e não o faturamento.
                  {totais.custo === 0 && (
                    <> <strong>Sem custo preenchido</strong>, o resultado do Financeiro vai contar a venda inteira como ganho.</>
                  )}
                </>
              )}
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
