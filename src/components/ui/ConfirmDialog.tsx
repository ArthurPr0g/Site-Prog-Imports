'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

/** Confirmação de ação destrutiva.
 *
 *  Existe no lugar do `window.confirm` do navegador, que aparece colado no topo
 *  da janela, ignora o tema do painel e não tem espaço para dizer o que a
 *  exclusão leva junto — e é justamente esse detalhe que faz a diferença entre
 *  uma confirmação consciente e um clique reflexo.
 *
 *  Fecha no Esc e no clique fora, mas confirmar exige o botão: cancelar por
 *  engano não custa nada, apagar por engano custa. */
export function ConfirmDialog({
  aberto,
  titulo,
  descricao,
  detalhe,
  confirmar = 'Excluir',
  pending = false,
  onConfirmar,
  onCancelar,
}: {
  aberto: boolean;
  titulo: string;
  descricao: ReactNode;
  /** Linha em destaque com o que exatamente vai embora. */
  detalhe?: ReactNode;
  confirmar?: string;
  pending?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const cancelarRef = useRef<HTMLButtonElement>(null);

  // Foco no "Cancelar": quem chegou aqui com Enter engatilhado não apaga nada.
  useEffect(() => {
    if (aberto) cancelarRef.current?.focus();
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberto, onCancelar]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/65 p-4 backdrop-blur-sm"
      onClick={onCancelar}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] animate-toast-in rounded-[20px] border border-border-strong bg-card p-7 shadow-[0_24px_64px_rgba(0,0,0,.55)]"
      >
        <div className="mb-4 flex items-start gap-3.5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-error/15 text-error">
            <AlertTriangle size={19} />
          </div>
          <div className="min-w-0">
            <div className="mb-1 text-[16px] font-extrabold">{titulo}</div>
            <div className="text-[13px] leading-relaxed text-fg-tertiary">{descricao}</div>
          </div>
        </div>

        {detalhe && (
          <div className="mb-4 rounded-control border border-border bg-card-dark px-4 py-3 text-[12.5px] text-fg-secondary">
            {detalhe}
          </div>
        )}

        <div className="flex justify-end gap-2.5">
          <button
            ref={cancelarRef}
            onClick={onCancelar}
            disabled={pending}
            className="rounded-control border border-border-strong px-5 py-2.5 text-[13.5px] font-extrabold text-fg-secondary hover:border-accent hover:text-accent disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={pending}
            className="rounded-control bg-error px-6 py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-60"
          >
            {pending ? 'Excluindo…' : confirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
