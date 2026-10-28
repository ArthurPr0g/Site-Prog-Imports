// WhatsApp Cloud API (oficial da Meta). Só no servidor.
//
// Regras que moldam o atendente (política do WhatsApp, conferidas em 28/10/2026):
// - A empresa só manda a 1ª mensagem para quem deu o número e aceitou contato.
//   Aqui a conversa sempre começa pelo lead (botão do e-mail ou do diagnóstico).
// - Mensagem livre só dentro de 24 h da última mensagem do lead. Fora disso, só
//   modelo aprovado (pago): o atendente não manda e chama o Arthur.
// - Desde 01/10/2026: 1.000 mensagens de atendimento grátis por mês por número;
//   da 1.001ª em diante a Meta cobra (sem cartão cadastrado, não entrega).

import { createHmac, timingSafeEqual } from 'node:crypto';

const VERSAO = process.env.WHATSAPP_GRAPH_VERSION || 'v23.0';
// Trocável só para teste local (servidor falso que registra os envios).
const BASE = process.env.WHATSAPP_API_BASE || 'https://graph.facebook.com';
export const JANELA_MS = 24 * 60 * 60 * 1000;

export const whatsappConfigurado = () =>
  !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_APP_SECRET);

/** Confere a assinatura X-Hub-Signature-256 (HMAC do corpo cru com o App Secret). */
export function assinaturaValida(corpo: string, cabecalho: string | null): boolean {
  const segredo = process.env.WHATSAPP_APP_SECRET;
  if (!segredo || !cabecalho?.startsWith('sha256=')) return false;
  const esperado = createHmac('sha256', segredo).update(corpo, 'utf8').digest('hex');
  const recebido = cabecalho.slice('sha256='.length);
  if (recebido.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(recebido, 'hex'), Buffer.from(esperado, 'hex'));
}

export type ResultadoDoEnvio = { ok: true; id: string } | { ok: false; erro: string };

async function chamar(corpo: Record<string, unknown>): Promise<Response> {
  return fetch(`${BASE}/${VERSAO}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...corpo }),
  });
}

export async function enviarTexto(para: string, texto: string): Promise<ResultadoDoEnvio> {
  if (!whatsappConfigurado()) return { ok: false, erro: 'WhatsApp não configurado' };
  try {
    const r = await chamar({ recipient_type: 'individual', to: para, type: 'text', text: { body: texto, preview_url: true } });
    const j = (await r.json()) as { messages?: { id: string }[]; error?: { message?: string } };
    if (!r.ok || !j.messages?.[0]?.id) return { ok: false, erro: j.error?.message ?? `HTTP ${r.status}` };
    return { ok: true, id: j.messages[0].id };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'falha de rede' };
  }
}

/** Marca como lida (os dois tiques azuis) e mostra "digitando…" enquanto a IA pensa. */
export async function marcarLidaEDigitando(mensagemId: string): Promise<void> {
  if (!whatsappConfigurado()) return;
  try {
    await chamar({ status: 'read', message_id: mensagemId, typing_indicator: { type: 'text' } });
  } catch {
    /* só cosmético */
  }
}

/* ------------------------------------------------------------ webhook */

export type TipoDeMidia = 'image' | 'document' | 'audio' | 'video' | 'sticker';
export type MidiaRecebida = { tipo: TipoDeMidia; id: string; mime: string; nome: string | null };

export type MensagemRecebida = {
  id: string;
  de: string;
  nome: string | null;
  texto: string;
  quando: string;
  midia: MidiaRecebida | null;
  /** Reação (emoji numa mensagem): grava, mas não pede resposta. */
  reacao: boolean;
};

/**
 * Baixa uma mídia recebida (a Meta guarda por 30 dias). Dois passos: o id dá
 * uma URL temporária, que só abre com o token. null se não deu.
 */
export async function baixarMidia(id: string): Promise<{ dados: Buffer; mime: string } | null> {
  if (!whatsappConfigurado()) return null;
  const auth = { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` };
  try {
    const info = await fetch(`${BASE}/${VERSAO}/${id}`, { headers: auth, signal: AbortSignal.timeout(15000) });
    const j = (await info.json()) as { url?: string; mime_type?: string };
    if (!info.ok || !j.url) return null;
    const arq = await fetch(j.url, { headers: auth, signal: AbortSignal.timeout(30000) });
    if (!arq.ok) return null;
    return { dados: Buffer.from(await arq.arrayBuffer()), mime: (j.mime_type ?? '').split(';')[0].trim() };
  } catch {
    return null;
  }
}
export type StatusRecebido = { id: string; status: string; erro: string | null };

type CorpoDoWebhook = {
  entry?: {
    changes?: {
      value?: {
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: {
          id: string;
          from: string;
          timestamp: string;
          type: string;
          text?: { body?: string };
          button?: { text?: string };
          interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
          image?: Midia;
          document?: Midia & { filename?: string };
          audio?: Midia & { voice?: boolean };
          video?: Midia;
          sticker?: Midia;
          location?: { latitude?: number; longitude?: number; name?: string; address?: string };
          contacts?: { name?: { formatted_name?: string }; phones?: { phone?: string }[] }[];
          reaction?: { emoji?: string };
        }[];
        statuses?: { id: string; status: string; errors?: { title?: string; message?: string }[] }[];
      };
    }[];
  }[];
};

type Midia = { id?: string; mime_type?: string; caption?: string };

const SEM_TEXTO: Record<string, string> = {
  audio: '[o cliente mandou um áudio]',
  image: '[o cliente mandou uma imagem]',
  video: '[o cliente mandou um vídeo]',
  document: '[o cliente mandou um arquivo]',
  sticker: '[o cliente mandou uma figurinha]',
  location: '[o cliente mandou uma localização]',
  contacts: '[o cliente mandou um contato]',
  reaction: '[o cliente reagiu a uma mensagem]',
};

type MensagemDoWebhook = NonNullable<NonNullable<NonNullable<NonNullable<CorpoDoWebhook['entry']>[number]['changes']>[number]['value']>['messages']>[number];

/** Texto que a IA lê e a mídia (se houver) de uma mensagem do webhook. */
function conteudo(m: MensagemDoWebhook): { texto: string; midia: MidiaRecebida | null } {
  const tipos: TipoDeMidia[] = ['image', 'document', 'audio', 'video', 'sticker'];
  for (const tipo of tipos) {
    const md = m[tipo] as (Midia & { filename?: string }) | undefined;
    if (m.type === tipo && md?.id) {
      const legenda = md.caption?.trim();
      const nome = md.filename ?? null;
      const base = tipo === 'document' && nome ? `[o cliente mandou o arquivo "${nome}"]` : SEM_TEXTO[tipo];
      return {
        texto: legenda ? `${base} ${legenda}` : base,
        midia: { tipo, id: md.id, mime: (md.mime_type ?? '').split(';')[0].trim(), nome },
      };
    }
  }
  if (m.type === 'location' && m.location) {
    const l = m.location;
    const onde = [l.name, l.address].filter(Boolean).join(', ');
    return { texto: `[o cliente mandou uma localização: ${onde || 'sem nome'} (${l.latitude}, ${l.longitude})]`, midia: null };
  }
  if (m.type === 'contacts' && m.contacts?.length) {
    const lista = m.contacts
      .map((c) => `${c.name?.formatted_name ?? 'sem nome'} ${c.phones?.map((p) => p.phone).filter(Boolean).join(' / ') ?? ''}`.trim())
      .join('; ');
    return { texto: `[o cliente mandou um contato: ${lista}]`, midia: null };
  }
  if (m.type === 'reaction') {
    return { texto: `[o cliente reagiu com ${m.reaction?.emoji || 'um emoji'}]`, midia: null };
  }
  const texto =
    m.text?.body ??
    m.button?.text ??
    m.interactive?.button_reply?.title ??
    m.interactive?.list_reply?.title ??
    SEM_TEXTO[m.type] ??
    `[mensagem do tipo ${m.type}]`;
  return { texto, midia: null };
}

export function lerWebhook(corpo: unknown): { mensagens: MensagemRecebida[]; status: StatusRecebido[] } {
  const mensagens: MensagemRecebida[] = [];
  const status: StatusRecebido[] = [];
  for (const entry of (corpo as CorpoDoWebhook)?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value;
      if (!v) continue;
      const nomes = new Map((v.contacts ?? []).map((c) => [c.wa_id ?? '', c.profile?.name ?? null]));
      for (const m of v.messages ?? []) {
        const { texto, midia } = conteudo(m);
        mensagens.push({
          id: m.id,
          de: m.from,
          nome: nomes.get(m.from) ?? null,
          texto,
          quando: new Date(Number(m.timestamp) * 1000).toISOString(),
          midia,
          reacao: m.type === 'reaction',
        });
      }
      for (const s of v.statuses ?? []) {
        const e = s.errors?.[0];
        status.push({ id: s.id, status: s.status, erro: e ? (e.message ?? e.title ?? 'erro') : null });
      }
    }
  }
  return { mensagens, status };
}
