'use client';

import { useRef, useState, useTransition } from 'react';
import { Check, CircleCheck, ListChecks, Pencil, Trash2, Wand2, X } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  dataCurta,
  ordenarAtividades,
  quandoDaAtividade,
  situacao,
  type Atividade,
  type Modelo,
  type Situacao,
} from '@/lib/atividades';
import {
  aplicarModeloAction,
  concluirPrestacaoAction,
  excluirAtividadeAction,
  marcarAtividadeAction,
  salvarAtividadeAction,
} from '@/app/actions/atividades';

const inputClass =
  'rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13.5px] outline-none focus:border-accent';

const COR: Record<Situacao, string> = {
  atrasada: 'text-error bg-error/12',
  hoje: 'text-warning bg-warning/12',
  programada: 'text-info bg-info/12',
  feita: 'text-success bg-success/12',
};

export type PrestacaoResumo = { id: string; title: string; customerName: string; startDate: string; status: string };

export function AtividadesModal({
  prestacao,
  atividades,
  modelos,
  hoje,
  perguntarAoAbrir = false,
  onFechar,
}: {
  prestacao: PrestacaoResumo;
  atividades: Atividade[];
  modelos: Modelo[];
  hoje: string;
  /** Abre já perguntando se a prestação pode ser finalizada (vindo do Painel). */
  perguntarAoAbrir?: boolean;
  onFechar: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const [editando, setEditando] = useState<{ id: string; titulo: string; data: string; notas: string } | null>(null);
  const [novo, setNovo] = useState({ titulo: '', data: hoje, notas: '' });
  const [apagar, setApagar] = useState<Atividade | null>(null);
  const [perguntarFim, setPerguntarFim] = useState(
    () =>
      perguntarAoAbrir &&
      atividades.length > 0 &&
      atividades.every((a) => a.feita) &&
      prestacao.status !== 'Concluída' &&
      prestacao.status !== 'Cancelada'
  );
  const [modeloId, setModeloId] = useState(modelos[0]?.id ?? '');
  const [inicioModelo, setInicioModelo] = useState(prestacao.startDate || hoje);
  const novoRef = useRef<HTMLInputElement>(null);

  const lista = ordenarAtividades(atividades);
  const feitas = atividades.filter((a) => a.feita).length;
  const pct = atividades.length ? Math.round((feitas / atividades.length) * 100) : 0;
  const atrasadas = atividades.filter((a) => situacao(a, hoje) === 'atrasada').length;
  const modelo = modelos.find((m) => m.id === modeloId);

  function adicionar() {
    startTransition(async () => {
      const r = await salvarAtividadeAction({ prestacaoId: prestacao.id, ...novo });
      toast(r);
      if (r.ok) {
        setNovo({ titulo: '', data: novo.data, notas: '' });
        novoRef.current?.focus();
      }
    });
  }

  function salvarEdicao() {
    if (!editando) return;
    startTransition(async () => {
      const r = await salvarAtividadeAction({ prestacaoId: prestacao.id, ...editando });
      toast(r);
      if (r.ok) setEditando(null);
    });
  }

  function marcar(a: Atividade) {
    startTransition(async () => {
      const r = await marcarAtividadeAction(a.id, !a.feita);
      if (!r.ok) return toast(r);
      // Última atividade feita: pergunta antes de oferecer finalizar a prestação
      if (r.todasFeitas && prestacao.status !== 'Concluída' && prestacao.status !== 'Cancelada') setPerguntarFim(true);
    });
  }

  function excluir() {
    if (!apagar) return;
    startTransition(async () => {
      const r = await excluirAtividadeAction(apagar.id);
      toast(r);
      setApagar(null);
    });
  }

  function aplicarModelo() {
    if (!modeloId) return;
    startTransition(async () => toast(await aplicarModeloAction(prestacao.id, modeloId, inicioModelo)));
  }

  function finalizar() {
    startTransition(async () => {
      const r = await concluirPrestacaoAction(prestacao.id);
      toast(r);
      setPerguntarFim(false);
    });
  }

  // As confirmações ficam FORA do fundo do modal: clique nelas subiria pela
  // árvore do React até o onClick do fundo e fecharia tudo.
  return (
    <>
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onFechar} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Atividades de ${prestacao.title}`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-[760px] overflow-y-auto rounded-[20px] border border-border-strong bg-card p-6 sm:p-7"
      >
        {/* Cabeçalho */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.12em] text-fg-tertiary">
              <ListChecks size={14} /> Atividades
            </div>
            <div className="mt-1 truncate text-[17px] font-extrabold">{prestacao.title}</div>
            {prestacao.customerName && <div className="text-[12.5px] text-fg-tertiary">{prestacao.customerName}</div>}
          </div>
          <button onClick={onFechar} aria-label="Fechar" className="grid h-8 w-8 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:text-fg">
            <X size={15} />
          </button>
        </div>

        {/* Progresso */}
        <div className="mb-5 rounded-[14px] border border-border bg-card-dark p-4">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
            <span>
              <b className="text-[15px]">{feitas}</b> de {atividades.length} feita{atividades.length === 1 ? '' : 's'}
            </span>
            <span className="text-[12px] font-bold">
              {atrasadas > 0 ? <span className="text-error">{atrasadas} atrasada{atrasadas > 1 ? 's' : ''}</span> : atividades.length ? <span className="text-fg-tertiary">{pct}%</span> : null}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-divider">
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Aplicar modelo */}
        <div className="mb-5 rounded-[14px] border border-dashed border-border-strong p-4">
          <div className="mb-2.5 flex items-center gap-2 text-[13px] font-extrabold">
            <Wand2 size={15} className="text-accent" /> Usar um modelo de trabalho
          </div>
          {modelos.length === 0 ? (
            <div className="text-[12.5px] text-fg-tertiary">
              Nenhum modelo ainda. Crie em <b>Modelos de trabalho</b>, no topo da página de Prestação.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_160px_auto]">
                <select value={modeloId} onChange={(e) => setModeloId(e.target.value)} className={inputClass}>
                  {modelos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome} · {m.itens.length} atividade{m.itens.length > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={inicioModelo}
                  onChange={(e) => setInicioModelo(e.target.value)}
                  title="As datas do roteiro contam a partir deste dia"
                  className={inputClass}
                />
                <button
                  onClick={aplicarModelo}
                  disabled={pending || !modeloId}
                  className="rounded-control bg-accent px-5 py-2.5 text-[13.5px] font-extrabold text-page disabled:opacity-60"
                >
                  Aplicar
                </button>
              </div>
              {modelo && (
                <div className="mt-2 text-[11.5px] text-fg-tertiary">
                  As datas contam a partir de {dataCurta(inicioModelo)}: {modelo.itens.slice(0, 3).map((i) => `${i.titulo} (dia ${i.dias})`).join(', ')}
                  {modelo.itens.length > 3 ? '…' : ''}. Depois de aplicadas, as atividades podem ser editadas uma a uma.
                </div>
              )}
            </>
          )}
        </div>

        {/* Lista */}
        {lista.length === 0 && (
          <div className="mb-4 rounded-xl border border-dashed border-border-strong p-4 text-[13px] text-fg-tertiary">
            Nenhuma atividade ainda. Aplique um modelo acima ou adicione a primeira abaixo.
          </div>
        )}
        <div className="mb-5 space-y-1.5">
          {lista.map((a) => {
            const s = situacao(a, hoje);
            if (editando?.id === a.id) {
              return (
                <div key={a.id} className="grid grid-cols-1 gap-2 rounded-xl border border-accent/50 bg-card-dark p-3 sm:grid-cols-[1fr_150px]">
                  <input
                    autoFocus
                    value={editando.titulo}
                    onChange={(e) => setEditando({ ...editando, titulo: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && salvarEdicao()}
                    className={inputClass}
                  />
                  <input type="date" value={editando.data} onChange={(e) => setEditando({ ...editando, data: e.target.value })} className={inputClass} />
                  <input
                    value={editando.notas}
                    onChange={(e) => setEditando({ ...editando, notas: e.target.value })}
                    placeholder="Observação (opcional)"
                    className={`sm:col-span-2 ${inputClass}`}
                  />
                  <div className="flex justify-end gap-2 sm:col-span-2">
                    <button onClick={() => setEditando(null)} className="rounded-control border border-border-strong px-4 py-2 text-[13px] font-bold text-fg-secondary">
                      Cancelar
                    </button>
                    <button onClick={salvarEdicao} disabled={pending} className="rounded-control bg-accent px-5 py-2 text-[13px] font-extrabold text-page disabled:opacity-60">
                      Salvar
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div
                key={a.id}
                className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                  s === 'atrasada' ? 'border-error/30 bg-error/[.05]' : 'border-transparent bg-card-dark hover:border-border'
                }`}
              >
                <button
                  onClick={() => marcar(a)}
                  disabled={pending}
                  aria-label={a.feita ? `Reabrir ${a.titulo}` : `Marcar ${a.titulo} como feita`}
                  className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-full border-2 transition-colors ${
                    a.feita ? 'border-success bg-success text-black' : 'border-fg-faded hover:border-accent'
                  }`}
                >
                  {a.feita && <Check size={13} strokeWidth={3} />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-[13.5px] font-bold ${a.feita ? 'text-fg-tertiary line-through' : ''}`}>{a.titulo}</div>
                  {a.notas && <div className="truncate text-[12px] text-fg-tertiary">{a.notas}</div>}
                </div>
                <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${COR[s]}`}>
                  {dataCurta(a.data)} · {quandoDaAtividade(a, hoje)}
                </span>
                <div className="flex flex-shrink-0 gap-1 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                  <button
                    onClick={() => setEditando({ id: a.id, titulo: a.titulo, data: a.data, notas: a.notas })}
                    title="Editar"
                    aria-label={`Editar ${a.titulo}`}
                    className="grid h-7 w-7 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-accent hover:text-accent"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => setApagar(a)}
                    title="Excluir"
                    aria-label={`Excluir ${a.titulo}`}
                    className="grid h-7 w-7 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-error hover:text-error"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Nova atividade */}
        <div className="rounded-[14px] border border-border bg-card-dark p-4">
          <div className="mb-2.5 text-[13px] font-extrabold">Nova atividade</div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_160px]">
            <input
              ref={novoRef}
              value={novo.titulo}
              onChange={(e) => setNovo({ ...novo, titulo: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && novo.titulo.trim() && adicionar()}
              placeholder="O que precisa ser feito?"
              className={inputClass}
            />
            <input type="date" value={novo.data} onChange={(e) => setNovo({ ...novo, data: e.target.value })} className={inputClass} />
            <input
              value={novo.notas}
              onChange={(e) => setNovo({ ...novo, notas: e.target.value })}
              placeholder="Observação (opcional)"
              className={inputClass}
            />
            <button
              onClick={adicionar}
              disabled={pending || !novo.titulo.trim()}
              className="rounded-control bg-accent px-5 py-2.5 text-[13.5px] font-extrabold text-page disabled:opacity-60"
            >
              Adicionar
            </button>
          </div>
        </div>
      </div>
    </div>

      <ConfirmDialog
        aberto={!!apagar}
        titulo="Excluir atividade?"
        descricao={<>A atividade sai desta prestação. Não dá para desfazer.</>}
        detalhe={apagar?.titulo}
        pending={pending}
        onConfirmar={excluir}
        onCancelar={() => setApagar(null)}
      />

      {perguntarFim && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/65 p-4 backdrop-blur-sm" onClick={(e) => e.stopPropagation()} role="presentation">
          <div role="alertdialog" aria-modal="true" aria-label="Todas as atividades feitas" className="w-full max-w-[440px] rounded-[20px] border border-border-strong bg-card p-7">
            <div className="mb-4 flex items-start gap-3.5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                <CircleCheck size={20} />
              </div>
              <div>
                <div className="mb-1 text-[16px] font-extrabold">Todas as atividades foram feitas</div>
                <div className="text-[13px] leading-relaxed text-fg-tertiary">
                  Ainda falta alguma coisa em <b className="text-fg">{prestacao.title}</b>? Se estiver tudo entregue, a prestação pode ser
                  finalizada como Concluída.
                </div>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
              <button
                autoFocus
                onClick={() => {
                  setPerguntarFim(false);
                  setTimeout(() => novoRef.current?.focus(), 50);
                }}
                className="rounded-control border border-border-strong px-5 py-2.5 text-[13.5px] font-extrabold text-fg-secondary hover:border-accent hover:text-accent"
              >
                Falta sim, vou adicionar
              </button>
              <button onClick={finalizar} disabled={pending} className="rounded-control bg-success px-5 py-2.5 text-[13.5px] font-extrabold text-black disabled:opacity-60">
                {pending ? 'Finalizando…' : 'Não falta nada, finalizar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
