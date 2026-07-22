'use client';

import { useState } from 'react';
import { subscribeNewsletterAction } from '@/app/actions/coupon';
import { useToast } from '@/components/ui/Toast';

export function Newsletter() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const toast = useToast();

  async function subscribe() {
    if (!email.includes('@')) {
      toast('Digite um e-mail válido');
      return;
    }
    const res = await subscribeNewsletterAction(email);
    if (res.ok) setSubscribed(true);
    else toast('Não foi possível cadastrar, tente novamente');
  }

  return (
    <section className="mx-auto max-w-[1280px] px-6 py-22">
      <div className="relative overflow-hidden rounded-[28px] border border-accent/25 bg-[linear-gradient(135deg,#181014,#0f0f13_55%)] p-8 text-center md:p-14">
        <div
          className="pointer-events-none absolute left-1/2 top-[-160px] h-[320px] w-[520px] -translate-x-1/2 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(242,135,5,.16), transparent 70%)' }}
        />
        <h2 className="mb-3 font-display text-[32px] font-bold tracking-[-.02em]">Chegou primeiro, comprou primeiro</h2>
        <p className="mb-7 text-[15px] text-fg-secondary">
          Receba lançamentos exclusivos dos EUA e promoções antes de todo mundo.
        </p>
        {!subscribed ? (
          <div className="mx-auto flex max-w-[460px] justify-center gap-2.5">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Seu melhor e-mail"
              className="flex-1 rounded-full border border-border-hover bg-input px-5.5 py-3.5 text-sm outline-none focus:border-accent"
            />
            <button
              onClick={subscribe}
              className="rounded-full bg-accent px-7 py-3.5 text-sm font-extrabold text-page transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(242,135,5,.4)]"
            >
              Cadastrar
            </button>
          </div>
        ) : (
          <div className="inline-block rounded-full border border-accent/40 bg-accent/12 px-7 py-3.5 text-sm font-extrabold text-accent">
            ✓ Cadastro realizado — bem-vindo à Prog Imports!
          </div>
        )}
      </div>
    </section>
  );
}
