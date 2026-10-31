// Conserto automático (pedido do Arthur em 30/10/2026): "esses relatórios de falhas, você já tem que pegar e
// tentar resolver do mesmo jeito que se eu tivesse pedido 'resolva os erros e pendências'". Cada alarme do
// sistema ou ensaio da Lia com falha vira um pedido na fila do executor (PC ou nuvem), sem esperar o Arthur.

import type { DbDoAtendente } from './db';
import { pedirAoAgente } from '@/lib/agentes/time';

/** Problemas que só o Arthur resolve (recarregar crédito, esperar a Meta): avisa, mas não pede conserto. */
export const SO_O_ARTHUR_RESOLVE = new Set(['ia_sem_credito', 'modelos_demorando', 'meta_sem_pagamento']);

const HORA = 3600_000;

/**
 * Põe "resolva os erros e pendências" na fila. Não repete o mesmo pedido enquanto ele estiver na fila ou
 * tiver sido pedido nas últimas 12 h. Devolve true se pediu.
 */
export async function pedirConserto(db: DbDoAtendente, origem: 'alarme' | 'ensaio', titulo: string, achados: string): Promise<boolean> {
  const { count } = await db
    .from('ideias')
    .select('id', { count: 'exact', head: true })
    .eq('agente', 'conserto')
    .ilike('titulo', `%${titulo.slice(0, 60).replace(/[%_]/g, '')}%`)
    .or(`status.in.(pendente,em_execucao),criado_em.gte.${new Date(Date.now() - 12 * HORA).toISOString()}`);
  if (count) return false;
  const { error } = await pedirAoAgente(db, 'conserto', {
    titulo,
    projeto: 'Prog Soluções (site-prog-imports)',
    pedido: [
      `Resolva os erros e pendências abaixo (${origem === 'alarme' ? 'alarme do sistema' : 'ensaio semanal da Lia'}, pedido automático; vale como se o Arthur tivesse pedido).`,
      '',
      achados.slice(0, 5000),
      '',
      'Onde: repositório ArthurPr0g/Site-Prog-Imports (no PC: C:/Apps/1 - Dev/Prog Soluções/2 - Meus projetos/Prog Imports/site-prog-imports).',
      'Banco: SÓ o servidor MCP prog-supabase-arthurmatos003, project ref oduimaztcoxbvtlsjjcy. Nada de SQL destrutivo (DROP, TRUNCATE, DELETE/UPDATE sem WHERE).',
      'Investigue a causa (logs da Vercel, tabelas ia_*, código), corrija, rode npm run build e só faça commit e push se passar; confira o deploy READY.',
      'Não mande nada a cliente, não mexa em senha, chave ou pagamento. Se a causa for algo que só o Arthur faz (recarregar crédito, aprovar na Meta, logar em algum lugar), não force: escreva "Aguardando você: ..." com o passo exato.',
      'Se não conseguir resolver, termine com "Aguardando você:" e até 3 opções numeradas (1, 2, 3), curtas: o Arthur responde a mensagem no WhatsApp com o número, um texto ou um áudio, e a resposta volta como continuação deste pedido.',
      'Termine com um resumo BREVE (no máximo 4 linhas, vai para o WhatsApp do Arthur): o que era, o que corrigiu (commit) e se o problema sumiu.',
    ].join('\n'),
  });
  return !error;
}
