'use client';

import { Suspense, useActionState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { signInAction, type AuthResult } from '@/app/actions/auth';
import { Logo } from '@/components/ui/Logo';

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '';
  const [state, formAction, pending] = useActionState<AuthResult, FormData>(signInAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
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
        placeholder="Senha"
        className="rounded-control border border-border-strong bg-input px-4 py-3 text-[13.5px] outline-none focus:border-accent"
      />
      {state.error && <div className="text-[13px] font-semibold text-error">{state.error}</div>}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-control bg-accent py-3 text-[13.5px] font-extrabold text-page disabled:opacity-60"
      >
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-6 py-16">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex justify-center">
          <Link href="/">
            <Logo height={64} />
          </Link>
        </div>
        <div className="rounded-[22px] border border-border bg-card p-8">
          <h1 className="mb-1.5 font-display text-2xl font-bold tracking-[-.02em]">Entrar na sua conta</h1>
          <p className="mb-7 text-sm text-fg-tertiary">Acompanhe seus pedidos e favoritos.</p>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
          <div className="mt-5 text-center text-[13px] text-fg-tertiary">
            Não tem conta?{' '}
            <Link href="/cadastro" className="font-bold text-accent">
              Cadastre-se
            </Link>
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-divider-strong bg-card-dark p-4 text-center text-xs text-fg-faded">
          Demo: rafael.m@gmail.com / demo1234 (cliente) · admin@progimports.com / admin1234 (admin)
        </div>
      </div>
    </div>
  );
}
