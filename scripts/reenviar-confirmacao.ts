/**
 * Reenvia ao Arthur o próximo passo de uma indicação (financeiro, se ainda não respondeu; senão a confirmação).
 *   npx -y tsx scripts/reenviar-confirmacao.ts <id da encomenda>
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RAIZ = resolve(__dirname, '..');
for (const l of readFileSync(join(RAIZ, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

async function main() {
  const id = process.argv[2];
  if (!id) throw new Error('Uso: reenviar-confirmacao.ts <id>');
  const { dbDoAtendente } = await import('../src/lib/atendente/db');
  const { pedirConfirmacao } = await import('../src/lib/atendente/encomenda');
  const db = dbDoAtendente();
  const { data: c } = await db.from('ia_config').select('owner_whatsapp').eq('id', true).single();
  await pedirConfirmacao(db, id, String(c!.owner_whatsapp).replace(/\D/g, ''));
  const { data: a } = await db.from('ia_avisos').select('titulo, via, status, error').order('created_at', { ascending: false }).limit(1).single();
  console.log(JSON.stringify(a));
}
main().catch((e) => { console.error(e); process.exit(1); });
