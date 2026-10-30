/**
 * Manda um aviso ao Arthur pelo WhatsApp da Lia (mesmo caminho dos avisos do sistema: texto na janela de
 * 24 h, modelo aprovado fora dela, e-mail se nada der). Usado pelas rodadas de verificação do Claude Code.
 *   npx -y tsx scripts/avisar-dono.ts "Título" "Texto"
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RAIZ = resolve(__dirname, '..');
for (const l of readFileSync(join(RAIZ, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

async function main() {
  // Quebras de linha vão como "\n" literal: o npx no Windows corta o argumento na primeira quebra real.
  const [titulo, bruto] = process.argv.slice(2);
  const texto = bruto?.replace(/\\n/g, '\n');
  if (!titulo || !texto) throw new Error('Uso: avisar-dono.ts "Título" "Texto"');
  const { dbDoAtendente } = await import('../src/lib/atendente/db');
  const { lerConfig } = await import('../src/lib/atendente/agente');
  const { avisarArthur } = await import('../src/lib/atendente/avisos');
  const db = dbDoAtendente();
  // 3º argumento opcional: o link do aviso (padrão: página Gastos).
  await avisarArthur(db, await lerConfig(db), { titulo, texto, link: process.argv[4] || 'https://www.prog-imports.com/admin/gastos' });
  const { data } = await db.from('ia_avisos').select('via, status, error').order('created_at', { ascending: false }).limit(1).single();
  console.log(JSON.stringify(data));
}
main().catch((e) => console.error(e));
