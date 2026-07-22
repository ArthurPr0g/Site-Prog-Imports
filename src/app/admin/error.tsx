'use client';

import { useEffect } from 'react';

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-[18px] border border-error/30 bg-card p-8 text-center">
      <h1 className="mb-2 font-display text-xl font-bold">Algo deu errado nesta tela</h1>
      <p className="mx-auto mb-5 max-w-md text-sm text-fg-tertiary">
        Não foi possível carregar estes dados. Tente novamente — se persistir, verifique sua conexão ou contate o suporte técnico.
      </p>
      <button
        onClick={reset}
        className="rounded-control bg-accent px-6 py-3 text-[13.5px] font-extrabold text-page transition-all hover:-translate-y-0.5"
      >
        Tentar novamente
      </button>
    </div>
  );
}
