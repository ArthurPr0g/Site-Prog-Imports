// Grava chaves secretas na Vercel (produção) e no .env.local SEM passar pelo chat do Claude (30/10/2026):
// o Arthur cola a chave numa janela própria (o que digita não aparece) e o script grava nos dois lugares.
// Nada é impresso. Usado pelos atalhos "Ligar Asaas de verdade" e "Ligar Google Agenda".
//   node scripts/ligar-chaves.mjs asaas     -> ASAAS_API_KEY (produção) + ASAAS_AMBIENTE=producao + webhook novo
//   node scripts/ligar-chaves.mjs google    -> GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV = join(RAIZ, '.env.local');

function perguntar(texto, oculto) {
  return new Promise((ok) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (oculto) {
      rl._writeToOutput = (s) => { if (s.includes(texto)) rl.output.write(s); else rl.output.write('*'); };
    }
    rl.question(texto, (r) => { rl.close(); if (oculto) process.stdout.write('\n'); ok(r.trim()); });
  });
}

function gravar(nome, valor, sensivel = true) {
  execFileSync(
    process.platform === 'win32' ? 'vercel.cmd' : 'vercel',
    ['env', 'add', nome, 'production', '--project', 'site-prog-imports', '--scope', 'prog-solucoes', '--value', valor, ...(sensivel ? ['--sensitive'] : []), '--force', '--yes'],
    { cwd: RAIZ, stdio: 'ignore', shell: process.platform === 'win32' }
  );
  let s = readFileSync(ENV, 'utf8');
  const linha = `${nome}=${valor}`;
  s = new RegExp(`^${nome}=.*$`, 'm').test(s) ? s.replace(new RegExp(`^${nome}=.*$`, 'm'), linha) : `${s.replace(/\s*$/, '')}\n${linha}\n`;
  writeFileSync(ENV, s, 'utf8');
  console.log(`  ok: ${nome} gravada na Vercel e no .env.local`);
}

const qual = process.argv[2];
if (qual === 'asaas') {
  console.log('\nAsaas de verdade (produção)');
  console.log('No Asaas: Menu (seu nome) > Integrações > Chaves de API > Gerar chave. Copie e cole aqui.');
  console.log('A chave de produção começa com $aact_prod_ (a de teste tem "hmlg").\n');
  const chave = await perguntar('Cole a chave de PRODUÇÃO do Asaas e aperte Enter: ', true);
  if (!chave.startsWith('$aact_') || chave.includes('hmlg')) {
    console.log('\nEssa não parece a chave de produção (precisa começar com $aact_ e não ter "hmlg"). Nada foi gravado.');
    process.exit(1);
  }
  const email = await perguntar('E-mail para o Asaas avisar se o aviso de pagamento falhar: ', false);
  gravar('ASAAS_API_KEY', chave);
  gravar('ASAAS_AMBIENTE', 'producao', false);
  console.log('  registrando o aviso de pagamento (webhook) no Asaas de produção...');
  execFileSync(process.execPath, [join(RAIZ, 'scripts', 'asaas', 'registrar-webhook.mjs'), email], { cwd: RAIZ, stdio: 'inherit' });
} else if (qual === 'google') {
  console.log('\nGoogle Agenda');
  console.log('No Google Cloud: APIs e serviços > Credenciais > o cliente OAuth "Prog Soluções - Agenda". Copie o ID e a chave secreta.\n');
  const id = await perguntar('Cole o ID do cliente (termina com .apps.googleusercontent.com): ', false);
  const segredo = await perguntar('Cole a chave secreta do cliente: ', true);
  if (!id.endsWith('.apps.googleusercontent.com') || segredo.length < 10) {
    console.log('\nID ou chave não parecem certos. Nada foi gravado.');
    process.exit(1);
  }
  gravar('GOOGLE_CLIENT_ID', id, false);
  gravar('GOOGLE_CLIENT_SECRET', segredo);
} else {
  console.log('Uso: node scripts/ligar-chaves.mjs asaas | google');
  process.exit(1);
}
console.log('\nPronto. Avise o Claude no chat: "gravei". Ele publica de novo para a Vercel usar as chaves novas.');
