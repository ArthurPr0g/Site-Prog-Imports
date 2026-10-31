// Sala de reunião da Prog Soluções (Fase 1, 31/10/2026; migration 0113). Só no servidor.
//
// Cada reunião ganha um token forte (link do cliente /reuniao/<token>) e, se os minutos grátis da Daily do mês
// deixarem, uma sala privada na Daily. Passou da trava (95% por padrão) ou a Daily falhou: a reunião vai pelo
// Google Meet (plano B), e a tela do Arthur funciona igual (transcrição pelo microfone e pelo áudio da aba).

import { randomBytes } from 'node:crypto';
import type { DbDoAtendente } from '@/lib/atendente/db';
import { URL_PUBLICA, SITE_URL } from '@/lib/seo';
import { avisarArthur } from '@/lib/atendente/avisos';
import { lerConfig } from '@/lib/atendente/agente';
import { nomeDaPasta } from '@/lib/atendente/prestacao-do-sinal';
import { criarSalaDaily, dailyConfigurada, minutosDaDaily } from './daily';
import { limitesDe, type LimitesDasReunioes } from './comum';

export const linkDoCliente = (token: string) => `${URL_PUBLICA}/reuniao/${token}`;
export const linkDaSalaDoArthur = (id: string) => `${SITE_URL}/admin/reunioes/${id}`;

/** 32 bytes aleatórios: impossível de adivinhar, curto o bastante para o WhatsApp. */
export const novoTokenDaSala = () => randomBytes(32).toString('base64url');

/** Início do mês corrente no horário de Brasília. */
export function inicioDoMes(agora = new Date()): Date {
  const br = new Date(agora.getTime() - 3 * 3600_000);
  return new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), 1, 3));
}
const chaveDoMes = (agora = new Date()) => new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 7);

export type UsoDoMes = { minutos: number; pct: number; limites: LimitesDasReunioes; medido: boolean };

/** Minutos de participante da Daily no mês (pela API dela; sem resposta, soma o que o sistema mediu). */
export async function usoDoMes(db: DbDoAtendente): Promise<UsoDoMes> {
  const { data: cfg } = await db.from('ia_config').select('custos').eq('id', true).maybeSingle();
  const limites = limitesDe(cfg?.custos);
  const desde = inicioDoMes();
  let minutos: number;
  let medido = true;
  const api = dailyConfigurada() ? await minutosDaDaily(desde, new Date(Date.now() + 60_000)) : null;
  if (api) minutos = api.total;
  else {
    medido = false;
    const { data } = await db.from('reunioes').select('minutos_participante').eq('sala_meio', 'daily').gte('inicio', desde.toISOString());
    minutos = (data ?? []).reduce((s, r) => s + Number(r.minutos_participante ?? 0), 0);
  }
  const pct = limites.reunioes_minutos_gratis > 0 ? (minutos / limites.reunioes_minutos_gratis) * 100 : 100;
  return { minutos, pct, limites, medido };
}

/** Avisa o Arthur no WhatsApp ao passar de 70% e de 90% dos minutos grátis (um aviso de cada por mês). */
export async function conferirAvisosDeMinutos(db: DbDoAtendente, uso?: UsoDoMes): Promise<void> {
  const u = uso ?? (await usoDoMes(db));
  const { data: cfg } = await db.from('ia_config').select('reunioes_avisos').eq('id', true).maybeSingle();
  const todos = (cfg?.reunioes_avisos ?? {}) as Record<string, Record<string, string>>;
  const mes = chaveDoMes();
  const enviados = { ...(todos[mes] ?? {}) };
  const niveis = [u.limites.reunioes_aviso2_pct, u.limites.reunioes_aviso1_pct].sort((a, b) => b - a);
  // Só o nível mais alto atingido: quem pula de 60% para 92% recebe um aviso, não dois.
  const nivel = niveis.find((n) => u.pct >= n);
  if (!nivel || enviados[String(nivel)]) return;
  for (const n of niveis) if (n <= nivel) enviados[String(n)] = enviados[String(n)] ?? new Date().toISOString();
  await db.from('ia_config').update({ reunioes_avisos: { ...todos, [mes]: enviados } }).eq('id', true);
  const total = u.limites.reunioes_minutos_gratis;
  await avisarArthur(db, await lerConfig(db), {
    titulo: `Reuniões: ${Math.floor(u.pct)}% dos minutos grátis da Daily`,
    texto:
      `${Math.round(u.minutos).toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')} minutos usados este mês.` +
      ` Ao chegar a ${u.limites.reunioes_trava_pct}%, as reuniões novas vão pelo Google Meet até o mês virar.`,
    link: `${SITE_URL}/admin/gastos`,
  });
}

/**
 * Garante o link do cliente e decide o meio da reunião (sala da Daily ou Meet). Idempotente: sala já criada
 * e ainda válida não é recriada. Devolve o que mudou ou o motivo de ter ido para o Meet.
 */
export async function prepararSala(db: DbDoAtendente, id: string): Promise<{ meio: 'daily' | 'meet'; motivo?: string } | null> {
  const { data: r } = await db.from('reunioes').select('id, inicio, sala_token, sala_meio, sala_nome, sala_expira_em, sala_status, meet_link').eq('id', id).maybeSingle();
  if (!r) return null;
  const token = r.sala_token ?? novoTokenDaSala();
  if (r.sala_meio === 'daily' && r.sala_nome && r.sala_expira_em && new Date(r.sala_expira_em).getTime() > Date.now() + 10 * 60_000) {
    if (!r.sala_token) await db.from('reunioes').update({ sala_token: token }).eq('id', id);
    return { meio: 'daily' };
  }
  const uso = await usoDoMes(db);
  let motivo: string | undefined;
  if (!dailyConfigurada()) motivo = 'Daily não configurada';
  else if (uso.pct >= uso.limites.reunioes_trava_pct) motivo = `minutos grátis da Daily em ${Math.floor(uso.pct)}% (trava em ${uso.limites.reunioes_trava_pct}%)`;
  if (!motivo) {
    // A sala vale até o horário marcado (ou agora, se já passou) + a duração máxima.
    const base = Math.max(new Date(r.inicio).getTime(), Date.now());
    const expira = new Date(base + uso.limites.reunioes_duracao_max_min * 60_000);
    const nome = `prog-${id.slice(0, 8)}-${randomBytes(3).toString('hex')}`;
    const s = await criarSalaDaily(nome, expira, uso.limites.reunioes_duracao_max_min, uso.limites.reunioes_max_pessoas);
    if (s.ok) {
      await db
        .from('reunioes')
        .update({ sala_token: token, sala_meio: 'daily', sala_nome: s.dados.name, sala_url: s.dados.url, sala_expira_em: expira.toISOString() })
        .eq('id', id);
      await conferirAvisosDeMinutos(db, uso).catch(() => undefined);
      return { meio: 'daily' };
    }
    motivo = `a Daily recusou a sala (${s.erro})`;
    console.error('[reunioes] sala da Daily falhou', s.erro);
  }
  await db.from('reunioes').update({ sala_token: token, sala_meio: 'meet', sala_url: r.meet_link, sala_nome: null }).eq('id', id);
  await conferirAvisosDeMinutos(db, uso).catch(() => undefined);
  return { meio: 'meet', motivo };
}

/** Subpasta do cliente dentro de "1 - Clientes": a do Pós-venda (projetos.pasta) ou "Pessoa - Empresa". */
export async function pastaDoCliente(db: DbDoAtendente, leadId: string | null): Promise<string | null> {
  if (!leadId) return null;
  const [{ data: proj }, { data: lead }] = await Promise.all([
    db.from('projetos').select('pasta').eq('lead_id', leadId).not('pasta', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('leads').select('name, responsible_name').eq('id', leadId).maybeSingle(),
  ]);
  if (proj?.pasta) {
    // Caminho inteiro do Windows: o que vem logo depois de "1 - Clientes" (ou o último pedaço).
    const partes = proj.pasta.split(/[\\/]+/).filter(Boolean);
    const i = partes.findIndex((p) => /^1\s*-\s*clientes$/i.test(p));
    const nome = i >= 0 && partes[i + 1] ? partes[i + 1] : partes[partes.length - 1];
    if (nome) return nome;
  }
  return lead ? nomeDaPasta({ empresa: lead.name, responsavel: lead.responsible_name }) : null;
}
