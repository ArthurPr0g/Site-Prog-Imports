'use client';

// Formulário do checklist de descoberta (perguntas em src/lib/checklist-descoberta.ts).
// O mesmo na página do vendedor e no painel do dono; quem chama decide onde salvar.

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { CHECKLIST, respondidas, type RespostasDoChecklist } from '@/lib/checklist-descoberta';

const campo =
  'w-full rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[14px] outline-none focus:border-accent [color-scheme:dark]';

export function ChecklistForm({
  inicial,
  aoSalvar,
  rotuloSalvar = 'Salvar checklist',
}: {
  inicial: RespostasDoChecklist;
  /** Devolve true quando salvou. */
  aoSalvar: (r: RespostasDoChecklist) => Promise<boolean>;
  rotuloSalvar?: string;
}) {
  const [r, setR] = useState<RespostasDoChecklist>(inicial);
  const [pending, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);
  const set = (k: string, v: string | string[]) => {
    setSalvo(false);
    setR((x) => ({ ...x, [k]: v }));
  };
  const alternar = (k: string, opcao: string) => {
    const atual = Array.isArray(r[k]) ? (r[k] as string[]) : [];
    set(k, atual.includes(opcao) ? atual.filter((o) => o !== opcao) : [...atual, opcao]);
  };

  return (
    <div className="space-y-4">
      <div className="text-[12px] text-fg-tertiary">
        {respondidas(r)} de {CHECKLIST.length} respondidas · faça na conversa, sem pressa: cada resposta ajuda a montar a proposta
        certa.
      </div>
      {CHECKLIST.map((p) => (
        <div key={p.chave}>
          <div className="mb-1.5 text-[13.5px] font-bold">{p.pergunta}</div>
          {p.dica && <div className="-mt-1 mb-1.5 text-[11.5px] text-fg-faded">{p.dica}</div>}
          {p.tipo === 'texto' && (
            <input value={(r[p.chave] as string) ?? ''} onChange={(e) => set(p.chave, e.target.value)} className={campo} />
          )}
          {p.tipo === 'textoLongo' && (
            <textarea
              value={(r[p.chave] as string) ?? ''}
              onChange={(e) => set(p.chave, e.target.value)}
              rows={3}
              className={`${campo} resize-y`}
            />
          )}
          {(p.tipo === 'uma' || p.tipo === 'varias') && (
            <div className="flex flex-wrap gap-1.5">
              {p.opcoes!.map((o) => {
                const marcado =
                  p.tipo === 'uma' ? r[p.chave] === o : Array.isArray(r[p.chave]) && (r[p.chave] as string[]).includes(o);
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => (p.tipo === 'uma' ? set(p.chave, marcado ? '' : o) : alternar(p.chave, o))}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
                      marcado
                        ? 'border-accent bg-accent/15 text-accent'
                        : 'border-border-strong text-fg-secondary hover:border-accent'
                    }`}
                  >
                    {marcado && <Check size={12} />}
                    {o}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            if (await aoSalvar(r)) setSalvo(true);
          })
        }
        className="flex w-full items-center justify-center gap-2 rounded-control bg-accent px-5 py-3 text-[14px] font-extrabold text-page disabled:opacity-60"
      >
        {salvo ? (
          <>
            <Check size={16} /> Salvo
          </>
        ) : pending ? (
          'Salvando…'
        ) : (
          rotuloSalvar
        )}
      </button>
    </div>
  );
}
