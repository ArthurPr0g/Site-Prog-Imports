'use client';

import { useState, useMemo, useTransition } from 'react';
import { Pencil, Trash2, Plus, X, Search } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { formatBRL, parseNumeroBR, formatDateBR, formatNumeroInput } from '@/lib/format';
import {
  totalizarItens,
  calcularEntrega,
  computeServiceIndicators,
  valorDoContrato,
  somarMeses,
  formatPrazo,
  PLAN_MONTHS_OPTIONS,
  PLAN_MONTHS_DEFAULT,
  SERVICE_ORDER_STATUSES,
  SERVICE_PAYMENT_STATUSES,
  type InternalService,
  type ServiceOrder,
  type ServiceOrderItem,
  type ServiceOrderStatus,
  type ServicePaymentStatus,
} from '@/lib/services';
import { SEM_DESCONTO, temDesconto, aplicarDesconto, rotuloDoDesconto, type Desconto } from '@/lib/discount';
import { DescontoFields } from '@/components/admin/DescontoFields';
import { ParcelamentoFields } from '@/components/admin/ParcelamentoFields';
import { ParcelasList } from '@/components/admin/ParcelasList';
import { geraParcelas, calcularParcelamento, type Installment } from '@/lib/installments';
import { saveServiceOrderAction, deleteServiceOrderAction, type ServiceOrderInput } from '@/app/actions/service-orders';

const inputClass =
  'rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13.5px] outline-none focus:border-accent';

const COLUNAS = 'grid grid-cols-[1.7fr_1fr_120px_110px_120px_110px_70px] gap-2';

const VERDE = '#4ade80';
const CINZA = '#7a7a84';

/** "Em andamento" sai pelo accent da marca via CLASSE, porque o accent é
 *  configurável por loja (RFC-0001) e cravar o laranja aqui quebraria o tema de
 *  um cliente. Verde e cinza são semânticos, não de marca, e vão por style
 *  inline — mesmo padrão do Financeiro.
 *
 *  Interpolar a cor dentro da classe (`bg-[${VERDE}]`) NÃO funciona: o Tailwind
 *  varre o código como texto e não vê o valor da variável. */
const CLASSE_EM_ANDAMENTO = 'bg-[rgb(var(--brand-accent-rgb)/.12)] text-accent';

function estiloDoStatus(status: ServiceOrderStatus): { classe: string; style?: React.CSSProperties } {
  if (status === 'Em andamento') return { classe: CLASSE_EM_ANDAMENTO };
  const cor = status === 'Concluída' ? VERDE : CINZA;
  return { classe: '', style: { background: `${cor}1f`, color: cor } };
}

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function itemVazio(): ServiceOrderItem {
  return { internalServiceId: null, name: '', description: '', amount: 0, billingType: 'unico', leadTimeDays: 0 };
}

function formVazio(): ServiceOrderInput {
  return {
    customerId: null,
    title: '',
    notes: '',
    status: 'Em andamento',
    paymentStatus: 'Previsto',
    paymentMethod: '',
    startDate: hojeISO(),
    planMonths: PLAN_MONTHS_DEFAULT,
    planStartDate: '',
    desconto: SEM_DESCONTO,
    installmentCount: 2,
    downPayment: 0,
    interestPct: 0,
    firstDueDate: hojeISO(),
    installmentNotes: '',
    items: [itemVazio()],
  };
}

export function ServiceOrdersTable({
  orders,
  services,
  customers,
}: {
  orders: ServiceOrder[];
  services: InternalService[];
  customers: { id: string; name: string }[];
}) {
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState<ServiceOrderInput | null>(null);
  /** Carnê já gravado, só existente na edição. */
  const [parcelasDaEdicao, setParcelasDaEdicao] = useState<Installment[]>([]);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const ind = useMemo(() => computeServiceIndicators(orders), [orders]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return orders;
    return orders.filter((o) =>
      [o.title, o.customerName, o.status, ...o.items.map((i) => i.name)].some((c) =>
        c.toLowerCase().includes(termo)
      )
    );
  }, [orders, busca]);

  // Recalculado ao vivo com a MESMA função que a action usa para gravar, para
  // o que o dono vê no formulário não poder divergir do que vai para o banco.
  const totais = useMemo(() => totalizarItens(form?.items ?? []), [form]);
  const entrega = form ? calcularEntrega(form.startDate, totais.prazoDias) : null;

  const ativos = services.filter((s) => s.active);

  function salvar() {
    if (!form) return;
    startTransition(async () => {
      const result = await saveServiceOrderAction(form);
      toast(result);
      if (result.ok) {
        setForm(null);
        setParcelasDaEdicao([]);
      }
    });
  }

  function excluir(o: ServiceOrder) {
    if (!window.confirm(`Excluir a prestação "${o.title}"? O lançamento no Financeiro sai junto.`)) return;
    startTransition(async () => {
      toast(await deleteServiceOrderAction(o.id));
    });
  }

  function editar(o: ServiceOrder) {
    setForm({
      id: o.id,
      customerId: o.customerId,
      title: o.title,
      notes: o.notes,
      status: o.status,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      startDate: o.startDate,
      planMonths: o.planMonths ?? PLAN_MONTHS_DEFAULT,
      planStartDate: o.planStartDate ?? '',
      desconto: o.desconto,
      installmentCount: o.installmentCount || 2,
      downPayment: o.downPayment,
      interestPct: o.interestPct,
      firstDueDate: o.firstDueDate ?? hojeISO(),
      installmentNotes: o.installmentNotes,
      items: o.items.length ? o.items : [itemVazio()],
    });
    setParcelasDaEdicao(o.installments);
  }

  const set = <K extends keyof ServiceOrderInput>(campo: K, valor: ServiceOrderInput[K]) =>
    setForm((f) => (f ? { ...f, [campo]: valor } : f));

  const setDesconto = (patch: Partial<Desconto>) =>
    setForm((f) => (f ? { ...f, desconto: { ...f.desconto, ...patch } } : f));

  function setItem(indice: number, patch: Partial<ServiceOrderItem>) {
    setForm((f) =>
      f ? { ...f, items: f.items.map((it, i) => (i === indice ? { ...it, ...patch } : it)) } : f
    );
  }

  /** Escolher do catálogo copia nome, valor e prazo — não referencia. Preço de
   *  catálogo que muda depois não pode reescrever uma prestação já fechada. */
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
    { rotulo: 'Em andamento', valor: String(ind.emAndamento), nota: 'prestações' },
    { rotulo: 'Concluídas', valor: String(ind.concluidas), nota: 'prestações' },
    { rotulo: 'Recorrente', valor: `${formatBRL(ind.recorrenteMensal)}/mês`, nota: `${ind.planosAtivos} plano(s)` },
    { rotulo: 'Receita recebida', valor: formatBRL(ind.receitaRecebida), nota: 'já paga' },
    { rotulo: 'Valor em contratos', valor: formatBRL(ind.receitaPrevista), nota: 'trabalho + planos' },
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
          <Plus size={15} /> Nova prestação
        </button>
      </div>

      <div className="mb-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
          <div>Prestação</div>
          <div>Cliente</div>
          <div className="text-right">Valor</div>
          <div>Entrega</div>
          <div>Status</div>
          <div>Pagamento</div>
          <div className="text-right">Ações</div>
        </div>

        {filtrados.length === 0 && (
          <div className="py-5 text-[13px] text-fg-tertiary">
            {orders.length === 0
              ? 'Nenhuma prestação ainda. Ela nasce de um Orçamento de Serviços aprovado ou pode ser criada direto aqui.'
              : 'Nada encontrado para essa busca.'}
          </div>
        )}

        {filtrados.map((o) => (
          <div
            key={o.id}
            className={`${COLUNAS} items-center border-b border-divider py-2.5 text-[13px] last:border-b-0 ${
              o.status === 'Cancelada' ? 'opacity-55' : ''
            }`}
          >
            <div className="min-w-0">
              <div className="truncate font-bold">{o.title}</div>
              <div className="truncate text-[11.5px] text-fg-tertiary">
                {o.items.length} serviço(s)
                {o.leadTimeDays > 0 ? ` · ${formatPrazo(o.leadTimeDays)}` : ''}
                {o.planMonths ? ` · plano de ${o.planMonths} meses` : ''}
                {o.quoteId ? ' · veio de orçamento' : ''}
              </div>
            </div>
            <div className="truncate text-fg-secondary">{o.customerName || '—'}</div>
            {/* Valor único e mensalidade aparecem separados, como o contrato é
                lido — somar os dois apagaria quanto é recorrente. */}
            <div className="text-right font-bold">
              {o.totalAmount > 0 && (
                <>
                  {temDesconto(o.desconto) && (
                    <div className="text-[11px] font-normal text-fg-faded line-through">
                      {formatBRL(o.totalAmount)}
                    </div>
                  )}
                  <div className="text-accent">{formatBRL(aplicarDesconto(o.totalAmount, o.desconto))}</div>
                  {temDesconto(o.desconto) && (
                    <div className="text-[10.5px] font-bold text-accent">−{rotuloDoDesconto(o.desconto)}</div>
                  )}
                </>
              )}
              {o.monthlyAmount > 0 && (
                <div className={o.totalAmount > 0 ? 'text-[11.5px] text-fg-secondary' : 'text-accent'}>
                  {formatBRL(o.monthlyAmount)}/mês
                </div>
              )}
              {o.totalAmount === 0 && o.monthlyAmount === 0 && <span className="text-fg-tertiary">—</span>}
            </div>
            <div className="text-fg-secondary">{o.dueDate ? formatDateBR(o.dueDate + 'T12:00:00') : '—'}</div>
            <div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${estiloDoStatus(o.status).classe}`}
                style={estiloDoStatus(o.status).style}
              >
                {o.status}
              </span>
            </div>
            <div>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-extrabold"
                style={
                  o.paymentStatus === 'Recebido'
                    ? { background: `${VERDE}1f`, color: VERDE }
                    : { background: `${CINZA}1f`, color: CINZA }
                }
              >
                {o.paymentStatus}
              </span>
            </div>
            <div className="flex justify-end gap-1.5">
              <button
                onClick={() => editar(o)}
                disabled={pending}
                title="Editar"
                aria-label={`Editar ${o.title}`}
                className="grid h-7 w-7 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-accent hover:text-accent disabled:opacity-50"
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={() => excluir(o)}
                disabled={pending}
                title="Excluir"
                aria-label={`Excluir ${o.title}`}
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
          <div className="max-h-[92vh] w-full max-w-[900px] overflow-y-auto rounded-[20px] border border-border-strong bg-card p-7">
            <div className="mb-5 text-[15px] font-extrabold">
              {form.id ? 'Editar prestação' : 'Nova prestação'}
            </div>

            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Título da prestação *"
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
                <div className="mb-1.5 text-[11px] text-fg-faded">Início</div>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => set('startDate', e.target.value)}
                  className={`w-full ${inputClass}`}
                />
              </div>
            </div>

            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
                Serviços desta prestação
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
                    {/* Mensal é contínuo: não tem entrega, e um prazo aqui
                        empurraria a entrega do trabalho real para frente. */}
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
                <div className="px-3 py-2.5 text-[11.5px] font-bold text-fg-tertiary">
                  {entrega && totais.prazoDias > 0 ? `entrega em ${formatDateBR(entrega + 'T12:00:00')}` : ''}
                </div>
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

            <div className="mb-1.5 text-[11px] text-fg-faded">
              O prazo é a <strong>soma</strong> dos serviços, não o maior: eles são executados em sequência.
              Serviço mensal não entra no prazo — é contínuo.
            </div>

            <div className="mt-4">
              <DescontoFields desconto={form.desconto} base={totais.total} onChange={setDesconto} />
            </div>

            {totais.temPlano && (
              <div className="mb-4 rounded-control border border-accent/40 bg-[rgb(var(--brand-accent-rgb)/.05)] p-4">
                <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[.08em] text-accent">
                  Plano mensal
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                    <div className="mb-1.5 text-[11px] text-fg-faded">Primeira mensalidade</div>
                    <input
                      type="date"
                      value={form.planStartDate || form.startDate}
                      onChange={(e) => set('planStartDate', e.target.value)}
                      className={`w-full ${inputClass}`}
                    />
                  </div>
                  <div>
                    <div className="mb-1.5 text-[11px] text-fg-faded">Valor do contrato</div>
                    <div className="rounded-control border border-border bg-card-dark px-3.5 py-2.5 text-[13.5px] font-extrabold">
                      {formatBRL(valorDoContrato(totais, form.planMonths))}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-[11.5px] text-fg-tertiary">
                  O Financeiro recebe <strong>{form.planMonths} parcelas</strong> de{' '}
                  <strong className="text-accent">{formatBRL(totais.mensal)}</strong>, de{' '}
                  {formatDateBR((form.planStartDate || form.startDate) + 'T12:00:00')} a{' '}
                  {formatDateBR(somarMeses(form.planStartDate || form.startDate, (form.planMonths ?? 1) - 1) + 'T12:00:00')}
                  , todas como Previsto. Cada uma é baixada no Financeiro quando o mês entra.
                </div>
              </div>
            )}

            <div className="mt-4">
              <ParcelamentoFields
                condicoes={{
                  paymentMethod: form.paymentMethod,
                  installmentCount: form.installmentCount,
                  downPayment: form.downPayment,
                  interestPct: form.interestPct,
                  firstDueDate: form.firstDueDate,
                  installmentNotes: form.installmentNotes,
                }}
                // Só o trabalho entra no carnê: a mensalidade do plano tem
                // ciclo próprio e já vira parcela por conta dela.
                total={aplicarDesconto(totais.total, form.desconto)}
                onChange={(patch) => setForm((f) => (f ? { ...f, ...patch } : f))}
              />
            </div>

            {!geraParcelas(form.paymentMethod) && totais.total > 0 && (
              <div className="mb-4 rounded-control border border-border bg-card-dark px-4 py-3 text-[12px] text-fg-tertiary">
                Sem parcelamento, vale o padrão do contrato: <strong>50% na contratação</strong> e{' '}
                <strong>50% na entrega</strong>. O Financeiro recebe o valor do trabalho numa linha só, e o
                controle das duas metades fica com você.
              </div>
            )}

            {parcelasDaEdicao.length > 0 && (
              <div className="mb-4">
                <ParcelasList
                  parcelas={parcelasDaEdicao}
                  // Com juros o carnê cobra mais que o trabalho; é essa soma que
                  // ele tem que fechar, não o valor puro dos serviços.
                  totalEsperado={
                    calcularParcelamento({
                      total: aplicarDesconto(totais.total, form.desconto),
                      parcelas: form.installmentCount,
                      entrada: form.downPayment,
                      jurosPct: form.interestPct,
                      primeiroVencimento: form.firstDueDate,
                    }).totalComJuros
                  }
                />
              </div>
            )}

            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 text-[11px] text-fg-faded">Status da execução</div>
                <select
                  value={form.status}
                  onChange={(e) => set('status', e.target.value as ServiceOrderStatus)}
                  className={`w-full ${inputClass}`}
                >
                  {SERVICE_ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="mb-1.5 text-[11px] text-fg-faded">Pagamento</div>
                <select
                  value={form.paymentStatus}
                  onChange={(e) => set('paymentStatus', e.target.value as ServicePaymentStatus)}
                  className={`w-full ${inputClass}`}
                  disabled={geraParcelas(form.paymentMethod)}
                >
                  {SERVICE_PAYMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {geraParcelas(form.paymentMethod) && (
                  <div className="mt-1.5 text-[10.5px] text-fg-faded">
                    Com parcelamento, quem manda no caixa é o status de cada parcela.
                  </div>
                )}
              </div>
              <textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Observações"
                rows={2}
                className={`resize-none sm:col-span-3 ${inputClass}`}
              />
            </div>

            <div className="mb-5 rounded-control border border-border bg-card-dark px-4 py-3 text-[12px] text-fg-tertiary">
              {form.status === 'Cancelada' ? (
                <>Prestação cancelada <strong>não lança nada</strong> no Financeiro — e os lançamentos existentes são removidos ao salvar.</>
              ) : (
                <>
                  Ao salvar, o Financeiro recebe
                  {totais.total > 0 && (
                    <>
                      {' '}<strong>uma receita</strong> de{' '}
                      <strong className="text-accent">{formatBRL(aplicarDesconto(totais.total, form.desconto))}</strong>
                      {temDesconto(form.desconto) && ' (já com desconto)'} como{' '}
                      <strong>{form.paymentStatus === 'Recebido' ? 'Pago' : 'Previsto'}</strong>
                      {entrega ? ` em ${formatDateBR(entrega + 'T12:00:00')}` : ''}
                    </>
                  )}
                  {totais.total > 0 && totais.temPlano && ' e'}
                  {totais.temPlano && (
                    <>
                      {' '}<strong>{form.planMonths} parcelas</strong> de{' '}
                      <strong className="text-accent">{formatBRL(totais.mensal)}</strong>
                    </>
                  )}
                  . Esses lançamentos acompanham a prestação — no Financeiro só dá para marcar se já foram
                  recebidos.
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
