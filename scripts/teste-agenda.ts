/** Confere se o Google Agenda conectado responde (só lê os horários ocupados dos próximos 3 dias). */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const RAIZ = resolve(__dirname, '..');
for (const l of readFileSync(join(RAIZ, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
async function main() {
  const { dbDoAtendente } = await import('../src/lib/atendente/db');
  const { ocupadosNaAgenda } = await import('../src/lib/google-agenda');
  const de = new Date();
  const ate = new Date(Date.now() + 3 * 864e5);
  const r = await ocupadosNaAgenda(dbDoAtendente(), de, ate);
  console.log(r === null ? 'NÃO RESPONDEU' : `ok: ${r.length} horário(s) ocupado(s) nos próximos 3 dias`);
}
main().catch((e) => { console.error(e); process.exit(1); });
