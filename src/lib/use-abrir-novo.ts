'use client';

import { useEffect, useRef } from 'react';

/** Abre o formulário de cadastro quando a tela chega com `?novo=` na URL — é o
 *  que os atalhos do Painel usam para cair direto no "Nova venda", "Novo cliente"
 *  etc., em vez de deixar a pessoa procurar o botão de novo.
 *
 *  O valor do parâmetro vai para `abrir` (o Financeiro usa `receita`/`despesa`).
 *  Depois de abrir, o parâmetro sai da URL: recarregar a página ou voltar pelo
 *  histórico não pode abrir o formulário de novo sozinho. */
export function useAbrirNovoPelaUrl(abrir: (valor: string) => void) {
  const feito = useRef(false);
  useEffect(() => {
    if (feito.current) return;
    feito.current = true;
    const params = new URLSearchParams(window.location.search);
    const valor = params.get('novo');
    if (!valor) return;
    abrir(valor);
    params.delete('novo');
    const resto = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (resto ? `?${resto}` : '') + window.location.hash);
    // Só na chegada à tela; `abrir` muda a cada render e não deve reabrir nada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
