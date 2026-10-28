'use client';

// Trilha da venda: em que etapa está cada cliente, bem visível (pedido do dono,
// 28/10/2026). A aba Atendimento relê a cada 10 s, então a trilha anda sozinha
// enquanto a conversa acontece.

import { Check, X } from 'lucide-react';
import { LEAD_STATUS_LABEL, type LeadStatus } from '@/lib/captacao';
import { CHECKLIST } from '@/lib/checklist-descoberta';
import type { ConversaDoPainel } from '@/lib/atendente/regras';

const PASSOS: LeadStatus[] = ['novo', 'contatado', 'respondeu', 'reuniao', 'proposta', 'fechado'];

const COR: Record<LeadStatus, string> = {
  novo: '#8a8a93',
  contatado: '#6aa6ff',
  respondeu: '#c9a15a',
  reuniao: '#b58cff',
  proposta: '#ff9f43',
  fechado: '#4ade80',
  perdido: '#e05555',
  nao_contatar: '#55555c',
};

const dia = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;

/** Barrinha para a lista de conversas: um segmento por etapa, colorido até a atual. */
export function BarraDaEtapa({ status }: { status: LeadStatus | null }) {
  if (!status) return null;
  const encerrado = status === 'perdido' || status === 'nao_contatar';
  const atual = PASSOS.indexOf(status);
  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <div className="flex flex-1 gap-0.5" aria-hidden>
        {PASSOS.map((p, i) => (
          <span
            key={p}
            className="h-1.5 flex-1 rounded-full"
            style={{ background: encerrado ? COR[status] + '55' : i <= atual ? COR[status] : 'var(--color-border)' }}
          />
        ))}
      </div>
      <span className="shrink-0 text-[11px] font-extrabold" style={{ color: COR[status] }}>
        {LEAD_STATUS_LABEL[status]}
      </span>
    </div>
  );
}

/** Trilha completa no topo da conversa: etapas, datas e o que já se sabe do cliente. */
export function TrilhaDaVenda({ conversa }: { conversa: ConversaDoPainel }) {
  const status = conversa.leadStatus;
  if (!status) {
    return (
      <div className="mx-3 mt-2 rounded-[12px] border border-border bg-card px-3 py-2 text-[12.5px] text-fg-tertiary">
        Contato sem lead ligado: a trilha aparece quando a conversa estiver ligada a uma empresa da Captação.
      </div>
    );
  }
  const encerrado = status === 'perdido' || status === 'nao_contatar';
  const atual = PASSOS.indexOf(status);
  const m = conversa.marcos;
  const datas: Partial<Record<LeadStatus, string | null>> = {
    contatado: dia(m.contatado),
    respondeu: dia(m.respondeu),
    fechado: dia(m.fechado),
  };

  return (
    <div className="mx-3 mt-2 rounded-[12px] border border-border bg-card px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Trilha da venda</span>
        <span
          className="rounded-full px-2 py-0.5 text-[11.5px] font-extrabold"
          style={{ background: COR[status] + '22', color: COR[status] }}
        >
          {encerrado ? <X size={11} className="mr-0.5 inline" /> : null}
          {LEAD_STATUS_LABEL[status]}
        </span>
      </div>
      <ol className="grid grid-cols-6 gap-1">
        {PASSOS.map((p, i) => {
          const feito = !encerrado && i < atual;
          const agora = !encerrado && i === atual;
          return (
            <li key={p} className="min-w-0 text-center">
              <div className="relative flex items-center justify-center">
                {i > 0 && (
                  <span
                    className="absolute right-1/2 top-1/2 h-0.5 w-full -translate-y-1/2"
                    style={{ background: !encerrado && i <= atual ? COR[status] : 'var(--color-border)' }}
                    aria-hidden
                  />
                )}
                <span
                  className={`relative grid h-6 w-6 place-items-center rounded-full border-2 text-[10px] font-extrabold ${agora ? 'animate-pulse' : ''}`}
                  style={{
                    borderColor: feito || agora ? COR[status] : 'var(--color-border)',
                    background: feito ? COR[status] : 'var(--color-card)',
                    color: feito ? 'var(--color-page)' : agora ? COR[status] : 'var(--color-fg-faded)',
                  }}
                >
                  {feito ? <Check size={12} strokeWidth={3} /> : i + 1}
                </span>
              </div>
              <div className={`mt-1 truncate text-[10.5px] font-bold ${agora ? 'text-fg' : 'text-fg-tertiary'}`}>{LEAD_STATUS_LABEL[p]}</div>
              {datas[p] && <div className="truncate text-[9.5px] text-fg-faded">{datas[p]}</div>}
            </li>
          );
        })}
      </ol>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-fg-tertiary">
        <span>
          Descoberta: <b className="text-fg-secondary">{m.descoberta} de {CHECKLIST.length}</b>
        </span>
        <span>
          Diagnóstico: <b className="text-fg-secondary">{m.diagnosticoVisto ? `visto ${dia(m.diagnosticoVisto)}` : 'não aberto'}</b>
        </span>
        {m.sinal && (
          <span>
            Sinal ({`R$ ${m.sinal.valor.toFixed(2).replace('.', ',')}`}):{' '}
            {m.sinal.pagoEm ? (
              <b className="text-success">pago {dia(m.sinal.pagoEm)}</b>
            ) : (
              <>
                <b className={m.sinal.status === 'OVERDUE' ? 'text-error' : 'text-[#ff9f43]'}>
                  {m.sinal.status === 'OVERDUE' ? 'vencido' : 'aguardando pagamento'}
                </b>
                {m.sinal.link && (
                  <a href={m.sinal.link} target="_blank" rel="noreferrer" className="ml-1 font-bold text-accent underline">
                    link
                  </a>
                )}
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
