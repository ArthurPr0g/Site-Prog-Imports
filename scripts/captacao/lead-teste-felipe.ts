/**
 * Lead de teste da Lia (28/10/2026): o Felipe (vendedor) faz o papel de
 * cliente, como personal trainer, para ver o atendimento da IA. Análise feita
 * pelo Instagram @felipesousam_ e pelo site dele, com os mesmos critérios dos
 * leads do Maps. Entra no link da Lia.
 *
 *   npx -y tsx scripts/captacao/lead-teste-felipe.ts
 *
 * Depois do teste: volte o lead para "Novo" ou marque "Não contatar" no painel.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/supabase/database.types';
import { tabelaBRL } from '../../src/lib/precos-captacao';
import { valoresDoItem, type ServicoDoCatalogo } from '../../src/lib/itens-do-kit';

const RAIZ = resolve(__dirname, '..', '..');
const env = Object.fromEntries(
  readFileSync(join(RAIZ, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
);
const db = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const LEAD = {
  dedupe_key: 'teste:instagram:felipesousam_',
  name: 'Felipe Sousa Personal',
  category: 'Personal trainer',
  niche: 'personal trainer',
  country: 'BR',
  website: 'https://felipesousa-forceperform.netlify.app',
  site_check: 'ok',
  instagram: 'https://www.instagram.com/felipesousam_',
  // WhatsApp de onde o Felipe chama a Lia: é por ele que a Lia reconhece o lead.
  phone: '(62) 99571-1797',
  source: 'teste-lia',
  score: 70,
  porte: 'pequena',
  suggested_services: ['Site Profissional', 'Sistema de Gestão Básico'],
  reasons: [
    'Site em endereço gratuito (felipesousa-forceperform.netlify.app), sem domínio próprio',
    'Site de uma página só, sem planos, preços, depoimentos nem resultados de alunos',
    '35 alunos ativos com ajuste toda semana: controle de alunos, planos e mensalidades fica pesado sem sistema',
    'Instagram com 521 seguidores e 7 posts: pouca vitrine para atrair alunos novos',
  ],
  notes: '[Teste] Lead de teste: o Felipe faz o papel de cliente para conhecer o atendimento da Lia.',
};

async function main() {
  const { data: lead, error } = await db.from('leads').upsert(LEAD, { onConflict: 'dedupe_key' }).select('id, public_token').single();
  if (error || !lead) throw error ?? new Error('sem lead');

  const { data: kit } = await db.from('lead_seller_kits').select('id').eq('kind', 'ia').eq('active', true).maybeSingle();
  if (!kit) throw new Error('Link da Lia não encontrado.');
  const { data: servicos } = await db.from('internal_services').select('name, description, price, billing_type, lead_time_days').eq('active', true);
  const porNome = new Map<string, ServicoDoCatalogo>(
    (servicos ?? []).map((s) => [
      s.name,
      { name: s.name, description: s.description, price: Number(s.price), billingType: s.billing_type, leadTimeDays: s.lead_time_days ?? 0 },
    ])
  );
  const tab = tabelaBRL(new Map([...porNome].map(([n, s]) => [n, s.price])));
  const { data: ultimo } = await db.from('lead_kit_items').select('position').eq('kit_id', kit.id).order('position', { ascending: false }).limit(1).maybeSingle();
  const { error: e2 } = await db.from('lead_kit_items').upsert(
    { kit_id: kit.id, lead_id: lead.id, position: (ultimo?.position ?? -1) + 1, ...valoresDoItem(LEAD, porNome, tab) },
    { onConflict: 'kit_id,lead_id' }
  );
  if (e2) throw e2;
  console.log(`Lead de teste pronto. Diagnóstico: https://www.prog-imports.com/diagnostico/${lead.public_token}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
