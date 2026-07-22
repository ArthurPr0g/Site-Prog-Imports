'use client';

import { useState, useTransition } from 'react';
import { addTestimonialAction, deleteTestimonialAction } from '@/app/actions/admin';

type Testimonial = { id: string; name: string; text: string };

export function TestimonialsPanel({ testimonials }: { testimonials: Testimonial[] }) {
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [, startTransition] = useTransition();

  function add() {
    if (!name.trim() || !text.trim()) return;
    startTransition(async () => {
      await addTestimonialAction(name, text);
      setName('');
      setText('');
    });
  }

  return (
    <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[340px_1fr]">
      <div className="rounded-[18px] border border-border bg-card p-6">
        <div className="mb-4 text-[15px] font-extrabold">Novo depoimento</div>
        <div className="flex flex-col gap-2.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do cliente"
            className="rounded-control border border-border-strong bg-input px-4 py-3 text-[13px] outline-none focus:border-accent"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Depoimento…"
            rows={4}
            className="resize-y rounded-control border border-border-strong bg-input px-4 py-3 text-[13px] outline-none focus:border-accent"
          />
          <button onClick={add} className="rounded-control bg-accent py-3 text-[13.5px] font-extrabold text-page">
            Publicar
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {testimonials.map((t) => (
          <div key={t.id} className="flex items-start gap-4 rounded-[18px] border border-border bg-card p-5.5">
            <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-border-hover bg-[#1c1c21] text-[13px] font-extrabold text-accent">
              {t.name[0]}
            </div>
            <div className="flex-1">
              <div className="mb-1 text-sm font-extrabold">
                {t.name} <span className="ml-1.5 text-xs tracking-[2px] text-accent">★★★★★</span>
              </div>
              <div className="text-[13.5px] leading-relaxed text-fg-secondary">{t.text}</div>
            </div>
            <button
              onClick={() => startTransition(() => deleteTestimonialAction(t.id))}
              className="flex-shrink-0 rounded-[9px] border border-border-hover px-2.5 py-1.5 text-xs text-fg-tertiary hover:border-error hover:text-error"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
