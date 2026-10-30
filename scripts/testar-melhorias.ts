/** Dispara agora o Bom dia (ao Arthur) e começa uma rodada do ensaio da Lia (o resto roda no relógio da pesquisa).
 *   npx -y tsx scripts/testar-melhorias.ts [bom_dia] [ensaio] */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const RAIZ = resolve(__dirname, '..');
for (const l of readFileSync(join(RAIZ, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
async function main() {
  const quais = process.argv.slice(2);
  const { dbDoAtendente } = await import('../src/lib/atendente/db');
  const { lerConfig } = await import('../src/lib/atendente/agente');
  const db = dbDoAtendente();
  const cfg = await lerConfig(db);
  if (quais.includes('bom_dia')) {
    const { bomDia } = await import('../src/lib/atendente/bom-dia');
    console.log('bom dia, blocos:', await bomDia(db, cfg, true));
    const { data } = await db.from('ia_avisos').select('titulo, via, status, error').order('created_at', { ascending: false }).limit(1).single();
    console.log(JSON.stringify(data));
  }
  if (quais.includes('ensaio')) {
    const { comecarEnsaio } = await import('../src/lib/atendente/ensaio-semanal');
    console.log('ensaio criado:', await comecarEnsaio(db, true));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
