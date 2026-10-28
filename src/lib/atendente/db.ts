// Banco do atendente de IA: o webhook do WhatsApp e o tick rodam sem sessão de
// usuário, então usam uma chave secreta própria (ATENDENTE_SUPABASE_KEY), que
// ignora o RLS. É uma chave só do atendente, criada no painel do Supabase e
// revogável sozinha; nunca vai para o navegador (sem NEXT_PUBLIC_).
// Só importar em rotas e actions do servidor.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export type DbDoAtendente = SupabaseClient<Database>;

let cliente: DbDoAtendente | null = null;

export function dbDoAtendente(): DbDoAtendente {
  if (cliente) return cliente;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.ATENDENTE_SUPABASE_KEY;
  if (!url || !chave) throw new Error('Atendente sem ATENDENTE_SUPABASE_KEY: configure a variável na Vercel.');
  cliente = createClient<Database>(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
  return cliente;
}
