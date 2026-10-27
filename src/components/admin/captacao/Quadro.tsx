'use client';

// Quadro (kanban): leads em colunas por etapa. No computador, arrastar o
// cartão para outra coluna muda a etapa; no celular (sem arrastar), o seletor
// do próprio cartão faz o mesmo.

import { useState, useTransition } from 'react';
import { Flame } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { LEAD_STATUSES, LEAD_STATUS_LABEL, ehQuente, type Lead, type LeadStatus } from '@/lib/captacao';
import { formatMoeda, type Estimativa } from '@/lib/precos-captacao';
import { updateLeadAction } from '@/app/actions/leads';
import { corDaNota, inputClass } from './comum';

const POR_COLUNA = 40;

export function Quadro({ leads, estimativa, agora }: { leads: Lead[]; estimativa: (l: Lead) => Estimativa; agora: number }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<LeadStatus | null>(null);

  function mover(id: string, status: LeadStatus) {
    const l = leads.find((x) => x.id === id);
    if (!l || l.status === status) return;
    startTransition(async () => {
      const r = await updateLeadAction(id, { status });
      if (!r.ok) toast(r);
    });
  }

  return (
    <div className={`-mx-1 overflow-x-auto pb-3 ${pending ? 'opacity-70' : ''}`}>
      <div className="flex min-w-max gap-3 px-1">
        {LEAD_STATUSES.map((status) => {
          const daColuna = leads.filter((l) => l.status === status);
          return (
            <div
              key={status}
              onDragOver={(e) => {
                e.preventDefault();
                setSobre(status);
              }}
              onDragLeave={() => setSobre((s) => (s === status ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain') || arrastando;
                if (id) mover(id, status);
                setSobre(null);
                setArrastando(null);
              }}
              className={`w-[250px] flex-shrink-0 rounded-[16px] border p-2.5 transition-colors ${
                sobre === status ? 'border-accent bg-accent/[.06]' : 'border-border bg-card'
              }`}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
                  {LEAD_STATUS_LABEL[status]}
                </div>
                <div className="text-[12px] font-bold tabular-nums text-fg-tertiary">{daColuna.length}</div>
              </div>
              <div className="space-y-2">
                {daColuna.slice(0, POR_COLUNA).map((l) => {
                  const e = estimativa(l);
                  return (
                    <div
                      key={l.id}
                      draggable
                      onDragStart={(ev) => {
                        ev.dataTransfer.setData('text/plain', l.id);
                        setArrastando(l.id);
                      }}
                      onDragEnd={() => setArrastando(null)}
                      className={`cursor-grab rounded-[12px] border bg-page/40 p-2.5 active:cursor-grabbing ${
                        ehQuente(l, agora) ? 'border-[#ff6b3d]/50' : 'border-border'
                      } ${arrastando === l.id ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded-[8px] text-[11.5px] font-bold tabular-nums ${corDaNota(l.score)}`}
                        >
                          {l.score}
                        </span>
                        <div className="min-w-0">
                          <div className="line-clamp-2 text-[12.5px] font-bold leading-snug">
                            {ehQuente(l, agora) && <Flame size={11} className="mr-1 inline text-[#ff8a5c]" />}
                            {l.name}
                          </div>
                          <div className="truncate text-[11px] text-fg-tertiary">
                            {[l.niche, l.city].filter(Boolean).join(' · ')}
                          </div>
                          {e.unico > 0 && (
                            <div className="text-[11px] font-bold text-fg-secondary">
                              {formatMoeda(e.unico, e.moeda)}
                              {e.mensal > 0 && ` + ${formatMoeda(e.mensal, e.moeda)}/mês`}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Celular: sem arrastar, troca a etapa por aqui */}
                      <select
                        value={l.status}
                        onChange={(ev) => mover(l.id, ev.target.value as LeadStatus)}
                        aria-label={`Etapa de ${l.name}`}
                        className={`${inputClass} mt-2 w-full py-1 text-[11.5px] lg:hidden`}
                      >
                        {LEAD_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {LEAD_STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
                {daColuna.length > POR_COLUNA && (
                  <div className="px-1 py-1 text-[11.5px] text-fg-faded">
                    + {daColuna.length - POR_COLUNA} (use os filtros para ver)
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
