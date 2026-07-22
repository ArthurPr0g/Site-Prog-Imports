'use client';

import { useState } from 'react';
import { StarRating } from '@/components/ui/Price';
import { formatDateBR } from '@/lib/format';

type Spec = { k: string; v: string };
type Review = { id: string; author_name: string; rating: number; text: string; created_at: string };

export function ProductTabs({
  description,
  specs,
  reviews,
}: {
  description: string;
  specs: Spec[];
  reviews: Review[];
}) {
  const [tab, setTab] = useState(0);
  const tabs = ['Descrição', 'Especificações', `Avaliações (${reviews.length})`];

  return (
    <section className="mx-auto max-w-[1280px] px-6 pt-16">
      <div className="mb-7 flex gap-2 border-b border-border">
        {tabs.map((name, i) => (
          <button
            key={name}
            onClick={() => setTab(i)}
            className="border-b-2 px-5.5 py-3.5 text-[15px] font-extrabold transition-all"
            style={{ borderColor: tab === i ? '#F28705' : 'transparent', color: tab === i ? '#f4f4f5' : '#7a7a84' }}
          >
            {name}
          </button>
        ))}
      </div>

      {tab === 0 && (
        <div className="max-w-[760px] text-[15.5px] leading-loose text-[#c9c9d1] whitespace-pre-line">
          {description}
        </div>
      )}

      {tab === 1 && (
        <div className="max-w-[760px] overflow-hidden rounded-2xl border border-border">
          {specs.map((s) => (
            <div key={s.k} className="grid grid-cols-[220px_1fr] border-b border-border last:border-b-0">
              <div className="bg-card px-5.5 py-3.5 text-[13px] font-extrabold text-fg-secondary">{s.k}</div>
              <div className="px-5.5 py-3.5 text-sm">{s.v}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 2 && (
        <div className="grid max-w-[1000px] grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-[20px] border border-border bg-card p-6.5">
              <div className="mb-3">
                <StarRating rating={r.rating} size={13} />
              </div>
              <p className="mb-4 text-sm leading-relaxed text-[#c9c9d1]">{r.text}</p>
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
