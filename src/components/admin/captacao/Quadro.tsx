'use client';

// Quadro (kanban) do painel: leads em colunas por etapa, arrastando com mouse
// ou dedo (componente Kanban, dnd-kit). Mudar de coluna muda a etapa do lead.

import { Flame, ClipboardCheck } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Kanban, type ColunaDoKanban } from '@/components/kanban/Kanban';
import { LEAD_STATUSES, LEAD_STATUS_LABEL, ehQuente, type Lead, type LeadStatus } from '@/lib/captacao';
import { formatMoeda, type Estimativa } from '@/lib/precos-captacao';
import { respondidas } from '@/lib/checklist-descoberta';
import { updateLeadAction } from '@/app/actions/leads';
import { corDaNota } from './comum';

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

const COLUNAS: ColunaDoKanban<LeadStatus>[] = LEAD_STATUSES.map((s) => ({ chave: s, titulo: LEAD_STATUS_LABEL[s], cor: COR[s] }));

export function Quadro({
  leads,
  estimativa,
  agora,
  vendedorDe,
  aoAbrir,
}: {
  leads: Lead[];
  estimativa: (l: Lead) => Estimativa;
  agora: number;
  /** Nome do vendedor com quem o lead está (link ativo), se houver. */
  vendedorDe: (id: string) => string | undefined;
  /** Clique no cartão: abre a ficha completa. */
  aoAbrir?: (l: Lead) => void;
}) {
  const toast = useToast();

  return (
    <Kanban
      colunas={COLUNAS}
      itens={leads}
      idDe={(l) => l.id}
      colunaDe={(l) => l.status}
      aoAbrir={aoAbrir}
      aoMover={async (l, status) => {
        const r = await updateLeadAction(l.id, { status });
        if (!r.ok || r.message.includes(' Este lead ')) toast(r);
        return r.ok;
      }}
      cartao={(l) => {
        const e = estimativa(l);
        const quente = ehQuente(l, agora);
        const vendedor = vendedorDe(l.id);
        const checklist = respondidas(l.discovery);
        return (
          <div className={`rounded-[12px] border bg-page/60 p-2.5 ${quente ? 'border-[#ff6b3d]/50' : 'border-border'}`}>
            <div className="flex items-start gap-2">
              <span
                className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded-[8px] text-[11.5px] font-bold tabular-nums ${corDaNota(l.score)}`}
              >
                {l.score}
              </span>
              <div className="min-w-0">
                <div className="line-clamp-2 text-[12.5px] font-bold leading-snug">
                  {quente && <Flame size={11} className="mr-1 inline text-[#ff8a5c]" />}
                  {l.name}
                </div>
                <div className="truncate text-[11px] text-fg-tertiary">{[l.niche, l.city].filter(Boolean).join(' · ')}</div>
                {e.unico > 0 && (
                  <div className="text-[11px] font-bold text-fg-secondary">
                    {formatMoeda(e.unico, e.moeda)}
                    {e.mensal > 0 && ` + ${formatMoeda(e.mensal, e.moeda)}/mês`}
                  </div>
                )}
                {(vendedor || checklist > 0) && (
                  <div className="mt-1 flex flex-wrap gap-1 text-[10.5px] font-bold">
                    {vendedor && <span className="rounded-full bg-accent/12 px-1.5 py-0.5 text-accent">com {vendedor}</span>}
                    {checklist > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-success/12 px-1.5 py-0.5 text-success">
                        <ClipboardCheck size={10} /> checklist {checklist}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }}
    />
  );
}
