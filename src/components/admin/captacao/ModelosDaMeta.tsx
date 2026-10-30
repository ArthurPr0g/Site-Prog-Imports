'use client';

// Atendimento › Modelos de mensagem da Meta (0094): o que a Lia pode mandar fora da janela de 24 h,
// com os botões de cada um e a situação da aprovação. O relógio cria e acompanha sozinho.

import { useEffect, useState } from 'react';
import { MessageSquareText } from 'lucide-react';
import { modelosDaMetaAction } from '@/app/actions/projeto';

const COR: Record<string, string> = { APPROVED: 'text-success', REJECTED: 'text-error', DISABLED: 'text-error' };
const NOME: Record<string, string> = { APPROVED: 'aprovado', PENDING: 'em análise', REJECTED: 'recusado', DISABLED: 'desativado', criando: 'criando' };

export function ModelosDaMeta() {
  const [lista, setLista] = useState<Awaited<ReturnType<typeof modelosDaMetaAction>>>([]);
  useEffect(() => {
    let vivo = true;
    modelosDaMetaAction().then((r) => vivo && setLista(r));
    return () => {
      vivo = false;
    };
  }, []);
  if (!lista.length) return null;
  const aprovados = lista.filter((m) => m.status === 'APPROVED').length;
  return (
    <details className="rounded-[14px] border border-border bg-card p-4 sm:col-span-4">
      <summary className="flex cursor-pointer items-center gap-2">
        <MessageSquareText size={15} className="text-accent" />
        <b className="text-[14px]">Modelos de mensagem da Meta</b>
        <span className="text-[12px] text-fg-tertiary">
          {aprovados} de {lista.length} aprovados · usados quando o cliente não escreve há mais de 24 h
        </span>
      </summary>
      <div className="mt-3 grid gap-2">
        {lista.map((m) => (
          <div key={m.nome} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[12px] border border-border px-3 py-2 text-[12.5px]">
            <b className={COR[m.status] ?? (m.status.startsWith('ERRO') ? 'text-error' : 'text-fg-tertiary')}>{NOME[m.status] ?? m.status}</b>
            <span className="min-w-0 flex-1">{m.quando}</span>
            <span className="text-fg-tertiary">{m.botoes.join(' · ')}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
