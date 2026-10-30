/**
 * Programa do PC da Captação: atende os pedidos de busca feitos no painel
 * (tabela lead_search_requests, inclusive pelo celular).
 *
 * Para cada pedido: roda o captar.ps1 (Google Maps + conferência dos sites),
 * importa os leads com a mesma lógica do painel (src/lib/captacao.ts e
 * captacao-gravar.ts), tira o print do site de cada lead num iPhone simulado
 * e guarda no Storage (bucket diagnosticos), que aparece no diagnóstico.
 *
 *   npx -y tsx scripts/captacao/worker.ts            # fica de plantão (a cada 60 s)
 *   npx -y tsx scripts/captacao/worker.ts --uma-vez  # atende a fila e sai
 *   npx -y tsx scripts/captacao/worker.ts --importar a.csv b.csv   # só importa (+ prints)
 *
 * Usa NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY do .env.local (a chave
 * secreta é para scripts locais; nunca vai para a Vercel). Para testar no
 * banco local: CAPTACAO_SUPABASE_URL e CAPTACAO_SUPABASE_KEY vencem o .env.local.
 */

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/supabase/database.types';
import { linhasDoCsv, registrosDaImportacao, situacaoDoSite, urlComProtocolo, type Pais } from '../../src/lib/captacao';
import { gravarLeads } from '../../src/lib/captacao-gravar';

const RAIZ = resolve(__dirname, '..', '..');
const CAPTAR = join(RAIZ, 'scripts', 'captacao', 'captar.ps1');
// Playwright já instalado com o WebKit para o simulador de iPhone (TESTES-CELULAR.md).
const PASTA_PLAYWRIGHT = resolve(RAIZ, '..', '..', '..', '3 - Ferramentas', 'celular-ios');
const BUCKET = 'diagnosticos';
const MAX_PRINTS_POR_BUSCA = 80;

type Cliente = SupabaseClient<Database>;

function lerEnvLocal(): Record<string, string> {
  const p = join(RAIZ, '.env.local');
  if (!existsSync(p)) return {};
  const env: Record<string, string> = {};
  for (const linha of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

function conectar(): Cliente {
  const env = lerEnvLocal();
  const url = process.env.CAPTACAO_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.CAPTACAO_SUPABASE_KEY || env.SUPABASE_SECRET_KEY;
  if (!url || !chave) {
    throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY no .env.local (veja o README).');
  }
  return createClient<Database>(url, chave, { auth: { persistSession: false } });
}

const log = (...a: unknown[]) => console.log(new Date().toLocaleTimeString('pt-BR'), ...a);

/** Roda o captar.ps1 de uma busca e devolve os CSVs gerados. */
function captar(niche: string, city: string, country: Pais): Promise<string[]> {
  const saida = join(tmpdir(), `captacao-${Date.now()}.json`);
  const args = [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    CAPTAR,
    '-Ramo',
    niche,
    '-Cidade',
    city,
    '-Pais',
    country,
    '-SemAbrir',
    '-SaidaJson',
    saida,
  ];
  return new Promise((ok, falha) => {
    const p = execFile('powershell.exe', args, { maxBuffer: 64 * 1024 * 1024 }, (erro) => {
      if (!existsSync(saida)) return falha(erro ?? new Error('O captar.ps1 não gerou a lista de arquivos.'));
      const arquivos = JSON.parse(readFileSync(saida, 'utf8').replace(/^﻿/, '')) as string[] | string | null;
      unlinkSync(saida);
      ok(Array.isArray(arquivos) ? arquivos : arquivos ? [arquivos] : []);
    });
    p.stdout?.on('data', (d: Buffer) => {
      const t = d.toString().trim();
      if (/Done|Sites conferidos|falhou|Falhou/.test(t)) log('  ', t.split(/\r?\n/).pop());
    });
  });
}

/** Importa os CSVs (mesma lógica do painel) e devolve as chaves dos leads com site próprio. */
async function importar(supabase: Cliente, arquivos: string[]) {
  let novos = 0;
  let atualizados = 0;
  const comSite: { chave: string; site: string }[] = [];
  for (const arq of arquivos) {
    const registros = registrosDaImportacao(linhasDoCsv(readFileSync(arq, 'utf8')), {
      pais: 'BR',
      niche: null,
      city: null,
      state: null,
      source: basename(arq),
    });
    const r = await gravarLeads(supabase, registros);
    if (!r.ok) throw new Error(`Importação de ${basename(arq)}: ${r.erro}`);
    novos += r.novos;
    atualizados += r.atualizados;
    for (const reg of registros) {
      const s = situacaoDoSite(reg.website ?? null, reg.site_check ?? null);
      if (reg.website && !['sem_site', 'rede_social', 'fora'].includes(s))
        comSite.push({ chave: reg.dedupe_key, site: reg.website });
    }
  }
  return { novos, atualizados, comSite };
}

/** Print do site num iPhone 15 (WebKit), guardado no Storage; grava screenshot_url no lead. */
async function tirarPrints(supabase: Cliente, alvos: { chave: string; site: string }[]) {
  if (!alvos.length) return 0;
  if (!existsSync(join(PASTA_PLAYWRIGHT, 'node_modules', 'playwright'))) {
    log('   prints pulados: Playwright não encontrado em', PASTA_PLAYWRIGHT);
    return 0;
  }
  // Não refaz print de quem já tem (reimportação da mesma busca).
  const { data: jaTem } = await supabase
    .from('leads')
    .select('dedupe_key')
    .in(
      'dedupe_key',
      alvos.map((a) => a.chave)
    )
    .not('screenshot_url', 'is', null);
  const feitos = new Set((jaTem ?? []).map((r) => r.dedupe_key));
  const fila = alvos.filter((a) => !feitos.has(a.chave)).slice(0, MAX_PRINTS_POR_BUSCA);
  if (!fila.length) return 0;

  const { webkit, devices } = createRequire(join(PASTA_PLAYWRIGHT, 'package.json'))('playwright');
  const navegador = await webkit.launch();
  const contexto = await navegador.newContext({ ...devices['iPhone 15'] });
  let ok = 0;
  try {
    for (const alvo of fila) {
      const pagina = await contexto.newPage();
      try {
        await pagina.goto(urlComProtocolo(alvo.site), { waitUntil: 'domcontentloaded', timeout: 20000 });
        await pagina.waitForTimeout(2500); // fontes, imagens e banners de cookie
        const jpg: Buffer = await pagina.screenshot({ type: 'jpeg', quality: 70 });
        const nome = `${createHash('sha1').update(alvo.chave).digest('hex')}.jpg`;
        const { error } = await supabase.storage.from(BUCKET).upload(nome, jpg, { contentType: 'image/jpeg', upsert: true });
        if (error) throw error;
        const url = supabase.storage.from(BUCKET).getPublicUrl(nome).data.publicUrl;
        await supabase.from('leads').update({ screenshot_url: url }).eq('dedupe_key', alvo.chave);
        ok++;
      } catch {
        // Site lento ou bloqueando robô: segue sem print (o diagnóstico funciona sem ele).
      } finally {
        await pagina.close();
      }
    }
  } finally {
    await navegador.close();
  }
  return ok;
}

/**
 * Pesquisa do lead indicado pelo Arthur (0094): a busca no Maps foi por ESTE lead. Escolhe o lugar que
 * bate (mesmo telefone ou nome parecido) e completa só os campos vazios do lead; o que achou entra em
 * leads.pesquisa como "a confirmar" para a Lia confirmar com o cliente. Não importa a lista toda.
 */
async function completarLead(supabase: Cliente, leadId: string, arquivos: string[]): Promise<string> {
  const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).maybeSingle();
  if (!lead) return 'lead não existe mais';
  const linhas = arquivos.flatMap((a) => linhasDoCsv(readFileSync(a, 'utf8')));
  const fim = (t: string | null) => (t ?? '').replace(/\D/g, '').slice(-8);
  const palavras = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  const doLead = new Set(palavras(lead.name));
  const pontos = (l: (typeof linhas)[number]) =>
    (fim(l.phone) && fim(l.phone) === fim(lead.phone) ? 100 : 0) + palavras(l.name).filter((w) => doLead.has(w)).length * 10;
  const melhor = [...linhas].sort((a, b) => pontos(b) - pontos(a))[0];
  if (!melhor || pontos(melhor) < 20) return `nada no Maps que bata com ${lead.name} (${linhas.length} resultado(s))`;
  const vazio = (k: keyof typeof lead) => lead[k] === null || lead[k] === '';
  const novos: Record<string, unknown> = {};
  const par: [keyof typeof lead, unknown][] = [
    ['address', melhor.address],
    ['website', melhor.website],
    ['category', melhor.category],
    ['rating', melhor.rating],
    ['review_count', melhor.reviewCount],
    ['instagram', melhor.instagram],
    ['facebook', melhor.facebook],
    ['linkedin', melhor.linkedin],
    ['place_id', melhor.placeId],
    ['maps_url', melhor.mapsUrl],
    ['latitude', melhor.latitude],
    ['longitude', melhor.longitude],
    ['site_check', melhor.siteCheck],
  ];
  for (const [k, v] of par) if (v !== null && v !== undefined && v !== '' && vazio(k)) novos[k as string] = v;
  type Item = { campo: string; valor: string; fonte: string; situacao: string };
  const pesquisa = (lead.pesquisa ?? { itens: [] }) as { itens?: Item[] };
  const itens: Item[] = [
    { campo: 'Google Maps', valor: `${melhor.name}${melhor.address ? `, ${melhor.address}` : ''}`, fonte: melhor.mapsUrl ?? 'Google Maps', situacao: 'a_confirmar' },
    ...(melhor.rating ? [{ campo: 'Nota no Google', valor: `${melhor.rating} (${melhor.reviewCount ?? 0} avaliações)`, fonte: melhor.mapsUrl ?? 'Google Maps', situacao: 'a_confirmar' }] : []),
  ];
  pesquisa.itens = [...(pesquisa.itens ?? []), ...itens.filter((i) => !(pesquisa.itens ?? []).some((x) => x.campo === i.campo))];
  await supabase.from('leads').update({ ...novos, pesquisa }).eq('id', leadId);
  if (melhor.website && !lead.screenshot_url) await tirarPrints(supabase, [{ chave: lead.dedupe_key, site: melhor.website }]);
  return `achou ${melhor.name}: ${Object.keys(novos).length} campo(s) completado(s)`;
}

async function atenderUm(supabase: Cliente): Promise<boolean> {
  const { data: pedido } = await supabase
    .from('lead_search_requests')
    .select('*')
    .eq('status', 'pendente')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!pedido) return false;

  // Só pega se ainda estiver pendente (duas janelas abertas não pegam o mesmo).
  const { data: pego } = await supabase
    .from('lead_search_requests')
    .update({ status: 'rodando', started_at: new Date().toISOString(), message: null })
    .eq('id', pedido.id)
    .eq('status', 'pendente')
    .select('id')
    .maybeSingle();
  if (!pego) return true;

  log(`Buscando "${pedido.niche}" em ${pedido.city} (${pedido.country})`);
  try {
    const arquivos = await captar(pedido.niche, pedido.city, pedido.country as Pais);
    if (!arquivos.length) throw new Error('A busca não trouxe arquivo (Google bloqueou ou não achou nada).');
    if (pedido.lead_id) {
      const msg = await completarLead(supabase, pedido.lead_id, arquivos);
      await supabase.from('lead_search_requests').update({ status: 'feito', finished_at: new Date().toISOString(), new_leads: 0, message: msg }).eq('id', pedido.id);
      log('  pesquisa do lead:', msg);
      return true;
    }
    const r = await importar(supabase, arquivos);
    const prints = await tirarPrints(supabase, r.comSite);
    const msg = `${r.novos} novo(s), ${r.atualizados} atualizado(s), ${prints} print(s)`;
    await supabase
      .from('lead_search_requests')
      .update({ status: 'feito', finished_at: new Date().toISOString(), new_leads: r.novos, message: msg })
      .eq('id', pedido.id);
    log('  feito:', msg);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from('lead_search_requests')
      .update({ status: 'erro', finished_at: new Date().toISOString(), message: msg.slice(0, 500) })
      .eq('id', pedido.id);
    log('  erro:', msg);
  }
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const supabase = conectar();

  const i = args.indexOf('--importar');
  if (i >= 0) {
    const arquivos = args.slice(i + 1);
    const r = await importar(supabase, arquivos);
    const prints = await tirarPrints(supabase, r.comSite);
    log(`${arquivos.length} arquivo(s): ${r.novos} novo(s), ${r.atualizados} atualizado(s), ${prints} print(s).`);
    return;
  }

  // Pedido que ficou "rodando" (PC desligou no meio) volta para a fila.
  await supabase.from('lead_search_requests').update({ status: 'pendente' }).eq('status', 'rodando');

  const umaVez = args.includes('--uma-vez');
  log(umaVez ? 'Atendendo a fila de buscas…' : 'Captação: de plantão. Deixe esta janela aberta (Ctrl+C para parar).');
  for (;;) {
    while (await atenderUm(supabase)) {
      /* atende um por vez até a fila acabar */
    }
    if (umaVez) return log('Fila vazia.');
    await new Promise((r) => setTimeout(r, 60_000));
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
