'use client';

// Pedidos de busca: o dono escolhe nicho + cidade (ou "todos os nichos da
// lista") e o programa do PC (scripts/captacao/worker.ts) busca, confere os
// sites, tira os prints e importa sozinho.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, RefreshCw, X } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { formatDateTimeBR } from '@/lib/format';
import { NICHOS } from '@/lib/nichos';
import type { Pais } from '@/lib/captacao';
import type { PedidoDeBusca } from '@/lib/data/leads';
import { pedirBuscaAction, cancelarBuscaAction } from '@/app/actions/leads';
import { inputClass } from './comum';

const ROTULO: Record<PedidoDeBusca['status'], string> = {
  pendente: 'Na fila',
  rodando: 'Buscando…',
  feito: 'Feito',
  erro: 'Erro',
};
const COR: Record<PedidoDeBusca['status'], string> = {
  pendente: 'text-fg-tertiary',
  rodando: 'text-accent',
  feito: 'text-success',
  erro: 'text-error',
};

export function Buscas({ pedidos }: { pedidos: PedidoDeBusca[] }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const [pais, setPais] = useState<Pais>('BR');
  const [nicho, setNicho] = useState('');
  const [cidade, setCidade] = useState('');
  const lista = pais === 'US' ? 'us' : 'br';
  const nichos = NICHOS[lista];

  function pedir(todos: boolean) {
    startTransition(async () => {
      const r = await pedirBuscaAction({ niche: nicho, city: cidade, country: pais, lista: todos ? lista : undefined });
      toast(r);
      if (r.ok && !todos) setNicho('');
    });
  }

  const abertos = pedidos.filter((p) => p.status === 'pendente' || p.status === 'rodando');

  return (
    <div className="space-y-4">
      <section className="rounded-[18px] border border-border bg-card p-4 sm:p-5">
        <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">Nova busca</div>
        <div className="grid gap-2.5 sm:grid-cols-[120px_1fr_1fr]">
          <select value={pais} onChange={(e) => setPais(e.target.value as Pais)} className={inputClass} aria-label="País">
            <option value="BR">Brasil</option>
            <option value="US">EUA</option>
          </select>
          <div>
            <input
              list="nichos-sugeridos"
              value={nicho}
              onChange={(e) => setNicho(e.target.value)}
              placeholder={pais === 'US' ? 'Ex: brazilian bakery' : 'Ex: clínica odontológica'}
              className={`w-full ${inputClass}`}
              aria-label="Nicho"
            />
            <datalist id="nichos-sugeridos">
              {nichos.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <input
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            placeholder={pais === 'US' ? 'Ex: Orlando, FL' : 'Ex: Goiânia, GO'}
            className={inputClass}
            aria-label="Cidade com a sigla do estado"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2.5">
          <button
            onClick={() => pedir(false)}
            disabled={pending || !nicho.trim() || !cidade.trim()}
            className="flex items-center gap-1.5 rounded-control bg-accent px-5 py-2.5 text-[13.5px] font-extrabold text-page disabled:opacity-50"
          >
            <Search size={15} /> Buscar este nicho
          </button>
          <button
            onClick={() => pedir(true)}
            disabled={pending || !cidade.trim()}
            className="rounded-control border border-accent/50 px-5 py-2.5 text-[13.5px] font-bold text-accent disabled:opacity-50"
          >
            Buscar todos os {nichos.length} nichos da lista
          </button>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-fg-tertiary">
          A busca roda no seu PC (o Google Maps não é consultado daqui): deixe ligado o programa{' '}
          <code>scripts\captacao\iniciar-worker.ps1</code>. Cada nicho leva uns 5 minutos; os leads aparecem sozinhos na lista, já
          com ramo, cidade, conferência do site e print no celular.
        </p>
      </section>

      <section className="rounded-[18px] border border-border bg-card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
            Fila e histórico {abertos.length > 0 && `· ${abertos.length} em aberto`}
          </div>
          <button
            onClick={() => router.refresh()}
            className="flex items-center gap-1.5 text-[12px] font-bold text-fg-tertiary hover:text-accent"
          >
            <RefreshCw size={13} /> Atualizar
          </button>
        </div>
        {pedidos.length === 0 ? (
          <div className="text-[13px] text-fg-tertiary">Nenhum pedido ainda.</div>
        ) : (
          <div className="divide-y divide-divider">
            {pedidos.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[13px]">
                <div className="min-w-0">
                  <span className="font-bold">{p.niche}</span>
                  <span className="text-fg-tertiary">
                    {' '}
                    · {p.city} · {p.country === 'US' ? 'EUA' : 'BR'}
                  </span>
                  {p.message && <div className="text-[12px] text-fg-tertiary">{p.message}</div>}
                </div>
                <div className="flex items-center gap-3">
                  {p.status === 'feito' && p.newLeads !== null && (
                    <span className="text-[12px] text-fg-tertiary">{p.newLeads} novo(s)</span>
                  )}
                  <span className={`text-[12px] font-extrabold ${COR[p.status]}`}>{ROTULO[p.status]}</span>
                  <span className="hidden text-[11.5px] text-fg-faded sm:inline">
                    {formatDateTimeBR(p.finishedAt ?? p.createdAt)}
                  </span>
                  {p.status === 'pendente' && (
                    <button
                      onClick={() => startTransition(async () => toast(await cancelarBuscaAction(p.id)))}
                      title="Cancelar"
                      aria-label="Cancelar busca"
                      className="text-fg-faded hover:text-error"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
