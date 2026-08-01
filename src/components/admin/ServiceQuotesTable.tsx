'use client';

import { useState, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { Pencil, Trash2, Plus, X, Search, ArrowRightCircle } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { formatBRL, parseNumeroBR, formatDateBR, formatNumeroInput } from '@/lib/format';
import {
  totalizarItens,
  calcularEntrega,
  computeServiceQuoteIndicators,
  podeConverterEmPrestacao,
  valorDoContrato,
  somarMeses,
  formatPrazo,
  PLAN_MONTHS_OPTIONS,
  PLAN_MONTHS_DEFAULT,
  SERVICE_QUOTE_STATUSES_EDITAVEIS,
  type InternalService,
  type ServiceQuote,
  type ServiceOrderItem,
  type ServiceQuoteStatus,
} from '@/lib/services';
import {
  saveServiceQuoteAction,
  deleteServiceQuoteAction,
  convertServiceQuoteAction,
  type ServiceQuoteInput,
} from '@/app/actions/service-quotes';

const inputClass =
  'rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13.5px] outline-none focus:border-accent';

const COLUNAS = 'grid grid-cols-[1.7fr_1fr_120px_100px_170px_100px] gap-2';

const VERDE = '#4ade80';
const CINZA = '#7a7a84';

/** O accent sai por CLASSE porque é configurável por loja (RFC-0001); verde e
 *  cinza são semânticos e vão inline. Interpolar cor dentro da classe não
 *  funciona — o Tailwind varre o código como texto. */
function estiloDoStatus(status: ServiceQuoteStatus): { classe: string; style?: React.CSSProperties } {
  if (status === 'Aprovado') return { classe: '', style: { background: `${VERDE}1f`, color: VERDE } };
  if (status === 'Reprovado' || status === 'Convertido em Prestação') {
    return { classe: '', style: { background: `${CINZA}1f`, color: CINZA } };
  }
  return { classe: 'bg-[rgb(var(--brand-accent-rgb)/.12)] text-accent' };
}

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function itemVazio(): ServiceOrderItem {
  return { internalServiceId: null, name: '', description: '', amount: 0, billingType: 'unico', leadTimeDays: 0 };
}

function formVazio(): ServiceQuoteInput {
  return {
    customerId: null,
    title: '',
    notes: '',
    status: 'Em elaboração',
    planMonths: PLAN_MONTHS_DEFAULT,
    items: [itemVazio()],
  };
}

export function ServiceQuotesTable({
  quotes,
  services,
  customers,
}: {
  quotes: ServiceQuote[];
  services: InternalService[];
  customers: { id: string; name: string }[];
}) {
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState<ServiceQuoteInput | null>(null);
  const [conversao, setConversao] = useState<{
    quote: ServiceQuote;
    paymentMethod: string;
    startDate: string;
    planStartDate: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const ind = useMemo(() => computeServiceQuoteIndicators(quotes), [quotes]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return quotes;
    return quotes.filter((q) =>
      [q.title, q.customerName, q.status, ...q.items.map((i) => i.name)].some((c) =>
        c.toLowerCase().includes(termo)
      )
    );
  }, [quotes, busca]);

  // Mesma função que a action usa para gravar, para o que aparece no formulário
  // não poder divergir do que vai para o banco.
  const totais = useMemo(() => totalizarItens(form?.items ?? []), [form]);
  const ativos = services.filter((s) => s.active);

  const entregaPrevista = conversao
    ? calcularEntrega(conversao.startDate, conversao.quote.leadTimeDays)
    : null;

  const temPlanoNaConversao = !!conversao && conversao.quote.monthlyAmount > 0 && !!conversao.quote.planMonths;

  function salvar() {
    if (!form) return;
    startTransition(async () => {
      const result = await saveServiceQuoteAction(form);
      toast(result);
      if (result.ok) setForm(null);
    });
  }

  function excluir(q: ServiceQuote) {
    if (!window.confirm(`Excluir o orçamento "${q.title}"?`)) return;
    startTransition(async () => {
      toast(await deleteServiceQuoteAction(q.id));
    });
  }

  function converter() {
    if (!conversao) return;
    startTransition(async () => {
      const result = await convertServiceQuoteAction({
        quoteId: conversao.quote.id,
        paymentMethod: conversao.paymentMethod,
        startDate: conversao.startDate,
        planStartDate: conversao.planStartDate,
      });
      toast(result);
      if (result.ok) setConversao(null);
    });
  }

  function editar(q: ServiceQuote) {
    setForm({
      id: q.id,
      customerId: q.customerId,
      title: q.title,
      notes: q.notes,
      status: q.status,
      planMonths: q.planMonths ?? PLAN_MONTHS_DEFAULT,
      items: q.items.length ? q.items : [itemVazio()],
    });
  }

  const set = <K extends keyof ServiceQuoteInput>(campo: K, valor: ServiceQuoteInput[K]) =>
    setForm((f) => (f ? { ...f, [campo]: valor } : f));

  function setItem(indice: number, patch: Partial<ServiceOrderItem>) {
    setForm((f) => (f ? { ...f, items: f.items.map((it, i) => (i === indice ? { ...it, ...patch } : it)) } : f));
  }

  /** Copia do catálogo em vez de referenciar: o valor é ajustável na proposta
   *  (decisão do dono) e preço de catálogo que muda depois não pode reescrever
   *  um orçamento já enviado ao cliente. */
  function escolherServico(indice: number, serviceId: string) {
    const s = ativos.find((x) => x.id === serviceId);
    if (!s) return setItem(indice, { internalServiceId: null });
    setItem(indice, {
      internalServiceId: s.id,
      name: s.name,
      description: s.description,
      amount: s.price,
      billingType: s.billingType,
      leadTimeDays: s.leadTimeDays,
    });
  }

  const cards = [
    { rotulo: 'Em aberto', valor: String(ind.emAberto), nota: 'orçamentos' },
    { rotulo: 'Valor em aberto', valor: formatBRL(ind.valorEmAberto), nota: 'ainda pode virar sim' },
    { rotulo: 'Aprovados', valor: String(ind.aprovados), nota: 'a converter' },
    { rotulo: 'Valor aprovado', valor: formatBRL(ind.valorAprovado), nota: 'a converter' },
  ];

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-faded" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por título, cliente ou serviço"
            className={`w-full pl-10 ${inputClass}`}
          />
        </div>
        <button
          onClick={() => setForm(formVazio())}
          className="flex items-center gap-1.5 rounded-control bg-accent px-5 py-2.5 text-[13.5px] font-extrabold text-page transition-all hover:-translate-y-0.5"
        >
          <Plus size={15} /> Novo orçamento
        </button>
      </div>

      <div className="mb-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.rotulo} className="rounded-[18px] border border-border bg-card px-5 py-4">
            <div className="mb-1 flex items-baseline gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">{c.rotulo}</span>
              <span className="text-[10.5px] text-fg-faded/70">{c.nota}</span>
            </div>
            <div className="text-[22px] font-extrabold">{c.valor}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[18px] border border-border bg-card p-6">
        <div className={`${COLUNAS} border-b border-border pb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded`}>
          <div>Orçamento</div>
          <div>Cliente</div>
          <div className="text-right">Valor</div>
          <div>Criado</div>
          <div>Status</div>
          <div className="text-right">Ações</div>
        </div>

        {filtrados.length === 0 && (
          <div className="py-5 text-[13px] text-fg-tertiary">
            {quotes.length === 0
              ? 'Nenhum orçamento ainda. Ao ser aprovado, o orçamento vira uma Prestação de Serviço — e é ela que lança no Financeiro.'
              : 'Nada encontrado para essa busca.'}
          </div>
        )}

        {filtrados.map((q) => {
          const estilo = estiloDoStatus(q.status);
          const convertivel = podeConverterEmPrestacao(q.status);
          return (
            <div
              key={q.id}
              className={`${COLUNAS} items-center border-b border-divider py-2.5 text-[13px] last:border-b-0 ${
                q.status === 'Reprovado' ? 'opacity-55' : ''
              }`}
            >
              <div className="min-w-0">
                <div className="truncate font-bold">{q.title}</div>
                <div className="truncate text-[11.5px] text-fg-tertiary">
                  {q.items.length} serviço(s)
                  {q.leadTimeDays > 0 ? ` · ${formatPrazo(q.leadTimeDays)}` : ''}
                  {q.planMonths ? ` · plano de ${q.planMonths} meses` : ''}
                </div>
              </div>
              <div className="truncate text-fg-secondary">{q.customerName || '—'}</div>
              <div className="text-right font-bold">
                {q.totalAmount > 0 && <div className="text-accent">{formatBRL(q.totalAmount)}</div>}
                {q.monthlyAmount > 0 && (
                  <div className={q.totalAmount > 0 ? 'text-[11.5px] text-fg-secondary' : 'text-accent'}>
                    {formatBRL(q.monthlyAmount)}/mês
                  </div>
                )}
                {q.totalAmount === 0 && q.monthlyAmount === 0 && <span className="text-fg-tertiary">—</span>}
              </div>
              <div className="text-fg-secondary">{formatDateBR(q.createdAt)}</div>
              <div className="min-w-0">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${estilo.classe}`}
                  style={estilo.style}
                >
                  {q.status}
                </span>
                {q.orderId && (
                  <Link
                    href="/admin/prestacao-servico"
                    className="ml-1.5 text-[11px] font-bold text-accent hover:underline"
                  >
                    ver prestação
                  </Link>
                )}
              </div>
              <div className="flex justify-end gap-1.5">
                {convertivel && (
                  <button
                    onClick={() => setConversao({ quote: q, paymentMethod: '', startDate: hojeISO(), planStartDate: hojeISO() })}
                    disabled={pending}
                    title="Gerar prestação"
                    aria-label={`Gerar prestação de ${q.title}`}
                    className="grid h-7 w-7 place-items-center rounded-full border border-accent/50 text-accent hover:bg-accent hover:text-page disabled:opacity-50"
                  >
                    <ArrowRightCircle size={13} />
                  </button>
                )}
                <button
                  onClick={() => editar(q)}
                  disabled={pending}
                  title="Editar"
                  aria-label={`Editar ${q.title}`}
                  className="grid h-7 w-7 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => excluir(q)}
                  disabled={pending}
                  title="Excluir"
                  aria-label={`Excluir ${q.title}`}
                  className="grid h-7 w-7 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-error hover:text-error disabled:opacity-50"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-[900px] overflow-y-auto rounded-[20px] border border-border-strong bg-card p-7">
            <div className="mb-5 text-[15px] font-extrabold">
              {form.id ? 'Editar orçamento' : 'Novo orçamento'}
            </div>

            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Título do orçamento *"
                className={`sm:col-span-2 ${inputClass}`}
              />
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
                <div className="mb-1.5 text-[11px] text-fg-faded">Status</div>
                <select
                  value={form.status}
                  onChange={(e) => set('status', e.target.value as ServiceQuoteStatus)}
                  className={`w-full ${inputClass}`}
                >
                  {SERVICE_QUOTE_STATUSES_EDITAVEIS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
                Serviços deste orçamento
              </div>
              <button
                onClick={() => set('items', [...form.items, itemVazio()])}
                className="flex items-center gap-1 rounded-control border border-border-strong px-3 py-1.5 text-[12px] font-bold text-fg-secondary hover:border-accent hover:text-accent"
              >
                <Plus size={13} /> Adicionar serviço
              </button>
            </div>

            <div className="mb-3 overflow-hidden rounded-control border border-border-strong">
              <div className="grid grid-cols-[1.6fr_1.4fr_110px_90px_36px] items-center gap-px bg-card-dark text-[11px] font-extrabold uppercase tracking-[.06em] text-fg-faded">
                <div className="px-3 py-2">Do catálogo</div>
                <div className="px-3 py-2">Nome</div>
                <div className="px-3 py-2">Valor (R$)</div>
                <div className="px-3 py-2">Prazo</div>
                <div />
              </div>

              {form.items.map((item, i) => (
                <div key={i} className="grid grid-cols-[1.6fr_1.4fr_110px_90px_36px] items-center gap-px border-t border-divider">
                  <div className="p-1.5">
                    <select
                      value={item.internalServiceId ?? ''}
                      onChange={(e) => escolherServico(i, e.target.value)}
                      className={`w-full ${inputClass}`}
                    >
                      <option value="">Avulso</option>
                      {ativos.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}{s.billingType === 'mensal' ? ' (mensal)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="p-1.5">
                    <input
                      value={item.name}
                      onChange={(e) => setItem(i, { name: e.target.value })}
                      placeholder="Nome do serviço"
                      className={`w-full ${inputClass}`}
                    />
                  </div>
                  <div className="p-1.5">
                    <input
                      key={`valor-${i}-${item.internalServiceId ?? 'avulso'}`}
                      defaultValue={formatNumeroInput(item.amount)}
                      onChange={(e) => setItem(i, { amount: parseNumeroBR(e.target.value) })}
                      inputMode="decimal"
                      placeholder="0,00"
                      className={`w-full ${inputClass}`}
                    />
                  </div>
                  <div className="p-1.5">
                    {item.billingType === 'mensal' ? (
                      <div className="px-2 text-[11.5px] font-bold text-accent">mensal</div>
                    ) : (
                      <input
                        key={`prazo-${i}-${item.internalServiceId ?? 'avulso'}`}
                        defaultValue={item.leadTimeDays || ''}
                        onChange={(e) => setItem(i, { leadTimeDays: Math.round(parseNumeroBR(e.target.value)) })}
                        inputMode="numeric"
                        placeholder="dias"
                        className={`w-full ${inputClass}`}
                      />
                    )}
                  </div>
                  <div className="flex justify-center p-1.5">
                    <button
                      onClick={() => set('items', form.items.filter((_, x) => x !== i))}
                      disabled={form.items.length === 1}
                      title="Remover serviço"
                      aria-label={`Remover serviço ${i + 1}`}
                      className="grid h-6 w-6 place-items-center rounded-full text-fg-faded hover:text-error disabled:opacity-30"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}

              <div className="grid grid-cols-[1.6fr_1.4fr_110px_90px_36px] items-center gap-px border-t border-border-strong bg-card-dark text-[13px] font-extrabold">
                <div className="px-3 py-2.5">Total</div>
                <div />
                <div className="px-3 py-2.5">
                  {totais.total > 0 && <span className="text-accent">{formatBRL(totais.total)}</span>}
                  {totais.mensal > 0 && (
                    <div className={totais.total > 0 ? 'text-[11.5px] font-bold text-fg-secondary' : 'text-accent'}>
                      {formatBRL(totais.mensal)}/mês
                    </div>
                  )}
                </div>
                <div className="px-3 py-2.5">{totais.prazoDias || 0}d</div>
                <div />
              </div>
            </div>

            <div className="mb-4 text-[11px] text-fg-faded">
              O valor vem do catálogo mas é <strong>ajustável nesta proposta</strong>. O prazo é a{' '}
              <strong>soma</strong> dos serviços, não o maior — serviço mensal não entra nele.
            </div>

            {totais.temPlano && (
              <div className="mb-4 rounded-control border border-accent/40 bg-[rgb(var(--brand-accent-rgb)/.05)] p-4">
                <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[.08em] text-accent">
                  Plano mensal proposto
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <div className="mb-1.5 text-[11px] text-fg-faded">Duração</div>
                    <select
                      value={form.planMonths ?? PLAN_MONTHS_DEFAULT}
                      onChange={(e) => set('planMonths', Number(e.target.value))}
                      className={`w-full ${inputClass}`}
                    >
                      {PLAN_MONTHS_OPTIONS.map((m) => (
                        <option key={m} value={m}>{m} meses</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="mb-1.5 text-[11px] text-fg-faded">Valor do contrato</div>
                    <div className="rounded-control border border-border bg-card-dark px-3.5 py-2.5 text-[13.5px] font-extrabold">
                      {formatBRL(valorDoContrato(totais, form.planMonths))}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-[11.5px] text-fg-tertiary">
                  {formatBRL(totais.total)} de trabalho mais {form.planMonths}× {formatBRL(totais.mensal)}. A data
                  da primeira mensalidade é escolhida na conversão.
                </div>
              </div>
            )}

            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Observações"
              rows={2}
              className={`mb-5 w-full resize-none ${inputClass}`}
            />

            <div className="mb-5 rounded-control border border-border bg-card-dark px-4 py-3 text-[12px] text-fg-tertiary">
              Orçamento <strong>não lança nada</strong> no Financeiro — é proposta, não dinheiro. Ao ser
              aprovado, use <strong>Gerar prestação</strong>: a prestação é que entra no caixa. Forma de
              pagamento e data de início são pedidas nesse momento.
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

      {conversao && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[520px] rounded-[20px] border border-border-strong bg-card p-7">
            <div className="mb-1 text-[15px] font-extrabold">Gerar prestação</div>
            <div className="mb-5 text-[12.5px] text-fg-tertiary">
              {conversao.quote.title}
              {conversao.quote.totalAmount > 0 && ` · ${formatBRL(conversao.quote.totalAmount)}`}
              {conversao.quote.monthlyAmount > 0 &&
                ` · ${formatBRL(conversao.quote.monthlyAmount)}/mês por ${conversao.quote.planMonths} meses`}
              {conversao.quote.leadTimeDays > 0 && ` · ${formatPrazo(conversao.quote.leadTimeDays)}`}
            </div>

            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 text-[11px] text-fg-faded">Início da execução</div>
                <input
                  type="date"
                  value={conversao.startDate}
                  onChange={(e) => setConversao({ ...conversao, startDate: e.target.value })}
                  className={`w-full ${inputClass}`}
                />
              </div>
              <div>
                <div className="mb-1.5 text-[11px] text-fg-faded">Forma de pagamento</div>
                <input
                  value={conversao.paymentMethod}
                  onChange={(e) => setConversao({ ...conversao, paymentMethod: e.target.value })}
                  placeholder="Ex: PIX, 3x no cartão"
                  className={`w-full ${inputClass}`}
                />
              </div>
              {temPlanoNaConversao && (
                <div className="sm:col-span-2">
                  <div className="mb-1.5 text-[11px] text-fg-faded">Primeira mensalidade</div>
                  <input
                    type="date"
                    value={conversao.planStartDate}
                    onChange={(e) => setConversao({ ...conversao, planStartDate: e.target.value })}
                    className={`w-full ${inputClass}`}
                  />
                </div>
              )}
            </div>

            <div className="mb-5 rounded-control border border-border bg-card-dark px-4 py-3 text-[12px] text-fg-tertiary">
              A prestação nasce <strong>Em andamento</strong> com pagamento <strong>Previsto</strong> — aprovar
              é acordo, não recebimento. O Financeiro recebe
              {conversao.quote.totalAmount > 0 && (
                <>
                  {' '}uma receita de{' '}
                  <strong className="text-accent">{formatBRL(conversao.quote.totalAmount)}</strong>
                  {entregaPrevista ? ` prevista para ${formatDateBR(entregaPrevista + 'T12:00:00')}` : ''}
                </>
              )}
              {conversao.quote.totalAmount > 0 && temPlanoNaConversao && ' e'}
              {temPlanoNaConversao && (
                <>
                  {' '}<strong>{conversao.quote.planMonths} parcelas</strong> de{' '}
                  <strong className="text-accent">{formatBRL(conversao.quote.monthlyAmount)}</strong>, de{' '}
                  {formatDateBR(conversao.planStartDate + 'T12:00:00')} a{' '}
                  {formatDateBR(
                    somarMeses(conversao.planStartDate, (conversao.quote.planMonths ?? 1) - 1) + 'T12:00:00'
                  )}
                </>
              )}
              . Marque cada uma como recebida quando o dinheiro entrar.
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setConversao(null)}
                disabled={pending}
                className="rounded-control border border-border-strong px-5 py-2.5 text-[13.5px] font-extrabold text-fg-secondary disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={converter}
                disabled={pending}
                className="rounded-control bg-accent px-6 py-2.5 text-[13.5px] font-extrabold text-page disabled:opacity-60"
              >
                {pending ? 'Gerando…' : 'Gerar prestação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
