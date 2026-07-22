'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { signUpAction, type AuthResult } from '@/app/actions/auth';
import { Logo } from '@/components/ui/Logo';

export default function SignupPage() {
  const [state, formAction, pending] = useActionState<AuthResult, FormData>(signUpAction, {});

  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-6 py-16">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex justify-center">
          <Link href="/">
            <Logo height={56} />
          </Link>
        </div>
        <div className="rounded-[22px] border border-border bg-card p-8">
          <h1 className="mb-1.5 font-display text-2xl font-bold tracking-[-.02em]">Criar sua conta</h1>
          <p className="mb-7 text-sm text-fg-tertiary">Acompanhe pedidos, favoritos e rastreamento.</p>
          <form action={formAction} className="flex flex-col gap-3">
            <input
              name="name"
              required
              placeholder="Nome completo"
              className="rounded-control border border-border-strong bg-input px-4 py-3 text-[13.5px] outline-none focus:border-accent"
            />
            <input
              name="email"
              type="email"
              required
              placeholder="E-mail"
              className="rounded-control border border-border-strong bg-input px-4 py-3 text-[13.5px] outline-none focus:border-accent"
            />
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Senha (mín. 8 caracteres)"
              className="rounded-control border border-border-strong bg-input px-4 py-3 text-[13.5px] outline-none focus:border-accent"
            />
            <input
              name="confirm"
              type="password"
              required
              autoComplete="new-password"
              placeholder="Confirmar senha"
              className="rounded-control border border-border-strong bg-input px-4 py-3 text-[13.5px] outline-none focus:border-accent"
            />
            {state.error && <div className="text-[13px] font-semibold text-error">{state.error}</div>}
            <button
              type="submit"
              disabled={pending}
              className="mt-2 rounded-control bg-accent py-3 text-[13.5px] font-extrabold text-page disabled:opacity-60"
            >
              {pending ? 'Criando conta…' : 'Criar conta'}
            </button>
          </form>
          <div className="mt-5 text-center text-[13px] text-fg-tertiary">
            Já tem conta?{' '}
            <Link href="/entrar" className="font-bold text-accent">
              Entrar
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
