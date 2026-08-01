'use client';

import { useState, useMemo, useTransition } from 'react';
import { Pencil, Trash2, Plus, Minus } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { formatBRL, parseNumeroBR, formatDateBR } from '@/lib/format';
import {
  resolverPeriodo,
  dentroDoPeriodo,
  computeFinanceIndicators,
  fluxoMensal,
  rotuloStatus,
  FINANCE_STATUSES,
  type FinanceEntry,
  type FinanceKind,
  type FinanceStatus,
} from '@/lib/finance';
import { saveFinanceEntryAction, deleteFinanceEntryAction, type FinanceFormInput } from '@/app/actions/finance';

const inputClass =
  'rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13.5px] outline-none focus:border-accent';

const VERDE = '#4ade80';
const VERMELHO = '#e05555';

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formVazio(kind: FinanceKind): FinanceFormInput {
  return { kind, description: '', amount: 0, entryDate: hojeISO(), status: 'Pago' };
}

const COLUNAS = 'grid grid-cols-[1.7fr_110px_100px_110px_70px] gap-2';

/** Declarada fora do FinanceBoard de propósito: componente criado dentro do
 *  render é recriado a cada tecla digitada no formulário, e cada linha da
 *  tabela remontaria junto. */
function TabelaLancamentos({
  titulo,
  lista,
  cor,
  pending,
  onEditar,
  onExcluir,
}: {
  titulo: string;
  lista: FinanceEntry[];
  cor: string;
  pending: boolean;
  onEditar: (e: FinanceEntry) => void;
  onExcluir: (e: FinanceEntry) => void;
}) {
  return (
    <div className="rounded-[18px] border border-border bg-card p-6">
      <div className="mb-3.5 text-[15px] font-extrabold">{titulo}</div>
      <div className={`${COLUNAS} border-b border-border pb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded`}>
        <div>Descrição</div>
        <div className="text-right">Valor</div>
        <div>Data</div>
        <div>Status</div>
        <div className="text-right">Ações</div>
      </div>
      {lista.length === 0 && <div className="py-5 text-[13px] text-fg-tertiary">Nada no período.</div>}
      {lista.map((e) => (
        <div
          key={e.id}
          className={`${COLUNAS} items-center border-b border-divider py-2.5 text-[13px] last:border-b-0`}
        >
          <div className="min-w-0">
            <div className="truncate font-bold">{e.description}</div>
            {e.source !== 'manual' && (
              <div className="text-[11px] text-fg-faded">gerado por {e.source === 'venda' ? 'venda' : 'serviço'}</div>
            )}
          </div>
          <div className="text-right font-bold" style={{ color: cor }}>{formatBRL(e.amount)}</div>
          <div className="text-fg-secondary">{formatDateBR(e.entryDate + 'T12:00:00')}</div>
          <div>
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-extrabold"
              style={{
                background: e.status === 'Pago' ? `${cor}1a` : '#a8a8b01a',
                color: e.status === 'Pago' ? cor : '#a8a8b0',
              }}
            >
              {rotuloStatus(e.kind, e.status)}
            </span>
          </div>
          <div className="flex justify-end gap-1.5">
            <button
              onClick={() => onEditar(e)}
              disabled={pending}
              title="Editar"
              aria-label={`Editar ${e.description}`}
              className="grid h-7 w-7 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-accent hover:text-accent disabled:opacity-50"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={() => onExcluir(e)}
              disabled={pending}
              title="Excluir"
              aria-label={`Excluir ${e.description}`}
              className="grid h-7 w-7 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-error hover:text-error disabled:opacity-50"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function FinanceBoard({ entries }: { entries: FinanceEntry[] }) {
  const [tudo, setTudo] = useState(false);
  const [ano, setAno] = useState<number | null>(null);
  const [mes, setMes] = useState<number | null>(null);
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [form, setForm] = useState<FinanceFormInput | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  // A lista já vem ordenada por data decrescente do servidor, então os extremos
  // do livro estão nas pontas — não precisa de consulta separada para o "Tudo".
  const limites = useMemo(
    () => ({ primeira: entries.at(-1)?.entryDate, ultima: entries[0]?.entryDate }),
    [entries]
  );

  const periodo = useMemo(
    () => resolverPeriodo({ tudo, ano, mes, inicio, fim }, new Date(), limites),
    [tudo, ano, mes, inicio, fim, limites]
  );

  const doPeriodo = useMemo(() => entries.filter((e) => dentroDoPeriodo(e, periodo)), [entries, periodo]);
  const ind = useMemo(() => computeFinanceIndicators(doPeriodo), [doPeriodo]);

  // O gráfico é de um ano só: "março" apareceria duas vezes sem distinção se
  // misturasse anos. Usa o ano do filtro quando há um, senão o corrente.
  const anoDoGrafico = ano ?? new Date().getFullYear();
  const fluxo = useMemo(() => fluxoMensal(entries, anoDoGrafico), [entries, anoDoGrafico]);
  const maiorBarra = Math.max(...fluxo.flatMap((p) => [p.entradas, p.saidas]), 1);

  const anosDisponiveis = useMemo(() => {
    const anos = new Set(entries.map((e) => Number(e.entryDate.slice(0, 4))));
    anos.add(new Date().getFullYear());
    return [...anos].sort((a, b) => b - a);
  }, [entries]);

  const receitas = doPeriodo.filter((e) => e.kind === 'receita');
  const despesas = doPeriodo.filter((e) => e.kind === 'despesa');
  const temFiltro = tudo || ano !== null || mes !== null || !!inicio || !!fim;

  function limparFiltro() {
    setTudo(false); setAno(null); setMes(null); setInicio(''); setFim('');
  }

  // Os campos de período se anulam: escolher ano precisa desmarcar "Tudo",
  // senão o usuário mexe num filtro e o resultado não muda, sem explicação.
  function escolherAno(v: string) { setTudo(false); setAno(v ? Number(v) : null); }
  function escolherMes(v: string) { setTudo(false); setMes(v ? Number(v) : null); }
  function escolherData(qual: 'inicio' | 'fim', v: string) {
    setTudo(false); setAno(null); setMes(null);
    if (qual === 'inicio') setInicio(v); else setFim(v);
  }

  function salvar() {
    if (!form) return;
    startTransition(async () => {
      const result = await saveFinanceEntryAction(form);
      toast(result.message);
      if (result.ok) setForm(null);
    });
  }

  function editar(e: FinanceEntry) {
    setForm({
      id: e.id,
      kind: e.kind,
      description: e.description,
      amount: e.amount,
      entryDate: e.entryDate,
      status: e.status,
    });
  }

  function excluir(e: FinanceEntry) {
    if (!window.confirm(`Excluir "${e.description}"?`)) return;
    startTransition(async () => {
      const result = await deleteFinanceEntryAction(e.id);
      toast(result.message);
    });
  }

  const set = <K extends keyof FinanceFormInput>(campo: K, valor: FinanceFormInput[K]) =>
    setForm((f) => (f ? { ...f, [campo]: valor } : f));

  const cards = [
    { rotulo: 'Receita no período', valor: ind.receitaReal, cor: VERDE },
    { rotulo: 'Despesa no período', valor: ind.despesaReal, cor: VERMELHO },
    { rotulo: 'Resultado no período', valor: ind.resultadoReal, cor: ind.resultadoReal >= 0 ? VERDE : VERMELHO },
    { rotulo: 'Receita prevista', valor: ind.receitaPrevista, cor: undefined },
    { rotulo: 'Despesa prevista', valor: ind.despesaPrevista, cor: undefined },
    { rotulo: 'Resultado previsto', valor: ind.resultadoPrevisto, cor: undefined },
  ];

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-end gap-2.5">
        <div>
          <div className="mb-1.5 text-[11px] text-fg-faded">Data início</div>
          <input type="date" value={inicio} onChange={(e) => escolherData('inicio', e.target.value)} className={inputClass} />
        </div>
        <div>
          <div className="mb-1.5 text-[11px] text-fg-faded">Data fim</div>
          <input type="date" value={fim} onChange={(e) => escolherData('fim', e.target.value)} className={inputClass} />
        </div>
        <div>
          <div className="mb-1.5 text-[11px] text-fg-faded">Ano</div>
          <select value={ano ?? ''} onChange={(e) => escolherAno(e.target.value)} className={inputClass}>
            <option value="">Todos</option>
            {anosDisponiveis.map((a) => (<option key={a} value={a}>{a}</option>))}
          </select>
        </div>
        <div>
          <div className="mb-1.5 text-[11px] text-fg-faded">Mês</div>
          <select value={mes ?? ''} onChange={(e) => escolherMes(e.target.value)} className={inputClass}>
            <option value="">Todos</option>
            {MESES_CURTOS.map((m, i) => (<option key={m} value={i + 1}>{m}</option>))}
          </select>
        </div>
        <button
          onClick={() => { limparFiltro(); setTudo(true); }}
          className={`rounded-control border px-4 py-2.5 text-[13.5px] font-bold transition-colors ${tudo ? 'border-accent text-accent' : 'border-border-strong text-fg-secondary hover:border-accent hover:text-accent'}`}
        >
          Tudo
        </button>
        {temFiltro && (
          <button onClick={limparFiltro} className="px-1 py-2.5 text-[13px] font-bold text-fg-tertiary hover:text-accent">
            Limpar
          </button>
        )}
        <div className="ml-auto flex gap-2.5">
          <button
            onClick={() => setForm(formVazio('receita'))}
            className="flex items-center gap-1.5 rounded-control bg-accent px-5 py-2.5 text-[13.5px] font-extrabold text-page transition-all hover:-translate-y-0.5"
          >
            <Plus size={15} /> Receita
          </button>
          <button
            onClick={() => setForm(formVazio('despesa'))}
            className="flex items-center gap-1.5 rounded-control border border-border-strong px-5 py-2.5 text-[13.5px] font-extrabold text-fg-secondary hover:border-error hover:text-error"
          >
            <Minus size={15} /> Despesa
          </button>
        </div>
      </div>

      <div className="mb-3.5 text-[12.5px] text-fg-tertiary">
        Período: <strong className="text-fg-secondary">{periodo.rotulo}</strong> ({formatDateBR(periodo.inicio + 'T12:00:00')} a {formatDateBR(periodo.fim + 'T12:00:00')})
      </div>

      <div className="mb-3.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.rotulo} className="rounded-[18px] border border-border bg-card px-5 py-4">
            <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">{c.rotulo}</div>
            <div className="text-[22px] font-extrabold" style={c.cor ? { color: c.cor } : undefined}>
              {formatBRL(c.valor)}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-3.5 rounded-[18px] border border-border bg-card p-6">
        <div className="mb-1 text-[15px] font-extrabold">Fluxo de caixa mensal</div>
        <div className="mb-4 text-[12.5px] text-fg-tertiary">
          {anoDoGrafico} · só lançamentos já movimentados
        </div>
        <div className="flex h-[180px] items-end gap-2">
          {fluxo.map((p) => (
            <div key={p.mes} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-[150px] w-full items-end justify-center gap-0.5">
                <div
                  className="w-1/2 rounded-t-[3px] transition-all"
                  style={{ height: `${(p.entradas / maiorBarra) * 100}%`, background: VERDE, minHeight: p.entradas > 0 ? 2 : 0 }}
                  title={`Entradas em ${p.mes}: ${formatBRL(p.entradas)}`}
                />
                <div
                  className="w-1/2 rounded-t-[3px] transition-all"
                  style={{ height: `${(p.saidas / maiorBarra) * 100}%`, background: VERMELHO, minHeight: p.saidas > 0 ? 2 : 0 }}
                  title={`Saídas em ${p.mes}: ${formatBRL(p.saidas)}`}
                />
              </div>
              <div className="text-[10.5px] text-fg-faded">{p.mes}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-2">
        <TabelaLancamentos titulo="Receitas" lista={receitas} cor={VERDE} pending={pending} onEditar={editar} onExcluir={excluir} />
        <TabelaLancamentos titulo="Despesas" lista={despesas} cor={VERMELHO} pending={pending} onEditar={editar} onExcluir={excluir} />
      </div>

      {form && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[520px] rounded-[20px] border border-border-strong bg-card p-7">
            <div className="mb-5 text-[15px] font-extrabold">
              {form.id ? 'Editar lançamento' : form.kind === 'receita' ? 'Nova receita' : 'Nova despesa'}
            </div>
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Descrição *"
                className={`sm:col-span-2 ${inputClass}`}
              />
              <div>
                <div className="mb-1.5 text-[11px] text-fg-faded">Valor (R$)</div>
                <input
                  defaultValue={form.amount || ''}
                  onChange={(e) => set('amount', parseNumeroBR(e.target.value))}
                  inputMode="decimal"
                  placeholder="0,00"
                  className={`w-full ${inputClass}`}
                />
              </div>
              <div>
                <div className="mb-1.5 text-[11px] text-fg-faded">Data</div>
                <input type="date" value={form.entryDate} onChange={(e) => set('entryDate', e.target.value)} className={`w-full ${inputClass}`} />
              </div>
              <div className="sm:col-span-2">
                <div className="mb-1.5 text-[11px] text-fg-faded">Status</div>
                <select value={form.status} onChange={(e) => set('status', e.target.value as FinanceStatus)} className={`w-full ${inputClass}`}>
                  {FINANCE_STATUSES.map((s) => (
                    <option key={s} value={s}>{rotuloStatus(form.kind, s)}</option>
                  ))}
                </select>
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
