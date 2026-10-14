'use client';

import { useState, useTransition } from 'react';
import { ArrowDown, ArrowUp, LayoutList, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { ItemDeModelo, Modelo } from '@/lib/atividades';
import { excluirModeloAction, salvarModeloAction, type ModeloInput } from '@/app/actions/atividades';

const inputClass =
  'rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13.5px] outline-none focus:border-accent';

const itemVazio = (dias = 0): ItemDeModelo => ({ titulo: '', notas: '', dias });

/** Botão do cabeçalho da Prestação + janela com a lista e o editor de modelos. */
export function ModelosDeTrabalho({ modelos }: { modelos: Modelo[] }) {
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<ModeloInput | null>(null);
  const [apagar, setApagar] = useState<Modelo | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function salvar() {
    if (!form) return;
    startTransition(async () => {
      const r = await salvarModeloAction(form);
      toast(r);
      if (r.ok) setForm(null);
    });
  }

  function excluir() {
    if (!apagar) return;
    startTransition(async () => {
      toast(await excluirModeloAction(apagar.id));
      setApagar(null);
    });
  }

  const setItem = (k: number, campo: keyof ItemDeModelo, v: string | number) =>
    setForm((f) => (f ? { ...f, itens: f.itens.map((it, i) => (i === k ? { ...it, [campo]: v } : it)) } : f));

  function mover(k: number, d: -1 | 1) {
    setForm((f) => {
      if (!f) return f;
      const itens = [...f.itens];
      const alvo = k + d;
      if (alvo < 0 || alvo >= itens.length) return f;
      [itens[k], itens[alvo]] = [itens[alvo], itens[k]];
      return { ...f, itens };
    });
  }

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="flex items-center gap-1.5 rounded-control border border-border-strong px-4 py-2.5 text-[13.5px] font-extrabold text-fg-secondary transition-colors hover:border-accent hover:text-accent"
      >
        <LayoutList size={15} /> Modelos de trabalho
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => !form && setAberto(false)} role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Modelos de trabalho"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-[760px] overflow-y-auto rounded-[20px] border border-border-strong bg-card p-6 sm:p-7"
          >
            <div className="mb-1 flex items-start justify-between gap-3">
              <div className="text-[17px] font-extrabold">{form ? (form.id ? 'Editar modelo' : 'Novo modelo') : 'Modelos de trabalho'}</div>
              <button
                onClick={() => (form ? setForm(null) : setAberto(false))}
                aria-label="Fechar"
                className="grid h-8 w-8 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:text-fg"
              >
                <X size={15} />
              </button>
            </div>
            <p className="mb-5 text-[12.5px] leading-relaxed text-fg-tertiary">
              Um roteiro de atividades que você aplica numa prestação de uma vez. Cada atividade diz <b>em que dia</b> ela deve ser
              feita, contando do início da prestação: dia 0 é o próprio início, dia 5 é cinco dias depois. Mudar um modelo não mexe
              nas prestações que já o usaram. Etapas com <b>o mesmo nome</b> em modelos diferentes (como &quot;Briefing com o
              cliente&quot;) viram uma só quando você aplica mais de um modelo na mesma prestação.
            </p>

            {!form && (
              <>
                {modelos.length === 0 && (
                  <div className="mb-4 rounded-xl border border-dashed border-border-strong p-4 text-[13px] text-fg-tertiary">
                    Nenhum modelo ainda. Crie o primeiro, por exemplo &quot;Site institucional&quot;.
                  </div>
                )}
                <div className="mb-4 space-y-2">
                  {modelos.map((m) => {
                    const ultimoDia = Math.max(...m.itens.map((i) => i.dias), 0);
                    return (
                      <div key={m.id} className="flex items-center gap-3 rounded-xl border border-border bg-card-dark px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] font-extrabold">{m.nome}</div>
                          <div className="truncate text-[12px] text-fg-tertiary">
                            {m.itens.length} atividade{m.itens.length > 1 ? 's' : ''} · até o dia {ultimoDia}
                            {m.descricao ? ` · ${m.descricao}` : ''}
                          </div>
                        </div>
                        <button
                          onClick={() => setForm({ id: m.id, nome: m.nome, descricao: m.descricao, itens: m.itens.map((i) => ({ ...i })) })}
                          title="Editar"
                          aria-label={`Editar ${m.nome}`}
                          className="grid h-8 w-8 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-accent hover:text-accent"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setApagar(m)}
                          title="Excluir"
                          aria-label={`Excluir ${m.nome}`}
                          className="grid h-8 w-8 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-error hover:text-error"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => setForm({ nome: '', descricao: '', itens: [itemVazio(0)] })}
                  className="flex items-center gap-1.5 rounded-control bg-accent px-5 py-2.5 text-[13.5px] font-extrabold text-page"
                >
                  <Plus size={15} /> Novo modelo
                </button>
              </>
            )}

            {form && (
              <>
                <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <input
                    autoFocus
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    placeholder="Nome do modelo * (ex.: Site institucional)"
                    className={inputClass}
                  />
                  <input
                    value={form.descricao}
                    onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                    placeholder="Descrição (opcional)"
                    className={inputClass}
                  />
                </div>

                <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Roteiro</div>
                <div className="mb-3 space-y-2">
                  {form.itens.map((it, k) => (
                    <div key={k} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-border bg-card-dark p-2.5 sm:grid-cols-[28px_1fr_120px_auto]">
                      <div className="hidden place-items-center text-[12px] font-extrabold text-accent sm:grid">{k + 1}</div>
                      <input
                        value={it.titulo}
                        onChange={(e) => setItem(k, 'titulo', e.target.value)}
                        placeholder="Atividade *"
                        className={inputClass}
                      />
                      <label className="col-start-1 flex items-center gap-2 rounded-control border border-border-strong bg-input px-3 text-[12.5px] text-fg-tertiary sm:col-start-auto">
                        dia
                        <input
                          type="number"
                          min={0}
                          value={it.dias}
                          onChange={(e) => setItem(k, 'dias', Math.max(0, Number(e.target.value) || 0))}
                          aria-label="Dias depois do início"
                          className="w-full bg-transparent py-2.5 text-[13.5px] font-bold text-fg outline-none"
                        />
                      </label>
                      <div className="col-start-2 row-span-2 row-start-1 flex flex-col gap-1 sm:col-start-auto sm:row-span-1 sm:row-start-auto sm:flex-row sm:items-center">
                        <button onClick={() => mover(k, -1)} disabled={k === 0} aria-label="Subir" className="grid h-7 w-7 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:text-accent disabled:opacity-30">
                          <ArrowUp size={12} />
                        </button>
                        <button onClick={() => mover(k, 1)} disabled={k === form.itens.length - 1} aria-label="Descer" className="grid h-7 w-7 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:text-accent disabled:opacity-30">
                          <ArrowDown size={12} />
                        </button>
                        <button
                          onClick={() => setForm({ ...form, itens: form.itens.filter((_, i) => i !== k) })}
                          disabled={form.itens.length === 1}
                          aria-label="Remover atividade"
                          className="grid h-7 w-7 place-items-center rounded-full border border-border-strong text-fg-tertiary hover:border-error hover:text-error disabled:opacity-30"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <input
                        value={it.notas}
                        onChange={(e) => setItem(k, 'notas', e.target.value)}
                        placeholder="Observação (opcional)"
                        className={`col-span-1 sm:col-span-2 sm:col-start-2 ${inputClass} py-2 text-[12.5px]`}
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() =>
                    setForm({ ...form, itens: [...form.itens, itemVazio(form.itens.at(-1)?.dias ?? 0)] })
                  }
                  className="mb-6 flex items-center gap-1.5 rounded-control border border-dashed border-border-strong px-4 py-2 text-[13px] font-bold text-fg-secondary hover:border-accent hover:text-accent"
                >
                  <Plus size={14} /> Adicionar atividade ao roteiro
                </button>

                <div className="flex justify-end gap-2.5">
                  <button onClick={() => setForm(null)} disabled={pending} className="rounded-control border border-border-strong px-5 py-2.5 text-[13.5px] font-extrabold text-fg-secondary">
                    Voltar
                  </button>
                  <button onClick={salvar} disabled={pending} className="rounded-control bg-accent px-6 py-2.5 text-[13.5px] font-extrabold text-page disabled:opacity-60">
                    {pending ? 'Salvando…' : 'Salvar modelo'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        aberto={!!apagar}
        titulo="Excluir modelo?"
        descricao={<>O modelo deixa de aparecer para novas prestações. As atividades já criadas a partir dele continuam onde estão.</>}
        detalhe={apagar?.nome}
        pending={pending}
        onConfirmar={excluir}
        onCancelar={() => setApagar(null)}
      />
    </>
  );
}
