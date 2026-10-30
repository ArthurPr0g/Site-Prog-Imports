// Baixa para o OneDrive os arquivos que os clientes fechados mandaram pelo
// WhatsApp. Roda no PC do Arthur a cada 5 minutos (tarefa agendada
// "Prog - Arquivos dos clientes", criada por instalar-tarefa.ps1).
//
// Pasta de cada cliente: OneDrive\05 - 💼 Negócios\1 - Prog Soluções\2 - Clientes\
//   "<Empresa> - <Primeiro nome do responsável>", criada a partir de "# Modelo".
// Fotos, vídeos e áudios vão para "2 - Mídias"; documentos para "4 - Insumos".
//
// Usa NEXT_PUBLIC_SUPABASE_URL e ATENDENTE_SUPABASE_KEY do .env.local.
// Uso manual: node scripts/onedrive/sincronizar-clientes.mjs [--simular]

import { readFileSync, existsSync, mkdirSync, readdirSync, cpSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..');
const simular = process.argv.includes('--simular');

const LOG_DIR = join(process.env.LOCALAPPDATA ?? homedir(), 'ProgSolucoes');
mkdirSync(LOG_DIR, { recursive: true });
const log = (msg) => {
  const linha = `${new Date().toLocaleString('pt-BR')} ${msg}`;
  console.log(linha);
  try {
    appendFileSync(join(LOG_DIR, 'arquivos-dos-clientes.log'), linha + '\n', 'utf8');
  } catch {}
};

const env = Object.fromEntries(
  readFileSync(join(RAIZ, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')])
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE = env.ATENDENTE_SUPABASE_KEY || env.SUPABASE_SECRET_KEY;
if (!URL || !CHAVE) {
  log('Faltam NEXT_PUBLIC_SUPABASE_URL e ATENDENTE_SUPABASE_KEY no .env.local.');
  process.exit(1);
}
const CAB = { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` };

// Pasta "2 - Clientes" dentro do OneDrive (os nomes têm emoji: acha pelo começo).
function pastaDosClientes() {
  const od = process.env.OneDrive || process.env.OneDriveConsumer || join(homedir(), 'OneDrive');
  const negocios = readdirSync(od).find((n) => n.startsWith('05 -'));
  if (!negocios) throw new Error(`Não achei a pasta "05 - Negócios" em ${od}.`);
  const p = join(od, negocios, '1 - Prog Soluções', '2 - Clientes');
  if (!existsSync(p)) throw new Error(`Não achei ${p}.`);
  return p;
}

// Windows não aceita < > : " / \ | ? * nem ponto ou espaço no fim.
const limpar = (s) => s.replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
const primeiroNome = (s) => (s ?? '').trim().split(/\s+/)[0] ?? '';

const SUBPASTA = { image: '2 - Mídias', video: '2 - Mídias', audio: '2 - Mídias', document: '4 - Insumos' };

function nomeDoArquivo(m, ext) {
  const d = new Date(m.created_at);
  const p = (n) => String(n).padStart(2, '0');
  const quando = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}h${p(d.getMinutes())}`;
  const base = m.media_name ? limpar(m.media_name.replace(/\.[a-z0-9]{1,5}$/i, '')) : { image: 'Foto', video: 'Vídeo', audio: 'Áudio', document: 'Documento' }[m.media_type] ?? 'Arquivo';
  return `${quando} - ${base}.${ext}`;
}

async function main() {
  const clientes = pastaDosClientes();
  const q = new URLSearchParams({
    select: 'id,storage_path,media_type,media_name,created_at,ia_conversations!inner(contact_name,leads!inner(name,responsible_name))',
    storage_path: 'not.is.null',
    synced_at: 'is.null',
    order: 'created_at.asc',
    limit: '50',
  });
  const r = await fetch(`${URL}/rest/v1/ia_messages?${q}&storage_path=neq.expirado`, { headers: CAB });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  const pendentes = await r.json();
  if (!pendentes.length) return;

  for (const m of pendentes) {
    const conversa = m.ia_conversations;
    const lead = conversa.leads;
    const responsavel = primeiroNome(lead.responsible_name) || primeiroNome(conversa.contact_name);
    // "Pessoa - Empresa" (padrão do Arthur desde 30/10/2026), igual a nomeDaPasta em prestacao-do-sinal.ts.
    const jaTem = responsavel && lead.name.toLowerCase().startsWith(`${responsavel.toLowerCase()} - `);
    const pasta = join(clientes, limpar(responsavel && !jaTem ? `${responsavel} - ${lead.name}` : lead.name));
    if (!existsSync(pasta)) {
      log(`Pasta nova: ${pasta}`);
      if (!simular) {
        const modelo = join(clientes, '# Modelo');
        if (existsSync(modelo)) cpSync(modelo, pasta, { recursive: true });
        else mkdirSync(pasta, { recursive: true });
      }
    }
    const destinoDir = join(pasta, SUBPASTA[m.media_type] ?? '4 - Insumos');
    const ext = m.storage_path.split('.').pop();
    let destino = join(destinoDir, nomeDoArquivo(m, ext));
    for (let i = 2; existsSync(destino); i++) destino = destino.replace(/( \(\d+\))?(\.[^.]+)$/, ` (${i})$2`);
    if (simular) {
      log(`(simulação) ${destino}`);
      continue;
    }
    const arq = await fetch(`${URL}/storage/v1/object/clientes/${m.storage_path}`, { headers: CAB });
    if (!arq.ok) {
      log(`Falhou ao baixar ${m.storage_path}: ${arq.status}`);
      continue;
    }
    mkdirSync(destinoDir, { recursive: true });
    writeFileSync(destino, Buffer.from(await arq.arrayBuffer()));
    const ok = await fetch(`${URL}/rest/v1/ia_messages?id=eq.${m.id}`, {
      method: 'PATCH',
      headers: { ...CAB, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ synced_at: new Date().toISOString() }),
    });
    log(ok.ok ? `Salvo: ${destino}` : `Salvo, mas não marquei no banco (${ok.status}): ${destino}`);
  }
}

main().catch((e) => {
  log(`Erro: ${e.message}`);
  process.exitCode = 1;
});
