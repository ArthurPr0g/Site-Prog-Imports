'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-page px-6 text-center">
      <Logo height={55} />
      <div>
        <h1 className="mb-2 font-display text-2xl font-bold tracking-[-.02em]">Algo deu errado</h1>
        <p className="max-w-md text-sm text-fg-tertiary">
          Não foi possível carregar esta página. Tente novamente — se o problema continuar, volte para a home.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-control bg-accent px-6 py-3 text-[13.5px] font-extrabold text-page transition-all hover:-translate-y-0.5"
        >
          Tentar novamente
        </button>
        <Link
          href="/"
          className="rounded-control border border-border-strong px-6 py-3 text-[13.5px] font-bold text-fg-secondary hover:border-accent hover:text-accent"
        >
          Voltar para a home
        </Link>
      </div>
    </div>
  );
}
