'use client';

import { useEffect, useState } from 'react';

// Painel aberto durante um deploy: a página antiga chama uma ação que o
// servidor novo não tem mais ("Server Action ... was not found"). Não é erro
// de dados: recarregar resolve, então recarrega sozinho (uma vez por minuto,
// para não entrar em laço se o problema for outro).
const VERSAO_NOVA = /Server Action .* was not found|UnrecognizedActionError|Failed to find Server Action|ChunkLoadError|Loading chunk/i;
const CHAVE = 'admin-recarregou-por-versao';

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const versaoNova = VERSAO_NOVA.test(`${error?.name ?? ''} ${error?.message ?? ''}`);
  const [recarregando, setRecarregando] = useState(false);

  useEffect(() => {
    console.error(error);
    if (!versaoNova) return;
    let ultima = 0;
    try {
      ultima = Number(sessionStorage.getItem(CHAVE) ?? 0);
    } catch {}
    if (Date.now() - ultima < 60_000) return;
    try {
      sessionStorage.setItem(CHAVE, String(Date.now()));
    } catch {}
    setRecarregando(true);
    window.location.reload();
  }, [error, versaoNova]);

  return (
    <div className="rounded-[18px] border border-error/30 bg-card p-8 text-center">
      <h1 className="mb-2 font-display text-xl font-bold">
        {recarregando ? 'O sistema foi atualizado' : 'Algo deu errado nesta tela'}
      </h1>
      <p className="mx-auto mb-5 max-w-md text-sm text-fg-tertiary">
        {recarregando
          ? 'Carregando a versão nova…'
          : versaoNova
            ? 'O sistema foi atualizado enquanto esta tela estava aberta. Recarregue a página para continuar.'
            : 'Não foi possível carregar estes dados. Tente novamente — se persistir, verifique sua conexão ou contate o suporte técnico.'}
      </p>
      <button
        onClick={() => (versaoNova ? window.location.reload() : reset())}
        className="rounded-control bg-accent px-6 py-3 text-[13.5px] font-extrabold text-page transition-all hover:-translate-y-0.5"
      >
        {versaoNova ? 'Recarregar' : 'Tentar novamente'}
      </button>
    </div>
  );
}
