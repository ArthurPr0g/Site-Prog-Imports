'use client';

import { useState, useTransition } from 'react';
import { Check, Pencil, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatBRL, formatDateBR, formatNumeroInput, parseNumeroBR } from '@/lib/format';
import {
  statusExibido,
  resumirParcelas,
  rotuloDaParcela,
  divergenciaDoCarne,
  somaDoCarne,
  INSTALLMENT_STATUSES,
  type Installment,
  type InstallmentStatus,
  type InstallmentStatusExibido,
} from '@/lib/installments';
import {
  updateInstallmentAction,
  deleteInstallmentAction,
  toggleInstallmentReceivedAction,
  regenerateInstallmentsAction,
} from '@/app/actions/installments';
import type { SourceType } from '@/lib/data/installments';

const inputClass =
  'rounded-control border border-border-strong bg-input px-3 py-2 text-[13px] outline-none focus:border-accent';

const VERDE = '#4ade80';
const VERMELHO = '#e05555';
const AMARELO = '#d9a441';
const CINZA = '#7a7a84';

const COR: Record<InstallmentStatusExibido, string> = {
  Pendente: AMARELO,
  Recebida: VERDE,
  Atrasada: VERMELHO,
  Cancelada: CINZA,
};

/** Colunas com e sem a origem. Sem origem sobra espaço para a observação; com
 *  origem ela sai, porque saber de qual venda a parcela veio importa mais numa
 *  lista que mistura carnês de vendas e serviços. */
const COLUNAS = '70px 112px 112px 108px 1fr 92px';
const COLUNAS_COM_ORIGEM = 'minmax(0,1.4fr) 70px 112px 112px 108px 92px';

/** Rótulo e tamanho do carnê de cada parcela, por id. Só a lista consolidada do
 *  cliente precisa disso — na venda todas as parcelas são da mesma venda. */
export type OrigemDaParcela = { rotulo: string; totalDoGrupo: number };

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Edicao = Installment & { valorTexto: string };

/** O carnê: dá baixa, corrige valor e vencimento, cancela e exclui parcela a
 *  parcela. Serve tanto ao carnê de uma venda quanto à lista consolidada do
 *  cliente, que mistura várias origens. */
export function ParcelasList({
  parcelas,
  origens,
  totalEsperado,
  titulo,
  origemDoCarne,
}: {
  parcelas: Installment[];
  origens?: Record<string, OrigemDaParcela>;
  /** Quanto o carnê deveria somar, com juros. Sem isto a conferência não roda. */
  totalEsperado?: number;
  titulo?: string;
  /** De onde refazer o carnê. Só quem tem uma origem única pode oferecer isso —
   *  a lista consolidada do cliente mistura várias. */
  origemDoCarne?: { tipo: SourceType; sourceId: string };
}) {
  const [editando, setEditando] = useState<Edicao | null>(null);
  const [excluindo, setExcluindo] = useState<Installment | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  if (parcelas.length === 0) return null;

  const hoje = hojeISO();
  const resumo = resumirParcelas(parcelas, hoje);
  const totalParcelas = parcelas.filter((p) => p.number > 0).length;
  const comOrigem = !!origens;
  const colunas = comOrigem ? COLUNAS_COM_ORIGEM : COLUNAS;

  // Só confere quando alguém disse quanto era para dar. Divergência é normal
  // logo depois de uma edição manual — o aviso existe para ela não passar
  // despercebida, não para impedir.
  const divergencia = totalEsperado === undefined ? 0 : divergenciaDoCarne(parcelas, totalEsperado);

  function baixar(p: Installment) {
    if (!p.id) return;
    startTransition(async () => {
      toast(await toggleInstallmentReceivedAction(p.id!));
    });
  }

  function refazer() {
    if (!origemDoCarne) return;
    startTransition(async () => {
      toast(await regenerateInstallmentsAction(origemDoCarne));
    });
  }

  function abrirEdicao(p: Installment) {
    setEditando({ ...p, valorTexto: formatNumeroInput(p.amount) });
  }

  function salvarEdicao() {
    if (!editando?.id) return;
    startTransition(async () => {
      const result = await updateInstallmentAction({
        id: editando.id!,
        amount: parseNumeroBR(editando.valorTexto),
        status: editando.status,
        dueDate: editando.dueDate,
        notes: editando.notes,
      });
      toast(result);
      if (result.ok) setEditando(null);
    });
  }

  function confirmarExclusao() {
    if (!excluindo?.id) return;
    startTransition(async () => {
      const result = await deleteInstallmentAction(excluindo.id!);
      toast(result);
      if (result.ok) setExcluindo(null);
    });
  }

  const nomeDaParcela = (p: Installment) =>
    p.number === 0 ? 'Entrada' : `Parcela ${p.number}`;

  return (
    <div className="rounded-control border border-border bg-card-dark p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
          {titulo ?? `Parcelas (${totalParcelas}×)`}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px]">
          <span className="text-fg-tertiary">
            Recebido <strong style={{ color: VERDE }}>{formatBRL(resumo.recebido)}</strong>
          </span>
          <span className="text-fg-tertiary">
            A receber <strong className="text-fg-secondary">{formatBRL(resumo.aReceber)}</strong>
          </span>
          {resumo.qtdAtrasadas > 0 && (
            <span className="text-fg-tertiary">
              Atrasado{' '}
              <strong style={{ color: VERMELHO }}>
                {formatBRL(resumo.atrasado)} ({resumo.qtdAtrasadas})
              </strong>
            </span>
          )}
          {resumo.proximoVencimento && (
            <span className="text-fg-tertiary">
              Próximo vencimento{' '}
              <strong className="text-fg-secondary">
                {formatDateBR(resumo.proximoVencimento + 'T12:00:00')}
              </strong>
            </span>
          )}
        </div>
      </div>

      {divergencia !== 0 && (
        <div
          className="mb-3 rounded-control border px-3.5 py-2.5 text-[12px]"
          style={{ borderColor: `${AMARELO}66`, background: `${AMARELO}12`, color: AMARELO }}
        >
          <strong>O carnê não fecha com o valor devido.</strong> As parcelas somam{' '}
          {formatBRL(somaDoCarne(parcelas))} e deveriam somar {formatBRL(totalEsperado ?? 0)} —{' '}
          {divergencia > 0 ? 'sobram' : 'faltam'} {formatBRL(Math.abs(divergencia))}. Isso é normal
          logo depois de um ajuste manual; corrija alguma parcela
          {origemDoCarne ? ' ou refaça o carnê pelas condições da venda.' : '.'}
          {origemDoCarne && (
            <button
              onClick={refazer}
              disabled={pending}
              className="ml-2 inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1 text-[11.5px] font-extrabold disabled:opacity-60"
              style={{ borderColor: `${AMARELO}88` }}
            >
              <RotateCcw size={11} /> {pending ? 'Refazendo…' : 'Refazer carnê'}
            </button>
          )}
        </div>
      )}

      <div
        className="grid gap-2 border-b border-divider pb-2 text-[10.5px] font-extrabold uppercase tracking-[.06em] text-fg-faded"
        style={{ gridTemplateColumns: colunas }}
      >
        {comOrigem && <div>Origem</div>}
        <div>Parcela</div>
        <div className="text-right">Valor</div>
        <div>Vencimento</div>
        <div>Status</div>
        {!comOrigem && <div>Observação</div>}
        <div className="text-right">Ações</div>
      </div>

      {parcelas.map((p) => {
        const s = statusExibido(p, hoje);
        const origem = p.id ? origens?.[p.id] : undefined;
        return (
          <div
            key={p.id ?? p.number}
            className={`grid items-center gap-2 border-b border-divider py-2 text-[12.5px] last:border-b-0 ${
              p.status === 'Cancelada' ? 'opacity-55' : ''
            }`}
            style={{ gridTemplateColumns: colunas }}
          >
            {comOrigem && (
              <div className="min-w-0 truncate font-bold" title={origem?.rotulo}>
                {origem?.rotulo ?? '—'}
              </div>
            )}
            <div className={comOrigem ? 'text-fg-secondary' : 'font-bold'}>
              {rotuloDaParcela(p, origem?.totalDoGrupo ?? totalParcelas)}
            </div>
            <div className="text-right font-bold">{formatBRL(p.amount)}</div>
            <div className="text-fg-secondary">{formatDateBR(p.dueDate + 'T12:00:00')}</div>
            <div>
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-extrabold"
                style={{ background: `${COR[s]}1f`, color: COR[s] }}
              >
                {s}
              </span>
            </div>
            {!comOrigem && (
              <div className="min-w-0 truncate text-[11.5px] text-fg-tertiary">{p.notes || '—'}</div>
            )}
            <div className="flex justify-end gap-1.5">
              <button
                onClick={() => baixar(p)}
                disabled={pending || p.status === 'Cancelada' || !p.id}
                title={p.status === 'Recebida' ? 'Desfazer recebimento' : 'Marcar como recebida'}
                aria-label={`${p.status === 'Recebida' ? 'Desfazer recebimento da' : 'Marcar como recebida a'} parcela ${p.number}`}
                className="grid h-6 w-6 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-accent hover:text-accent disabled:opacity-30"
              >
                {p.status === 'Recebida' ? <Undo2 size={11} /> : <Check size={11} />}
              </button>
              <button
                onClick={() => abrirEdicao(p)}
                disabled={pending || !p.id}
                title="Editar parcela"
                aria-label={`Editar parcela ${p.number}`}
                className="grid h-6 w-6 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-accent hover:text-accent disabled:opacity-30"
              >
                <Pencil size={11} />
              </button>
              <button
                onClick={() => setExcluindo(p)}
                disabled={pending || !p.id}
                title="Excluir parcela"
                aria-label={`Excluir parcela ${p.number}`}
                className="grid h-6 w-6 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-error hover:text-error disabled:opacity-30"
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        );
      })}

      {editando && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[460px] rounded-[20px] border border-border-strong bg-card p-7">
            <div className="mb-1 text-[15px] font-extrabold">{nomeDaParcela(editando)}</div>
            <div className="mb-5 text-[12.5px] text-fg-tertiary">
              {editando.id && origens?.[editando.id]
                ? origens[editando.id].rotulo
                : 'Valor, vencimento e status desta parcela.'}
            </div>

            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 text-[11px] text-fg-faded">Valor (R$)</div>
                <input
                  inputMode="decimal"
                  value={editando.valorTexto}
                  onChange={(e) => setEditando({ ...editando, valorTexto: e.target.value })}
                  placeholder="0,00"
                  className={`w-full ${inputClass}`}
                />
              </div>
              <div>
                <div className="mb-1.5 text-[11px] text-fg-faded">Vencimento</div>
                <input
                  type="date"
                  value={editando.dueDate}
                  onChange={(e) => setEditando({ ...editando, dueDate: e.target.value })}
                  className={`w-full ${inputClass}`}
                />
              </div>
              <div className="sm:col-span-2">
                <div className="mb-1.5 text-[11px] text-fg-faded">Status</div>
                <select
                  value={editando.status}
                  onChange={(e) => setEditando({ ...editando, status: e.target.value as InstallmentStatus })}
                  className={`w-full ${inputClass}`}
                >
                  {INSTALLMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <input
                value={editando.notes}
                onChange={(e) => setEditando({ ...editando, notes: e.target.value })}
                placeholder="Observação desta parcela"
                className={`sm:col-span-2 ${inputClass}`}
              />
            </div>

            <div className="mb-5 text-[11.5px] text-fg-faded">
              &quot;Atrasada&quot; não é escolhido: aparece sozinho quando o vencimento passa e a parcela
              continua pendente. Mudar o valor aqui não muda o total da venda — se as duas coisas
              tiverem que mudar, corrija a venda também.
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setEditando(null)}
                disabled={pending}
                className="rounded-control border border-border-strong px-5 py-2.5 text-[13.5px] font-extrabold text-fg-secondary disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={salvarEdicao}
                disabled={pending}
                className="rounded-control bg-accent px-6 py-2.5 text-[13.5px] font-extrabold text-page disabled:opacity-60"
              >
                {pending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        aberto={!!excluindo}
        titulo="Excluir esta parcela?"
        descricao={
          excluindo?.status === 'Recebida'
            ? 'Ela já foi recebida: o valor sai da receita do Financeiro e o cliente passa a dever menos. As outras parcelas não mudam.'
            : 'Ela sai do carnê e do Financeiro. As outras parcelas não mudam — o valor dela não é redistribuído.'
        }
        detalhe={
          excluindo && (
            <>
              <strong>{nomeDaParcela(excluindo)}</strong> · {formatBRL(excluindo.amount)} · vence em{' '}
              {formatDateBR(excluindo.dueDate + 'T12:00:00')}
              {excluindo.id && origens?.[excluindo.id] && (
                <div className="mt-1 text-fg-tertiary">{origens[excluindo.id].rotulo}</div>
              )}
            </>
          )
        }
        pending={pending}
        onConfirmar={confirmarExclusao}
        onCancelar={() => setExcluindo(null)}
      />
    </div>
  );
}
