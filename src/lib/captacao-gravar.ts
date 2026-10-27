// Grava os registros de importação da Captação (upsert por dedupe_key) e conta
// novos x atualizados. Compartilhado pela importação do painel (sessão do
// admin, com RLS) e pelo programa do PC (scripts/captacao/worker.ts, chave
// secreta): os dois precisam dar exatamente o mesmo resultado.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesInsert } from '@/lib/supabase/database.types';

export type ResultadoDaGravacao = { ok: true; novos: number; atualizados: number } | { ok: false; erro: string };

export async function gravarLeads(
  supabase: SupabaseClient<Database>,
  registros: TablesInsert<'leads'>[]
): Promise<ResultadoDaGravacao> {
  // Mesma empresa repetida (tiles do --grid, ou em dois arquivos): fica a última.
  const unicos = [...new Map(registros.map((r) => [r.dedupe_key, r])).values()];

  // A contagem vai na URL (filtro "in"): lotes de 100 chaves cabem com folga
  // no limite de tamanho da URL; o upsert vai no corpo e aceita lotes maiores.
  let atualizados = 0;
  for (let i = 0; i < unicos.length; i += 100) {
    const { count } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .in(
        'dedupe_key',
        unicos.slice(i, i + 100).map((r) => r.dedupe_key)
      );
    atualizados += count ?? 0;
  }

  for (let i = 0; i < unicos.length; i += 500) {
    const { error } = await supabase.from('leads').upsert(unicos.slice(i, i + 500), { onConflict: 'dedupe_key' });
    if (error) return { ok: false, erro: error.message };
  }
  return { ok: true, novos: unicos.length - atualizados, atualizados };
}
