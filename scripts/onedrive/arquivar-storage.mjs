// Arquiva no PC (e no OneDrive) o que pesa no Storage do Supabase (plano grátis, 1 GB) — pedido do Arthur, 31/10/2026.
//
// O site não grava no disco, então quem arquiva é o PC do Arthur:
// - Áudios de reunião (bucket "reunioes") e prints de ajuste (bucket "clientes", prefixo "ajustes/") com mais de
//   60 dias são baixados para a pasta do cliente:
//     C:\Apps\1 - Dev\Prog Soluções\1 - Clientes\<cliente>\Reuniões  (ou \Ajustes)
//   e copiados para a pasta dele no OneDrive (05 - Negócios\1 - Prog Soluções\2 - Clientes\<cliente>\2 - Mídias\...),
//   seguindo a regra de backup do Arthur (sempre o disco e o OneDrive).
// - Só depois de gravar e conferir o tamanho nos dois lugares: registra em arquivos_arquivados (a tela mostra
//   "arquivado no OneDrive") e apaga do Storage.
//
// Roda toda semana pela tarefa "Prog - Arquivar Storage" (instalar-tarefa-arquivar.ps1, domingo 10h).
// Usa NEXT_PUBLIC_SUPABASE_URL e ATENDENTE_SUPABASE_KEY do .env.local.
// Uso manual: node scripts/onedrive/arquivar-storage.mjs [--simular] [--dias 60] [--so <bucket>/<caminho>]

import { readFileSync, existsSync, mkdirSync, readdirSync, writeFileSync, statSync, appendFileSync, cpSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..');
const args = process.argv.slice(2);
const simular = args.includes('--simular');
const dias = Number(args[args.indexOf('--dias') + 1]) >= 0 && args.includes('--dias') ? Number(args[args.indexOf('--dias') + 1]) : 60;
const so = args.includes('--so') ? args[args.indexOf('--so') + 1] : null;

const CLIENTES_LOCAL = 'C:\\Apps\\1 - Dev\\Prog Soluções\\1 - Clientes';

const LOG_DIR = join(process.env.LOCALAPPDATA ?? homedir(), 'ProgSolucoes');
mkdirSync(LOG_DIR, { recursive: true });
const log = (msg) => {
  const linha = `${new Date().toLocaleString('pt-BR')} ${msg}`;
  console.log(linha);
  try {
    appendFileSync(join(LOG_DIR, 'arquivar-storage.log'), linha + '\n', 'utf8');
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
const JSON_CAB = { ...CAB, 'Content-Type': 'application/json' };

// Windows não aceita < > : " / \ | ? * nem ponto ou espaço no fim.
const limpar = (s) => String(s ?? '').replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
const primeiroNome = (s) => (s ?? '').trim().split(/\s+/)[0] ?? '';
/** "Pessoa - Empresa", igual a nomeDaPasta (prestacao-do-sinal.ts) e ao sincronizar-clientes.mjs. */
function nomeDaPasta(empresa, responsavel) {
  const p = primeiroNome(responsavel);
  const jaTem = p && empresa.toLowerCase().startsWith(`${p.toLowerCase()} - `);
  return limpar(p && !jaTem ? `${p} - ${empresa}` : empresa);
}

function pastaDoOneDrive() {
  const od = process.env.OneDrive || process.env.OneDriveConsumer || join(homedir(), 'OneDrive');
  const negocios = existsSync(od) ? readdirSync(od).find((n) => n.startsWith('05 -')) : null;
  const p = negocios ? join(od, negocios, '1 - Prog Soluções', '2 - Clientes') : null;
  return p && existsSync(p) ? p : null;
}

async function get(caminho) {
  const r = await fetch(`${URL}/rest/v1/${caminho}`, { headers: CAB });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}

/** Nome da pasta do cliente (e o id da reunião, quando for áudio de reunião). */
async function clienteDoObjeto(bucket, caminho) {
  if (bucket === 'reunioes') {
    const id = caminho.split('/')[0];
    if (!/^[0-9a-f-]{36}$/i.test(id)) return { cliente: null, reuniaoId: null };
    const [r] = await get(`reunioes?id=eq.${id}&select=id,titulo,leads(name,responsible_name),projetos(pasta,cliente,responsavel)`);
    if (!r) return { cliente: null, reuniaoId: null };
    if (r.projetos?.pasta) return { cliente: basename(r.projetos.pasta), reuniaoId: r.id };
    if (r.projetos?.cliente) return { cliente: nomeDaPasta(r.projetos.cliente, r.projetos.responsavel), reuniaoId: r.id };
    if (r.leads?.name) return { cliente: nomeDaPasta(r.leads.name, r.leads.responsible_name), reuniaoId: r.id };
    return { cliente: null, reuniaoId: r.id };
  }
  // clientes/ajustes/<conversa>/<arquivo>
  const conversa = caminho.split('/')[1];
  if (!/^[0-9a-f-]{36}$/i.test(conversa ?? '')) return { cliente: null, reuniaoId: null };
  const [c] = await get(`ia_conversations?id=eq.${conversa}&select=contact_name,lead_id,leads(name,responsible_name)`);
  if (!c?.leads?.name) return { cliente: c?.contact_name ? limpar(c.contact_name) : null, reuniaoId: null };
  const projs = c.lead_id ? await get(`projetos?lead_id=eq.${c.lead_id}&select=pasta,cliente,responsavel&order=vendido_em.desc&limit=1`) : [];
  if (projs[0]?.pasta) return { cliente: basename(projs[0].pasta), reuniaoId: null };
  return { cliente: nomeDaPasta(c.leads.name, c.leads.responsible_name || c.contact_name), reuniaoId: null };
}

function semColisao(destino) {
  let d = destino;
  for (let i = 2; existsSync(d); i++) d = destino.replace(/(\.[^.]+)$/, ` (${i})$1`);
  return d;
}

async function main() {
  const r = await fetch(`${URL}/rest/v1/rpc/objetos_para_arquivar`, { method: 'POST', headers: JSON_CAB, body: JSON.stringify({ p_dias: dias }) });
  if (!r.ok) throw new Error(`objetos_para_arquivar ${r.status}: ${await r.text()}`);
  let objetos = await r.json();
  if (so) objetos = objetos.filter((o) => `${o.bucket}/${o.caminho}` === so);
  if (!objetos.length) {
    log(`Nada para arquivar (mais de ${dias} dias).`);
    return;
  }
  const onedrive = pastaDoOneDrive();
  if (!onedrive) log('Aviso: pasta "2 - Clientes" do OneDrive não encontrada; arquivo fica só no disco e NÃO sai do Storage.');
  let liberados = 0;

  for (const o of objetos) {
    const { cliente, reuniaoId } = await clienteDoObjeto(o.bucket, o.caminho);
    const nomeCliente = cliente || '# Sem cliente';
    const sub = o.bucket === 'reunioes' ? 'Reuniões' : 'Ajustes';
    const quando = new Date(o.criado_em).toISOString().slice(0, 10);
    const nomeArq = `${quando} - ${limpar(o.caminho.split('/').slice(1).join(' '))}`;
    const local = semColisao(join(CLIENTES_LOCAL, nomeCliente, sub, nomeArq));
    const nuvem = onedrive ? semColisao(join(onedrive, nomeCliente, '2 - Mídias', sub, nomeArq)) : null;
    if (simular) {
      log(`(simulação) ${o.bucket}/${o.caminho} (${o.bytes} bytes) -> ${local}${nuvem ? ` + ${nuvem}` : ''}`);
      continue;
    }
    const arq = await fetch(`${URL}/storage/v1/object/${o.bucket}/${o.caminho.split('/').map(encodeURIComponent).join('/')}`, { headers: CAB });
    if (!arq.ok) {
      log(`Falhou ao baixar ${o.bucket}/${o.caminho}: ${arq.status}`);
      continue;
    }
    const dados = Buffer.from(await arq.arrayBuffer());
    mkdirSync(dirname(local), { recursive: true });
    writeFileSync(local, dados);
    if (nuvem) {
      mkdirSync(dirname(nuvem), { recursive: true });
      cpSync(local, nuvem);
    }
    // Confere antes de apagar: o mesmo tamanho nos dois lugares.
    const ok = statSync(local).size === dados.length && (!nuvem || statSync(nuvem).size === dados.length);
    if (!ok || !nuvem) {
      log(`Guardado em ${local}, mas ${!ok ? 'o tamanho não bateu' : 'sem OneDrive'}: continua no Storage.`);
      continue;
    }
    const reg = await fetch(`${URL}/rest/v1/arquivos_arquivados?on_conflict=bucket,caminho`, {
      method: 'POST',
      headers: { ...JSON_CAB, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ bucket: o.bucket, caminho: o.caminho, cliente, local_path: local, onedrive_path: nuvem, bytes: dados.length, reuniao_id: reuniaoId }),
    });
    if (!reg.ok) {
      log(`Guardado, mas não registrei no banco (${reg.status}: ${await reg.text()}): continua no Storage.`);
      continue;
    }
    const del = await fetch(`${URL}/storage/v1/object/${o.bucket}`, { method: 'DELETE', headers: JSON_CAB, body: JSON.stringify({ prefixes: [o.caminho] }) });
    if (!del.ok) {
      log(`Guardado e registrado, mas não apaguei do Storage (${del.status}): ${o.bucket}/${o.caminho}`);
      continue;
    }
    liberados += dados.length;
    log(`Arquivado: ${o.bucket}/${o.caminho} -> ${local} + ${nuvem}`);
  }
  if (liberados) log(`Liberados ${(liberados / 1024 ** 2).toFixed(1)} MB do Storage.`);
}

main().catch((e) => {
  log(`Erro: ${e.message}`);
  process.exitCode = 1;
});
