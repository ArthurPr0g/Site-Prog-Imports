'use client';

// Onde a gravação fica (pedido do Arthur, 31/10/2026): na pasta do cliente dentro de "1 - Clientes", que tem
// backup no OneDrive. O Arthur escolhe "1 - Clientes" UMA vez (File System Access API); o "atalho" da pasta fica
// no IndexedDB deste navegador. Em cada reunião: acha a subpasta do cliente pelo nome (ou cria
// "<Pessoa> - <Empresa>") e, dentro dela, "Reuniões". Lá vão o vídeo (.webm) e a transcrição (.txt).
//
// Sem a API (Brave, que bloqueia por padrão; Firefox; Safari) ou sem permissão: o vídeo e a transcrição são
// baixados automaticamente ao encerrar, já com o nome certo.

type Permissao = 'granted' | 'denied' | 'prompt';
type ComPermissao = FileSystemDirectoryHandle & {
  queryPermission?: (o: { mode: 'readwrite' }) => Promise<Permissao>;
  requestPermission?: (o: { mode: 'readwrite' }) => Promise<Permissao>;
  values?: () => AsyncIterable<FileSystemHandle>;
};
type ComSeletor = Window & { showDirectoryPicker?: (o?: { id?: string; mode?: 'readwrite'; startIn?: string }) => Promise<FileSystemDirectoryHandle> };

const BANCO = 'prog-sala-de-reuniao';
const CHAVE = 'pasta-clientes';

export const temSeletorDePasta = () => typeof window !== 'undefined' && typeof (window as ComSeletor).showDirectoryPicker === 'function';

/** Brave: avisa como liberar (flag) ou como escolher onde salvar os downloads. */
export async function ehBrave(): Promise<boolean> {
  const b = (navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } }).brave;
  try {
    return !!(b?.isBrave && (await b.isBrave()));
  } catch {
    return false;
  }
}

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    const r = indexedDB.open(BANCO, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('pastas');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => falha(r.error);
  });
}

async function lerAtalho(): Promise<ComPermissao | null> {
  try {
    const db = await abrirBanco();
    return await new Promise((ok) => {
      const r = db.transaction('pastas').objectStore('pastas').get(CHAVE);
      r.onsuccess = () => ok((r.result as ComPermissao) ?? null);
      r.onerror = () => ok(null);
    });
  } catch {
    return null;
  }
}

async function guardarAtalho(h: FileSystemDirectoryHandle) {
  const db = await abrirBanco();
  await new Promise<void>((ok, falha) => {
    const t = db.transaction('pastas', 'readwrite');
    t.objectStore('pastas').put(h, CHAVE);
    t.oncomplete = () => ok();
    t.onerror = () => falha(t.error);
  });
}

export type PastaLigada = { nome: string; permissao: Permissao } | null;

/** Pasta raiz já escolhida neste navegador (sem pedir nada). */
export async function pastaLigada(): Promise<PastaLigada> {
  if (!temSeletorDePasta()) return null;
  const h = await lerAtalho();
  if (!h) return null;
  const permissao = (await h.queryPermission?.({ mode: 'readwrite' })) ?? 'prompt';
  return { nome: h.name, permissao };
}

/** Botão "Escolher pasta das gravações": o Arthur aponta "1 - Clientes". Precisa de clique (gesto). */
export async function escolherPastaRaiz(): Promise<PastaLigada> {
  const w = window as ComSeletor;
  if (!w.showDirectoryPicker) return null;
  const h = await w.showDirectoryPicker({ id: 'prog-clientes', mode: 'readwrite', startIn: 'documents' });
  await guardarAtalho(h);
  return { nome: h.name, permissao: 'granted' };
}

/** Confirma a permissão de escrita (pede de novo se o Chrome esqueceu). Chamar dentro de um clique. */
export async function liberarPasta(): Promise<FileSystemDirectoryHandle | null> {
  const h = await lerAtalho();
  if (!h) return null;
  let p = (await h.queryPermission?.({ mode: 'readwrite' })) ?? 'prompt';
  if (p === 'prompt') p = (await h.requestPermission?.({ mode: 'readwrite' })) ?? 'denied';
  return p === 'granted' ? h : null;
}

const normal = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Pasta "Reuniões" do cliente: acha a subpasta pelo nome exato (sem acento/caixa) ou pela empresa
 * ("Matheus - Altiv Capital" ↔ "Altiv Capital"); se não houver, cria "<Pessoa> - <Empresa>".
 */
export async function pastaDeReunioesDoCliente(raiz: FileSystemDirectoryHandle, nomeDaPasta: string): Promise<FileSystemDirectoryHandle> {
  const alvo = normal(nomeDaPasta);
  const empresa = normal(nomeDaPasta.split(' - ').slice(1).join(' - ') || nomeDaPasta);
  let achada: FileSystemDirectoryHandle | null = null;
  let parecida: FileSystemDirectoryHandle | null = null;
  const valores = (raiz as ComPermissao).values?.();
  if (valores) {
    for await (const e of valores) {
      if (e.kind !== 'directory') continue;
      const n = normal(e.name);
      if (n === alvo) {
        achada = e as FileSystemDirectoryHandle;
        break;
      }
      if (!parecida && empresa.length >= 4 && (n.endsWith(` - ${empresa}`) || n === empresa)) parecida = e as FileSystemDirectoryHandle;
    }
  }
  const cliente = achada ?? parecida ?? (await raiz.getDirectoryHandle(nomeDaPasta, { create: true }));
  return cliente.getDirectoryHandle('Reuniões', { create: true });
}

/** Arquivo novo para escrever aos poucos (o vídeo vai sendo gravado no disco). */
export async function arquivoParaEscrever(pasta: FileSystemDirectoryHandle, nome: string): Promise<FileSystemWritableFileStream> {
  const f = await pasta.getFileHandle(nome, { create: true });
  return f.createWritable();
}

export async function salvarNaPasta(pasta: FileSystemDirectoryHandle, nome: string, conteudo: Blob | string) {
  const w = await arquivoParaEscrever(pasta, nome);
  await w.write(conteudo);
  await w.close();
}
