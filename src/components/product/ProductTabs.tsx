'use client';

import { useState } from 'react';
import { StarRating } from '@/components/ui/Price';
import { formatDateBR } from '@/lib/format';
import { Desempenho, type Benchmark } from './Desempenho';

type Spec = { k: string; v: string };
type Review = { id: string; author_name: string; rating: number; text: string; created_at: string };

export function ProductTabs({
  description,
  specs,
  reviews,
  benchmarks = [],
}: {
  description: string;
  specs: Spec[];
  reviews: Review[];
  benchmarks?: Benchmark[];
}) {
  // "Desempenho" só existe quando há teste real da configuração idêntica
  const tabs = [
    { id: 'descricao', nome: 'Descrição' },
    ...(benchmarks.length ? [{ id: 'desempenho', nome: 'Desempenho' }] : []),
    { id: 'specs', nome: 'Especificações' },
    { id: 'avaliacoes', nome: `Avaliações (${reviews.length})` },
  ];
  const [tab, setTab] = useState('descricao');

  return (
    <section className="mx-auto max-w-[1280px] px-6 pt-16">
      <div className="mb-7 flex gap-2 overflow-x-auto border-b border-border">
        {tabs.map(({ id, nome }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="whitespace-nowrap border-b-2 px-5.5 py-3.5 text-[15px] font-extrabold transition-all"
            style={{
              borderColor: tab === id ? 'var(--color-accent)' : 'transparent',
              color: tab === id ? 'var(--prog-marfim)' : 'var(--prog-grafite-texto)',
            }}
          >
            {nome}
          </button>
        ))}
      </div>

      {tab === 'descricao' && (
        <div className="max-w-[760px] text-[15.5px] leading-loose text-[var(--prog-prata)] whitespace-pre-line">
          {description}
        </div>
      )}

      {tab === 'desempenho' && <Desempenho benchmarks={benchmarks} />}

      {tab === 'specs' && (
        <div className="max-w-[760px] overflow-hidden rounded-2xl border border-border">
          {specs.map((s) => (
            <div key={s.k} className="grid grid-cols-[220px_1fr] border-b border-border last:border-b-0">
              <div className="bg-card px-5.5 py-3.5 text-[13px] font-extrabold text-fg-secondary">{s.k}</div>
              <div className="px-5.5 py-3.5 text-sm">{s.v}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'avaliacoes' && (
        <div className="grid max-w-[1000px] grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-[20px] border border-border bg-card p-6.5">
              <div className="mb-3">
                <StarRating rating={r.rating} size={13} />
              </div>
              <p className="mb-4 text-sm leading-relaxed text-[var(--prog-prata)]">{r.text}</p>
              <div className="text-[13.5px] font-extrabold">
                {r.author_name} <span className="font-semibold text-fg-tertiary">· {formatDateBR(r.created_at)}</span>
              </div>
            </div>
          ))}
          {reviews.length === 0 && <div className="text-sm text-fg-tertiary">Ainda sem avaliações.</div>}
        </div>
      )}
    </section>
  );
}
