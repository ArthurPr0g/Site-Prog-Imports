// Google Agenda do Arthur (pedido do dono em 28/10/2026): a Lia vê os horários
// ocupados e marca a reunião com o cliente, com link do Meet e convite por e-mail.
// Só no servidor. O Arthur conecta uma vez pelo painel (OAuth); o refresh token
// fica na tabela `integracoes` (sem acesso pelo navegador).
//
// Variáveis na Vercel: GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET (cliente OAuth do
// tipo "Aplicativo da Web", redirecionamento <site>/api/google/retorno).

import type { DbDoAtendente } from '@/lib/atendente/db';
import { SITE_URL } from '@/lib/seo';

// Só eventos: ler a agenda para achar os horários livres e criar a reunião.
const ESCOPO = 'https://www.googleapis.com/auth/calendar.events';
const CHAVE = 'google_agenda';
export const REDIRECT = `${SITE_URL}/api/google/retorno`;

export const googleConfigurado = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export function urlDeAutorizacao(estado: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: ESCOPO,
    access_type: 'offline',
    // Sempre pede o consentimento: é o que garante vir o refresh token.
    prompt: 'consent',
    state: estado,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

async function token(corpo: Record<string, string>): Promise<{ access_token?: string; refresh_token?: string; error?: string }> {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      ...corpo,
    }),
    signal: AbortSignal.timeout(15000),
  });
  return r.json();
}

/** Troca o código do retorno pelo refresh token e guarda. */
export async function conectar(db: DbDoAtendente, codigo: string): Promise<string | null> {
  const t = await token({ grant_type: 'authorization_code', code: codigo, redirect_uri: REDIRECT });
  if (!t.refresh_token) return t.error ?? 'O Google não devolveu a autorização. Tente conectar de novo.';
  await db
    .from('integracoes')
    .upsert({ chave: CHAVE, dados: { refresh_token: t.refresh_token, conectado_em: new Date().toISOString() }, updated_at: new Date().toISOString() });
  return null;
}

export async function agendaConectada(db: DbDoAtendente): Promise<boolean> {
  if (!googleConfigurado()) return false;
  const { data } = await db.from('integracoes').select('dados').eq('chave', CHAVE).maybeSingle();
  return !!(data?.dados as { refresh_token?: string } | null)?.refresh_token;
}

async function acesso(db: DbDoAtendente): Promise<string | null> {
  if (!googleConfigurado()) return null;
  const { data } = await db.from('integracoes').select('dados').eq('chave', CHAVE).maybeSingle();
  const refresh = (data?.dados as { refresh_token?: string } | null)?.refresh_token;
  if (!refresh) return null;
  try {
    const t = await token({ grant_type: 'refresh_token', refresh_token: refresh });
    return t.access_token ?? null;
  } catch {
    return null;
  }
}

export type Intervalo = { inicio: number; fim: number };

/** Eventos que ocupam o Arthur entre duas datas (os marcados como "disponível" não contam). null = agenda indisponível. */
export async function ocupadosNaAgenda(db: DbDoAtendente, de: Date, ate: Date): Promise<Intervalo[] | null> {
  const t = await acesso(db);
  if (!t) return null;
  const p = new URLSearchParams({
    timeMin: de.toISOString(),
    timeMax: ate.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });
  try {
    const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${p}`, {
      headers: { Authorization: `Bearer ${t}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      items?: { status?: string; transparency?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } }[];
    };
    return (j.items ?? [])
      .filter((e) => e.status !== 'cancelled' && e.transparency !== 'transparent')
      .map((e) => ({
        // Dia inteiro: o dia todo em Goiânia (UTC−3).
        inicio: new Date(e.start?.dateTime ?? `${e.start?.date}T00:00:00-03:00`).getTime(),
        fim: new Date(e.end?.dateTime ?? `${e.end?.date}T00:00:00-03:00`).getTime(),
      }))
      .filter((i) => Number.isFinite(i.inicio) && Number.isFinite(i.fim));
  } catch {
    return null;
  }
}

/** Cria a reunião na agenda do Arthur com Meet e convite ao cliente (se houver e-mail). */
export async function criarEventoNaAgenda(
  db: DbDoAtendente,
  e: { titulo: string; descricao: string; inicio: Date; fim: Date; emailCliente: string | null }
): Promise<{ ok: true; id: string; meet: string | null; link: string | null } | { ok: false; erro: string }> {
  const t = await acesso(db);
  if (!t) return { ok: false, erro: 'Google Agenda não conectado' };
  const p = new URLSearchParams({ conferenceDataVersion: '1', sendUpdates: e.emailCliente ? 'all' : 'none' });
  try {
    const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${p}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: e.titulo,
        description: e.descricao,
        start: { dateTime: e.inicio.toISOString(), timeZone: 'America/Sao_Paulo' },
        end: { dateTime: e.fim.toISOString(), timeZone: 'America/Sao_Paulo' },
        attendees: e.emailCliente ? [{ email: e.emailCliente }] : [],
        reminders: { useDefault: true },
        conferenceData: { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
      }),
      signal: AbortSignal.timeout(15000),
    });
    const j = (await r.json()) as { id?: string; hangoutLink?: string; htmlLink?: string; error?: { message?: string } };
    if (!r.ok || !j.id) return { ok: false, erro: j.error?.message ?? `HTTP ${r.status}` };
    return { ok: true, id: j.id, meet: j.hangoutLink ?? null, link: j.htmlLink ?? null };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : 'falha de rede' };
  }
}

/* ------------------------------------------------------------ horários livres */

// Goiânia não tem horário de verão desde 2019: UTC−3 o ano todo.
const FUSO_MS = 3 * 3600_000;
/** Duração padrão; a configurada fica em ia_config.agenda.duracao_min. */
export const DURACAO_DA_REUNIAO_MIN = 30;

/** Horário local de Goiânia em texto ("qui 30/10 às 10h30"). */
export function horarioPorExtenso(d: Date): string {
  const l = new Date(d.getTime() - FUSO_MS);
  const dia = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][l.getUTCDay()];
  const dd = String(l.getUTCDate()).padStart(2, '0');
  const mm = String(l.getUTCMonth() + 1).padStart(2, '0');
  const h = l.getUTCHours();
  const min = l.getUTCMinutes();
  return `${dia} ${dd}/${mm} às ${h}h${min ? String(min).padStart(2, '0') : ''}`;
}

/** Disponibilidade do Arthur (ia_config.agenda, migration 0092). Horários de Brasília. */
export type AgendaConfig = {
  /** 0 = domingo … 6 = sábado → faixas ["HH:MM", "HH:MM"] em que a Lia pode oferecer reunião. */
  dias: Record<string, [string, string][]>;
  duracao_min: number;
  antecedencia_h: number;
  max_por_dia: number;
  horizonte_dias: number;
  /** Datas sem reunião (AAAA-MM-DD), ex.: feriados e viagens. */
  bloqueios: string[];
};

export const AGENDA_PADRAO: AgendaConfig = {
  dias: Object.fromEntries(['1', '2', '3', '4', '5'].map((d) => [d, [['09:00', '12:00'], ['14:00', '18:00']] as [string, string][]])),
  duracao_min: 30,
  antecedencia_h: 2,
  max_por_dia: 2,
  horizonte_dias: 14,
  bloqueios: [],
};

/** Lê a configuração salva no banco, completando o que faltar com o padrão. */
export function agendaDe(bruto: unknown): AgendaConfig {
  const a = (bruto && typeof bruto === 'object' ? bruto : {}) as Partial<AgendaConfig>;
  const num = (v: unknown, padrao: number, min: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : padrao;
  };
  return {
    dias: a.dias && typeof a.dias === 'object' ? a.dias : AGENDA_PADRAO.dias,
    duracao_min: num(a.duracao_min, 30, 15, 180),
    antecedencia_h: num(a.antecedencia_h, 2, 0, 72),
    max_por_dia: num(a.max_por_dia, 2, 1, 12),
    horizonte_dias: num(a.horizonte_dias, 14, 1, 60),
    bloqueios: Array.isArray(a.bloqueios) ? a.bloqueios.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d))) : [],
  };
}

const minutos = (hhmm: string) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * Próximos horários livres dentro das faixas que o Arthur configurou (Atendimento › Agenda e reuniões),
 * sem bater com a agenda do Google nem com reuniões já marcadas. Até `quantos`, respeitando o máximo
 * por dia e espalhando os do mesmo dia (pelo menos 2 h entre eles), para o cliente ter opções diferentes.
 */
export function horariosLivres(ocupados: Intervalo[], agora = Date.now(), quantos = 6, agenda: AgendaConfig = AGENDA_PADRAO): Date[] {
  const livres: Date[] = [];
  const dur = agenda.duracao_min * 60_000;
  const hojeLocal = new Date(agora - FUSO_MS);
  for (let d = 0; d < agenda.horizonte_dias && livres.length < quantos; d++) {
    const dia = new Date(Date.UTC(hojeLocal.getUTCFullYear(), hojeLocal.getUTCMonth(), hojeLocal.getUTCDate() + d));
    if (agenda.bloqueios.includes(dia.toISOString().slice(0, 10))) continue;
    const faixas = agenda.dias[String(dia.getUTCDay())] ?? [];
    let doDia = 0;
    let ultimo = -Infinity;
    for (const [de, ate] of faixas) {
      for (let min = minutos(de); min + agenda.duracao_min <= minutos(ate); min += 30) {
        if (doDia >= agenda.max_por_dia || livres.length >= quantos) break;
        const inicio = dia.getTime() + min * 60_000 + FUSO_MS;
        const fim = inicio + dur;
        if (inicio < agora + agenda.antecedencia_h * 3600_000) continue;
        if (inicio - ultimo < 2 * 3600_000) continue;
        if (ocupados.some((o) => o.inicio < fim && o.fim > inicio)) continue;
        livres.push(new Date(inicio));
        ultimo = inicio;
        doDia++;
      }
    }
  }
  return livres;
}
