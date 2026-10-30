/**
 * Situação real de cada modelo de mensagem na Meta (consulta direta), comparada com a gravada no banco.
 *   npx -y tsx scripts/status-modelos.ts
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RAIZ = resolve(__dirname, '..');
for (const l of readFileSync(join(RAIZ, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

async function main() {
  const { dbDoAtendente } = await import('../src/lib/atendente/db');
  const { statusDoModelo } = await import('../src/lib/atendente/whatsapp-api');
  const { MODELOS } = await import('../src/lib/atendente/modelos');
  const db = dbDoAtendente();
  const { data: c } = await db.from('ia_config').select('waba_id, modelos').eq('id', true).single();
  const gravado = (c?.modelos ?? {}) as Record<string, string>;
  for (const m of MODELOS) console.log(m.nome.padEnd(24), 'Meta:', (await statusDoModelo(c!.waba_id!, m.nome)) ?? 'não existe', '| banco:', gravado[m.nome] ?? '-');
}
main().catch((e) => console.error(e));
