import { revalidatePath } from 'next/cache';

// Quem mostra o mesmo dado precisa ser invalidado junto.
//
// Cada action mantinha a própria lista de telas para revalidar, e as listas
// divergiram: dar baixa numa parcela atualizava o Financeiro mas não o
// histórico do cliente; salvar uma venda atualizava o estoque mas não o painel.
// O sintoma é sempre o mesmo — a mesma informação com dois valores diferentes
// dependendo da tela por onde se entra —, e a causa nunca está na tela que
// mostra errado, o que torna isso caro de diagnosticar.
//
// Uma lista só, no lugar de sete.

/** Telas que mostram dinheiro, carnê ou situação do cliente.
 *
 *  Venda, prestação, troca, parcela e lançamento manual mexem em pelo menos duas
 *  delas — na prática, sempre no Financeiro e no painel. Revalidar de mais custa
 *  um render; revalidar de menos custa um número errado na tela. */
const TELAS_DE_DINHEIRO = [
  '/admin',
  '/admin/financeiro',
  '/admin/vendas',
  '/admin/prestacao-servico',
];

/** Invalida tudo que exibe dinheiro e o histórico do cliente.
 *
 *  `extras` recebe o que é específico da ação — estoque, orçamentos, a vitrine.
 *  O histórico do cliente vai por `layout` porque a página de cada cliente é
 *  dinâmica (`/admin/clientes/[id]`) e não dá para listar uma a uma. */
export function revalidarDinheiro(...extras: string[]): void {
  for (const tela of [...TELAS_DE_DINHEIRO, ...extras]) revalidatePath(tela);
  revalidatePath('/admin/clientes', 'layout');
}
