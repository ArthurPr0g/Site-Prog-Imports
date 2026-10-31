'use server';
// Sala de reunião da Prog Soluções (Fase 1, 31/10/2026; migration 0113). Lista, criação, entrada do Arthur,
// arquivos (áudio no Storage, vídeo no PC/OneDrive) e encerramento. O admin é conferido em cada ação; o banco
// é lido pela chave do servidor (o Storage privado e as salas da Daily não passam pelo navegador).
// A ação do cliente (entrar pela página pública) fica no fim e só aceita o token forte da reunião.

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { dbDoAtendente } from '@/lib/atendente/db';
import { type ActionResult, okResult, errResult } from '@/lib/action-result';
import { agendaDe } from '@/lib/google-agenda';
import { prepararSala, linkDoCliente, usoDoMes } from '@/lib/reunioes/sala';
import { tokenDaily } from '@/lib/reunioes/daily';
import { processarReuniao } from '@/lib/reunioes/encerrar';
import { limitesDe } from '@/lib/reunioes/comum';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{40,60}$/;

async function db() {
  return (await requireAdmin()) ? dbDoAtendente() : null;
}

export type ReuniaoDaLista = {
  id: string;
  titulo: string;
  inicio: string;
  status: string;
  salaStatus: string;
  meio: string | null;
  lead: string | null;
  leadId: string | null;
  minutos: number | null;
  custoUsd: number;
  temResumo: boolean;
  linkCliente: string | null;
};

export async function listarReunioesAction(): Promise<{ proximas: ReuniaoDaLista[]; passadas: ReuniaoDaLista[] } | null> {
  const d = await db();
  if (!d) return null;
  const { data } = await d
    .from('reunioes')
    .select('id, titulo, inicio, fim, status, sala_status, sala_meio, sala_token, lead_id, minutos_participante, custo_usd, resumo, leads(name)')
    .gte('inicio', new Date(Date.now() - 120 * 86400_000).toISOString())
    .order('inicio', { ascending: true })
    .limit(300);
  const agora = Date.now();
  const lista = (data ?? []).map((r) => ({
    id: r.id,
    titulo: r.titulo,
    inicio: r.inicio,
    status: r.status,
    salaStatus: r.sala_status,
    meio: r.sala_meio,
    lead: r.leads?.name ?? null,
    leadId: r.lead_id,
    minutos: r.minutos_participante === null ? null : Number(r.minutos_participante),
    custoUsd: Number(r.custo_usd ?? 0),
    temResumo: !!r.resumo,
    linkCliente: r.sala_token ? linkDoCliente(r.sala_token) : null,
    passou: r.sala_status === 'encerrada' || r.status !== 'marcada' || new Date(r.fim).getTime() + 3 * 3600_000 < agora,
  }));
  return {
    proximas: lista.filter((r) => !r.passou),
    passadas: lista.filter((r) => r.passou).reverse(),
  };
}

export async function buscarLeadsAction(busca: string): Promise<{ id: string; nome: string; status: string; cidade: string | null }[]> {
  const d = await db();
  if (!d) return [];
  const termo = busca.trim().replace(/[%_,()]/g, ' ').slice(0, 60);
  let q = d.from('leads').select('id, name, status, city').order('updated_at', { ascending: false }).limit(20);
  if (termo) q = q.ilike('name', `%${termo}%`);
  const { data } = await q;
  return (data ?? []).map((l) => ({ id: l.id, nome: l.name, status: l.status, cidade: l.city }));
}

/** Cria a reunião (agora ou no horário escolhido) e já prepara a sala. */
export async function novaReuniaoAction(leadId: string, quando: string | null, assunto?: string): Promise<ActionResult & { id?: string }> {
  const d = await db();
  if (!d) return errResult('Sem permissão.');
  if (!UUID.test(leadId)) return errResult('Escolha o lead.');
  const { data: lead } = await d.from('leads').select('id, name, email').eq('id', leadId).maybeSingle();
  if (!lead) return errResult('Lead não encontrado.');
  const inicio = quando ? new Date(quando) : new Date();
  if (!Number.isFinite(inicio.getTime())) return errResult('Horário inválido.');
  const { data: cfg } = await d.from('ia_config').select('agenda').eq('id', true).maybeSingle();
  const fim = new Date(inicio.getTime() + agendaDe(cfg?.agenda).duracao_min * 60_000);
  const { data: conv } = await d.from('ia_conversations').select('id').eq('lead_id', leadId).order('last_message_at', { ascending: false }).limit(1).maybeSingle();
  const { data: r, error } = await d
    .from('reunioes')
    .insert({
      lead_id: leadId,
      conversation_id: conv?.id ?? null,
      titulo: `Prog Soluções × ${lead.name}: ${(assunto ?? '').trim().slice(0, 80) || 'conversa sobre o projeto'}`,
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      email_cliente: lead.email,
      tipo: 'descoberta',
    })
    .select('id')
    .single();
  if (error || !r) return errResult('Não foi possível criar a reunião.');
  const p = await prepararSala(d, r.id);
  revalidatePath('/admin/reunioes');
  return {
    ...okResult(p?.meio === 'meet' ? `Reunião criada pelo Google Meet: ${p.motivo ?? 'sem sala da Daily'}.` : 'Reunião criada com sala própria.'),
    id: r.id,
  };
}

/** Botão da ficha do lead: reaproveita a reunião aberta do lead (hoje) ou cria uma agora. */
export async function abrirSalaDoLeadAction(leadId: string): Promise<ActionResult & { id?: string }> {
  const d = await db();
  if (!d) return errResult('Sem permissão.');
  if (!UUID.test(leadId)) return errResult('Lead inválido.');
  const { data: aberta } = await d
    .from('reunioes')
    .select('id')
    .eq('lead_id', leadId)
    .eq('status', 'marcada')
    .neq('sala_status', 'encerrada')
    .gte('inicio', new Date(Date.now() - 3 * 3600_000).toISOString())
    .lte('inicio', new Date(Date.now() + 12 * 3600_000).toISOString())
    .order('inicio', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (aberta) {
    await prepararSala(d, aberta.id);
    return { ...okResult('Abrindo a sala da reunião marcada.'), id: aberta.id };
  }
  return novaReuniaoAction(leadId, null);
}

export type EntradaNaSala =
  | { ok: true; meio: 'daily'; url: string; token: string; linkCliente: string }
  | { ok: true; meio: 'meet'; meet: string | null; linkCliente: string; motivo?: string }
  | { ok: false; message: string };

/** Entrada do Arthur: token de dono na Daily (ou o Meet, no plano B) e a reunião passa a "ao vivo". */
export async function entrarNaSalaAction(id: string): Promise<EntradaNaSala> {
  const d = await db();
  if (!d) return { ok: false, message: 'Sem permissão.' };
  if (!UUID.test(id)) return { ok: false, message: 'Reunião inválida.' };
  const p = await prepararSala(d, id);
  if (!p) return { ok: false, message: 'Reunião não encontrada.' };
  const { data: r } = await d.from('reunioes').select('sala_token, sala_nome, sala_url, sala_expira_em, meet_link, inicio_em, sala_status').eq('id', id).maybeSingle();
  if (!r?.sala_token) return { ok: false, message: 'Reunião sem link.' };
  if (r.sala_status === 'encerrada') return { ok: false, message: 'Esta reunião já foi encerrada.' };
  await d.from('reunioes').update({ sala_status: 'ao_vivo', ...(r.inicio_em ? {} : { inicio_em: new Date().toISOString() }) }).eq('id', id);
  const linkCliente = linkDoCliente(r.sala_token);
  if (p.meio === 'meet' || !r.sala_nome || !r.sala_url || !r.sala_expira_em) return { ok: true, meio: 'meet', meet: r.meet_link, linkCliente, motivo: p.motivo };
  const { data: cfg } = await d.from('ia_config').select('custos').eq('id', true).maybeSingle();
  const t = await tokenDaily(r.sala_nome, 'Arthur · Prog Soluções', true, new Date(r.sala_expira_em), limitesDe(cfg?.custos).reunioes_duracao_max_min);
  if (!t.ok) return { ok: false, message: `A Daily não liberou a entrada (${t.erro}).` };
  return { ok: true, meio: 'daily', url: r.sala_url, token: t.token, linkCliente };
}

/** Link assinado para o navegador do Arthur enviar o áudio da reunião direto ao Storage (sem passar pela Vercel). */
export async function linkDoAudioAction(id: string): Promise<{ ok: true; path: string; token: string } | { ok: false; message: string }> {
  const d = await db();
  if (!d || !UUID.test(id)) return { ok: false, message: 'Sem permissão.' };
  const path = `${id}/audio-${Date.now()}.webm`;
  const { data, error } = await d.storage.from('reunioes').createSignedUploadUrl(path);
  if (error || !data) return { ok: false, message: 'O Storage não liberou o envio do áudio.' };
  return { ok: true, path: data.path, token: data.token };
}

/** Grava onde ficaram os arquivos: áudio (Storage) e o nome do vídeo salvo no PC/OneDrive. */
export async function registrarArquivosAction(id: string, a: { audioPath?: string; videoArquivo?: string }): Promise<ActionResult> {
  const d = await db();
  if (!d || !UUID.test(id)) return errResult('Sem permissão.');
  const campos: { audio_path?: string; video_arquivo?: string } = {};
  if (a.audioPath && a.audioPath.startsWith(`${id}/`)) campos.audio_path = a.audioPath.slice(0, 300);
  if (a.videoArquivo) campos.video_arquivo = a.videoArquivo.slice(0, 300);
  if (!Object.keys(campos).length) return okResult('');
  const { error } = await d.from('reunioes').update(campos).eq('id', id);
  return error ? errResult('Não foi possível registrar os arquivos.') : okResult('Arquivos registrados.');
}

/** Encerrar: marca o fim e processa depois da resposta (transcrição, negociação, aviso, custo). */
export async function encerrarReuniaoAction(id: string): Promise<ActionResult> {
  const d = await db();
  if (!d || !UUID.test(id)) return errResult('Sem permissão.');
  const { data: r } = await d.from('reunioes').select('sala_status, inicio_em').eq('id', id).maybeSingle();
  if (!r) return errResult('Reunião não encontrada.');
  if (r.sala_status !== 'encerrada') {
    await d
      .from('reunioes')
      .update({ sala_status: 'encerrada', fim_em: new Date().toISOString(), processamento: 'processando', ...(r.inicio_em ? {} : { inicio_em: new Date().toISOString() }) })
      .eq('id', id);
  }
  after(() => processarReuniao(dbDoAtendente(), id).catch((e) => console.error('[reunioes] processar falhou', e)));
  revalidatePath('/admin/reunioes');
  return okResult('Reunião encerrada. O resumo chega no seu WhatsApp em instantes.');
}

export async function reprocessarReuniaoAction(id: string): Promise<ActionResult> {
  const d = await db();
  if (!d || !UUID.test(id)) return errResult('Sem permissão.');
  await d.from('reunioes').update({ processamento: 'processando' }).eq('id', id);
  after(() => processarReuniao(dbDoAtendente(), id).catch((e) => console.error('[reunioes] processar falhou', e)));
  return okResult('Processando de novo. O resumo chega no seu WhatsApp.');
}

/** Estado atual (a tela consulta depois de encerrar para mostrar o resumo). */
export async function estadoDaReuniaoAction(id: string) {
  const d = await db();
  if (!d || !UUID.test(id)) return null;
  const { data } = await d.from('reunioes').select('sala_status, processamento, resumo, minutos_participante, custo_usd, consentimento_em').eq('id', id).maybeSingle();
  return data;
}

/** Link de 1 h para ouvir o áudio guardado. */
export async function ouvirAudioAction(id: string): Promise<string | null> {
  const d = await db();
  if (!d || !UUID.test(id)) return null;
  const { data: r } = await d.from('reunioes').select('audio_path').eq('id', id).maybeSingle();
  if (!r?.audio_path) return null;
  const { data } = await d.storage.from('reunioes').createSignedUrl(r.audio_path, 3600);
  return data?.signedUrl ?? null;
}

export async function usoDasReunioesAction() {
  const d = await db();
  if (!d) return null;
  return usoDoMes(d);
}

/* ------------------------------------------------------------ página do cliente (pública, por token) */

export type EntradaDoCliente =
  | { ok: true; meio: 'daily'; url: string; token: string }
  | { ok: true; meio: 'meet'; meet: string | null }
  /** Sala de espera (Fase 2): o consentimento já ficou gravado; a página entra sozinha quando o Arthur abrir a sala. */
  | { ok: true; meio: 'espera' }
  | { ok: false; message: string };

/**
 * "Concordo e entrar": grava o consentimento NA HORA do clique (o primeiro vale, mesmo antes de o Arthur entrar)
 * e devolve a entrada. Arthur ainda fora (sala não está ao vivo): sala de espera, sem gastar minuto da Daily.
 * Só com o token forte.
 */
export async function entrarComoClienteAction(token: string, nome: string): Promise<EntradaDoCliente> {
  if (!TOKEN.test(token)) return { ok: false, message: 'Link inválido.' };
  const d = dbDoAtendente();
  const { data: r } = await d
    .from('reunioes')
    .select('id, status, sala_status, sala_meio, sala_nome, sala_url, sala_expira_em, meet_link, consentimento_em, inicio')
    .eq('sala_token', token)
    .maybeSingle();
  if (!r || r.status === 'cancelada') return { ok: false, message: 'Esta reunião não existe mais. Fale com a Prog Soluções pelo WhatsApp.' };
  if (r.sala_status === 'encerrada') return { ok: false, message: 'Esta reunião já foi encerrada.' };
  if (!r.consentimento_em) await d.from('reunioes').update({ consentimento_em: new Date().toISOString() }).eq('id', r.id).is('consentimento_em', null);
  // Abre 30 min antes do horário: o link não vira uma sala aberta para qualquer hora.
  if (new Date(r.inicio).getTime() - Date.now() > 30 * 60_000) return { ok: false, message: 'A sala abre 30 minutos antes do horário marcado. Sua concordância com a gravação já ficou registrada.' };
  if (r.sala_meio === 'daily' && r.sala_status !== 'ao_vivo') return { ok: true, meio: 'espera' };
  if (r.sala_meio === 'daily' && r.sala_nome && r.sala_url && r.sala_expira_em) {
    if (new Date(r.sala_expira_em).getTime() < Date.now()) return { ok: false, message: 'O horário desta sala já passou. Fale com a Prog Soluções pelo WhatsApp.' };
    const { data: cfg } = await d.from('ia_config').select('custos').eq('id', true).maybeSingle();
    const quem = nome.trim().replace(/[<>]/g, '').slice(0, 40) || 'Cliente';
    const t = await tokenDaily(r.sala_nome, quem, false, new Date(r.sala_expira_em), limitesDe(cfg?.custos).reunioes_duracao_max_min);
    if (!t.ok) return { ok: false, message: 'Não consegui abrir a sala agora. Tente de novo em instantes.' };
    return { ok: true, meio: 'daily', url: r.sala_url, token: t.token };
  }
  return { ok: true, meio: 'meet', meet: r.meet_link };
}
