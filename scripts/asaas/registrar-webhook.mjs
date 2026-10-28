// Registra no Asaas o webhook de cobranças (https://www.prog-imports.com/api/asaas/webhook)
// com um token novo, e grava o mesmo token na Vercel (ASAAS_WEBHOOK_TOKEN) e no
// .env.local. Nenhum segredo é impresso.
// Uso: node scripts/asaas/registrar-webhook.mjs <e-mail para avisos de falha>
import { readFileSync, appendFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const envPath = new URL('../../.env.local', import.meta.url);
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
);
const email = process.argv[2];
if (!env.ASAAS_API_KEY || !email) {
  console.error('Uso: node scripts/asaas/registrar-webhook.mjs <email>  (precisa de ASAAS_API_KEY no .env.local)');
  process.exit(1);
}
const base = env.ASAAS_AMBIENTE === 'producao' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';
const token = randomBytes(32).toString('hex');

const r = await fetch(`${base}/webhooks`, {
  method: 'POST',
  headers: { access_token: env.ASAAS_API_KEY, 'Content-Type': 'application/json', 'User-Agent': 'prog-imports' },
  body: JSON.stringify({
    name: 'Prog Imports - cobranças',
    url: 'https://www.prog-imports.com/api/asaas/webhook',
    email,
    enabled: true,
    interrupted: false,
    apiVersion: 3,
    authToken: token,
    sendType: 'SEQUENTIALLY',
    events: ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 'PAYMENT_OVERDUE', 'PAYMENT_REFUNDED'],
  }),
});
const j = await r.json().catch(() => ({}));
if (!r.ok) {
  console.error('O Asaas recusou:', JSON.stringify(j.errors ?? j));
  process.exitCode = 1;
} else {
  execFileSync(
    process.platform === 'win32' ? 'vercel.cmd' : 'vercel',
    ['env', 'add', 'ASAAS_WEBHOOK_TOKEN', 'production', '--project', 'site-prog-imports', '--scope', 'prog-solucoes', '--value', token, '--sensitive', '--force', '--yes'],
    { stdio: 'ignore', shell: process.platform === 'win32' }
  );
  if (!readFileSync(envPath, 'utf8').includes('ASAAS_WEBHOOK_TOKEN=')) appendFileSync(envPath, `ASAAS_WEBHOOK_TOKEN=${token}\n`, 'utf8');
  console.log(`Webhook registrado no Asaas (${env.ASAAS_AMBIENTE ?? 'sandbox'}), id ${j.id}. Token gravado na Vercel e no .env.local.`);
}
