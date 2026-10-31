// Consumo dos planos que têm teto (pedido do Arthur, 31/10/2026; migration 0116). Só no servidor.
//
// 1. Créditos do ElevenLabs (voz da Lia, plano Starter): lidos da API (/v1/user/subscription). Aviso no WhatsApp
//    a 80% e a 95%, uma vez por ciclo do plano. Passou de 95%: a voz dos CLIENTES muda sozinha para o
//    eleven_flash_v2_5 (metade do preço por caractere, segundo a documentação do ElevenLabs); a do Arthur continua.
//    Quando o ciclo renova, volta ao modelo normal.
// 2. Armazenamento do Supabase (plano grátis: 1 GB de arquivos e 500 MB de banco): soma dos objetos por bucket e o
//    tamanho do banco (função uso_do_armazenamento). Aviso a 80%, um por mês.
//
// ia_config.elevenlabs e armazenamento_avisos ainda não estão em database.types.ts (outros agentes mexem nele ao
// mesmo tempo): as leituras e gravações dessas colunas passam por `semTipos`.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbDoAtendente } from '@/lib/atendente/db';
import { avisarArthur } from '@/lib/atendente/avisos';
import { lerConfig } from '@/lib/atendente/agente';
import { SITE_URL } from '@/lib/seo';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const semTipos = (db: DbDoAtendente) => db as unknown as SupabaseClient<any>;

export const MODELO_ECONOMICO = 'eleven_flash_v2_5';
export const AVISOS_DA_VOZ = [80, 95] as const;
export const LIMITE_ARQUIVOS = 1024 ** 3; // 1 GB (plano grátis)
export const LIMITE_BANCO = 500 * 1024 ** 2; // 500 MB (plano grátis)
export const AVISO_ARMAZENAMENTO = 80;

/* ------------------------------------------------------------ ElevenLabs */

export type CreditosDaVoz = { usados: number; limite: number; pct: number; renovaEm: string | null; plano: string };

/** Lê o uso do plano direto da API do ElevenLabs. null = sem chave ou a API não respondeu. */
export async function creditosDaVoz(): Promise<CreditosDaVoz | null> {
  const chave = process.env.ELEVENLABS_API_KEY;
  if (!chave) return null;
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': chave }, signal: AbortSignal.timeout(10_000), cache: 'no-store' });
    if (!r.ok) return null;
    const j = (await r.json()) as { character_count?: number; character_limit?: number; next_character_count_reset_unix?: number | null; tier?: string };
    const usados = Number(j.character_count ?? 0);
    const limite = Number(j.character_limit ?? 0);
    return {
      usados,
      limite,
      pct: limite > 0 ? (usados / limite) * 100 : 0,
      renovaEm: j.next_character_count_reset_unix ? new Date(j.next_character_count_reset_unix * 1000).toISOString() : null,
      plano: j.tier ?? '',
    };
  } catch {
    return null;
  }
}

type EstadoDaVoz = { ciclo?: string; avisos?: Record<string, string>; economico?: boolean; lidoEm?: string; ultimo?: CreditosDaVoz };

async function lerEstado(db: DbDoAtendente): Promise<EstadoDaVoz> {
  const { data } = await semTipos(db).from('ia_config').select('elevenlabs').eq('id', true).maybeSingle();
  return ((data as { elevenlabs?: EstadoDaVoz } | null)?.elevenlabs ?? {}) as EstadoDaVoz;
}

/**
 * Roda no relógio (a cada 15 min no máximo): lê os créditos, manda o aviso de 80% ou 95% uma vez por ciclo e liga
 * o modelo econômico para os clientes ao passar de 95%. `forcar` ignora o intervalo (teste manual).
 */
export async function cuidarDosCreditosDaVoz(db: DbDoAtendente, forcar = false): Promise<CreditosDaVoz | null> {
  const estado = await lerEstado(db);
  if (!forcar && estado.lidoEm && Date.now() - Date.parse(estado.lidoEm) < 15 * 60_000) return estado.ultimo ?? null;
  const c = await creditosDaVoz();
  if (!c) return null;
  const ciclo = c.renovaEm?.slice(0, 10) ?? 'sem-data';
  const novoCiclo = estado.ciclo !== ciclo;
  const avisos = novoCiclo ? {} : { ...(estado.avisos ?? {}) };
  const economico = c.pct >= 95;
  // Só o nível mais alto atingido: quem pula de 70% para 96% recebe um aviso, não dois.
  const nivel = [...AVISOS_DA_VOZ].reverse().find((n) => c.pct >= n);
  const avisar = nivel && !avisos[String(nivel)];
  if (avisar) for (const n of AVISOS_DA_VOZ) if (n <= nivel) avisos[String(n)] = avisos[String(n)] ?? new Date().toISOString();
  const novo: EstadoDaVoz = { ciclo, avisos, economico, lidoEm: new Date().toISOString(), ultimo: c };
  await semTipos(db).from('ia_config').update({ elevenlabs: novo }).eq('id', true);

  const renova = c.renovaEm ? new Date(c.renovaEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }) : '?';
  const uso = `${c.usados.toLocaleString('pt-BR')} de ${c.limite.toLocaleString('pt-BR')} créditos usados (renova em ${renova}).`;
  if (avisar) {
    await avisarArthur(db, await lerConfig(db), {
      titulo: `Voz da Lia: ${Math.floor(c.pct)}% dos créditos do ElevenLabs`,
      texto:
        nivel === 95
          ? `${uso} A voz para os clientes passou sozinha para o modelo mais barato (Flash v2.5, metade do gasto). A sua continua igual. Volta ao normal quando o ciclo renovar.`
          : `${uso} Ao chegar a 95%, a voz para os clientes muda sozinha para o modelo mais barato.`,
      link: `${SITE_URL}/admin/gastos`,
    });
  } else if (economico && !estado.economico && !novoCiclo) {
    await avisarArthur(db, await lerConfig(db), {
      titulo: 'Voz da Lia no modelo econômico',
      texto: `${uso} A voz para os clientes passou para o Flash v2.5 (metade do gasto).`,
      link: `${SITE_URL}/admin/gastos`,
    });
  }
  return c;
}

/* ------------------------------------------------------------ Supabase */

export type UsoDoArmazenamento = {
  buckets: { bucket: string; objetos: number; bytes: number }[];
  arquivos: number;
  banco: number;
  pctArquivos: number;
  pctBanco: number;
};

export async function usoDoArmazenamento(db: DbDoAtendente): Promise<UsoDoArmazenamento | null> {
  const { data, error } = await semTipos(db).rpc('uso_do_armazenamento');
  if (error || !data) return null;
  const d = data as { banco: number; buckets: { bucket: string; objetos: number; bytes: number }[] };
  const buckets = (d.buckets ?? []).map((b) => ({ bucket: b.bucket, objetos: Number(b.objetos), bytes: Number(b.bytes) }));
  const arquivos = buckets.reduce((s, b) => s + b.bytes, 0);
  const banco = Number(d.banco ?? 0);
  return { buckets, arquivos, banco, pctArquivos: (arquivos / LIMITE_ARQUIVOS) * 100, pctBanco: (banco / LIMITE_BANCO) * 100 };
}

const mb = (b: number) => `${(b / 1024 ** 2).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} MB`;

/** Aviso de 80% (arquivos ou banco), um por mês. Roda no relógio de hora em hora. */
export async function cuidarDoArmazenamento(db: DbDoAtendente): Promise<UsoDoArmazenamento | null> {
  const agora = new Date();
  if (agora.getUTCMinutes() !== 7) return null; // 1x por hora basta
  const u = await usoDoArmazenamento(db);
  if (!u) return null;
  const pct = Math.max(u.pctArquivos, u.pctBanco);
  if (pct < AVISO_ARMAZENAMENTO) return u;
  const mes = new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 7);
  const { data } = await semTipos(db).from('ia_config').select('armazenamento_avisos').eq('id', true).maybeSingle();
  const todos = ((data as { armazenamento_avisos?: Record<string, Record<string, string>> } | null)?.armazenamento_avisos ?? {}) as Record<string, Record<string, string>>;
  if (todos[mes]?.[String(AVISO_ARMAZENAMENTO)]) return u;
  await semTipos(db)
    .from('ia_config')
    .update({ armazenamento_avisos: { ...todos, [mes]: { ...(todos[mes] ?? {}), [String(AVISO_ARMAZENAMENTO)]: agora.toISOString() } } })
    .eq('id', true);
  await avisarArthur(db, await lerConfig(db), {
    titulo: `Supabase: ${Math.floor(pct)}% do armazenamento grátis`,
    texto: `Arquivos: ${mb(u.arquivos)} de 1 GB (${Math.floor(u.pctArquivos)}%). Banco: ${mb(u.banco)} de 500 MB (${Math.floor(u.pctBanco)}%). Áudios de reunião e prints de ajuste com mais de 60 dias vão sozinhos para o OneDrive (tarefa do PC).`,
    link: `${SITE_URL}/admin/gastos`,
  });
  return u;
}
