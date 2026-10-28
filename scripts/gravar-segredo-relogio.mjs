// Grava ATENDENTE_TICK_SECRET (do .env.local) no Vault do Supabase, pela função
// public.atendente_gravar_segredo_do_relogio (migration 0068). O valor nunca é impresso.
// Uso: node scripts/gravar-segredo-relogio.mjs
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const chave = env.ATENDENTE_SUPABASE_KEY || env.SUPABASE_SECRET_KEY;
const valor = env.ATENDENTE_TICK_SECRET;
if (!url || !chave || !valor) {
  console.error('Faltando no .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY ou ATENDENTE_TICK_SECRET.');
  process.exit(1);
}
const r = await fetch(`${url}/rest/v1/rpc/atendente_gravar_segredo_do_relogio`, {
  method: 'POST',
  headers: { apikey: chave, authorization: `Bearer ${chave}`, 'content-type': 'application/json' },
  body: JSON.stringify({ p_valor: valor }),
});
console.log(r.ok ? 'Segredo do relógio gravado no Vault.' : `Falhou (${r.status}): ${await r.text()}`);
// exitCode em vez de process.exit(): no Windows, sair na hora depois do fetch derruba o Node.
process.exitCode = r.ok ? 0 : 1;
