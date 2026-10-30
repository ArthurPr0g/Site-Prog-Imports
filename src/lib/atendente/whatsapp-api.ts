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

async function respostaDoEnvio(r: Response): Promise<ResultadoDoEnvio> {
  const j = (await r.json()) as { messages?: { id: string }[]; error?: { message?: string } };
  if (!r.ok || !j.messages?.[0]?.id) return { ok: false, erro: j.error?.message ?? `HTTP ${r.status}` };
  return { ok: true, id: j.messages[0].id };
}

/**
 * Mensagem com opções para tocar (modo rápido, 28/10/2026): até 3 opções viram
 * botões (título até 20 caracteres); de 4 a 10, uma lista (até 24). Só dentro da
 * janela de 24 h. O toque volta pelo webhook como texto (o título da opção).
 */
/**
 * Mensagem com um botão que abre um link (interactive cta_url, só dentro da janela de 24 h). Usada nos avisos
 * ao Arthur em vez de colar o link no texto (30/10/2026): a prévia automática de link em mensagem enviada pela
 * API chegava como miniatura borrada. Rótulo do botão até 20 caracteres.
 */
export async function enviarComLink(para: string, texto: string, url: string, rotulo: string): Promise<ResultadoDoEnvio> {
  if (!whatsappConfigurado()) return { ok: false, erro: 'WhatsApp não configurado' };
  try {
    return await respostaDoEnvio(
      await chamar({
        recipient_type: 'individual',
        to: para,
        type: 'interactive',
        interactive: {
          type: 'cta_url',
          body: { text: texto.slice(0, 1024) },
          action: { name: 'cta_url', parameters: { display_text: rotulo.slice(0, 20), url } },
        },
      })
    );
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'falha de rede' };
  }
}

export async function enviarComOpcoes(para: string, texto: string, opcoes: string[], ids?: string[]): Promise<ResultadoDoEnvio> {
  // ids: ação de cada botão (ex.: "desc:ok:<id>"), que volta no webhook em botaoId (decisões do Arthur, 0095).
  const id = (i: number) => ids?.[i]?.slice(0, 256) || `op${i}`;
  if (!whatsappConfigurado()) return { ok: false, erro: 'WhatsApp não configurado' };
  const corpo = { text: texto.slice(0, 1024) };
  const interactive =
    opcoes.length <= 3
      ? {
          type: 'button',
          body: corpo,
          action: { buttons: opcoes.map((t, i) => ({ type: 'reply', reply: { id: id(i), title: t.slice(0, 20) } })) },
        }
      : {
          type: 'list',
          body: corpo,
          action: {
            button: 'Ver opções',
            sections: [{ title: 'Opções', rows: opcoes.slice(0, 10).map((t, i) => ({ id: id(i), title: t.slice(0, 24) })) }],
          },
        };
  try {
    return await respostaDoEnvio(await chamar({ recipient_type: 'individual', to: para, type: 'interactive', interactive }));
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'falha de rede' };
  }
}

/** Sobe um arquivo para a Meta e manda como documento (ex.: a proposta em PDF). */
export async function enviarDocumento(
  para: string,
  arquivo: Uint8Array,
  nome: string,
  mime: string,
  legenda?: string
): Promise<ResultadoDoEnvio> {
  if (!whatsappConfigurado()) return { ok: false, erro: 'WhatsApp não configurado' };
  try {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', mime);
    form.append('file', new Blob([new Uint8Array(arquivo)], { type: mime }), nome);
    const up = await fetch(`${BASE}/${VERSAO}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
      body: form,
      signal: AbortSignal.timeout(30000),
    });
    const m = (await up.json()) as { id?: string; error?: { message?: string } };
    if (!up.ok || !m.id) return { ok: false, erro: m.error?.message ?? `upload HTTP ${up.status}` };
    return await respostaDoEnvio(
      await chamar({
        recipient_type: 'individual',
        to: para,
        type: 'document',
        document: { id: m.id, filename: nome, ...(legenda ? { caption: legenda.slice(0, 1024) } : {}) },
      })
    );
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

/* ------------------------------------------------------------ modelos (templates) */

/**
 * Manda um modelo aprovado (fora da janela de 24 h). Os parâmetros não podem ter
 * quebra de linha, tab nem mais de 4 espaços seguidos (regra da Meta).
 */
export async function enviarModelo(para: string, nome: string, parametros: string[], acoesDosBotoes?: string[]): Promise<ResultadoDoEnvio> {
  if (!whatsappConfigurado()) return { ok: false, erro: 'WhatsApp não configurado' };
  const limpo = (t: string) => t.replace(/\s*\n+\s*/g, ' · ').replace(/\t/g, ' ').replace(/ {4,}/g, ' ').trim().slice(0, 900);
  try {
    const r = await chamar({
      recipient_type: 'individual',
      to: para,
      type: 'template',
      template: {
        name: nome,
        language: { code: 'pt_BR' },
        components: [
          { type: 'body', parameters: parametros.map((p) => ({ type: 'text', text: limpo(p) })) },
          // Botões de resposta rápida com a ação de cada um (volta no webhook em button.payload).
          ...(acoesDosBotoes ?? []).map((payload, i) => ({
            type: 'button',
            sub_type: 'quick_reply',
            index: String(i),
            parameters: [{ type: 'payload', payload: payload.slice(0, 256) }],
          })),
        ],
      },
    });
    const j = (await r.json()) as { messages?: { id: string }[]; error?: { message?: string } };
    if (!r.ok || !j.messages?.[0]?.id) return { ok: false, erro: j.error?.message ?? `HTTP ${r.status}` };
    return { ok: true, id: j.messages[0].id };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'falha de rede' };
  }
}

/** Status do modelo na conta (APPROVED, PENDING, REJECTED...). null = não existe. */
export async function statusDoModelo(wabaId: string, nome: string): Promise<string | null> {
  return (await infoDoModelo(wabaId, nome))?.status ?? null;
}

/** Status e categoria do modelo na Meta (a Meta pode trocar UTILITY por MARKETING, que custa mais). */
export async function infoDoModelo(wabaId: string, nome: string): Promise<{ status: string; categoria: string } | null> {
  try {
    const r = await fetch(`${BASE}/${VERSAO}/${wabaId}/message_templates?name=${encodeURIComponent(nome)}&fields=name,status,category`, {
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
      signal: AbortSignal.timeout(15000),
    });
    const j = (await r.json()) as { data?: { name: string; status: string; category?: string }[] };
    const t = j.data?.find((x) => x.name === nome);
    return t ? { status: t.status, categoria: t.category ?? '' } : null;
  } catch {
    return null;
  }
}

export async function criarModelo(
  wabaId: string,
  modelo: Record<string, unknown>
): Promise<{ ok: true; status: string | null } | { ok: false; erro: string }> {
  try {
    const r = await fetch(`${BASE}/${VERSAO}/${wabaId}/message_templates`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(modelo),
      signal: AbortSignal.timeout(15000),
    });
    const j = (await r.json()) as { id?: string; status?: string; error?: { message?: string; error_user_msg?: string } };
    if (!r.ok || !j.id) return { ok: false, erro: j.error?.error_user_msg ?? j.error?.message ?? `HTTP ${r.status}` };
    return { ok: true, status: j.status ?? null };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'falha de rede' };
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
  /** Ação do botão tocado (id do botão interativo ou payload do botão do modelo); null se não foi botão. */
  botaoId: string | null;
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
export type StatusRecebido = { id: string; status: string; erro: string | null; codigo: number | null };

type CorpoDoWebhook = {
  entry?: {
    /** Id da conta do WhatsApp Business (WABA). */
    id?: string;
    changes?: {
      value?: {
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: {
          id: string;
          from: string;
          timestamp: string;
          type: string;
          text?: { body?: string };
          button?: { text?: string; payload?: string };
          interactive?: { button_reply?: { id?: string; title?: string }; list_reply?: { id?: string; title?: string } };
          image?: Midia;
          document?: Midia & { filename?: string };
          audio?: Midia & { voice?: boolean };
          video?: Midia;
          sticker?: Midia;
          location?: { latitude?: number; longitude?: number; name?: string; address?: string };
          contacts?: { name?: { formatted_name?: string }; phones?: { phone?: string }[] }[];
          reaction?: { emoji?: string };
        }[];
        statuses?: { id: string; status: string; errors?: { code?: number; title?: string; message?: string }[] }[];
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

export function lerWebhook(corpo: unknown): { mensagens: MensagemRecebida[]; status: StatusRecebido[]; wabaId: string | null } {
  const mensagens: MensagemRecebida[] = [];
  const status: StatusRecebido[] = [];
  let wabaId: string | null = null;
  for (const entry of (corpo as CorpoDoWebhook)?.entry ?? []) {
    if (entry.id) wabaId = entry.id;
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
          botaoId: m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id ?? m.button?.payload ?? null,
        });
      }
      for (const s of v.statuses ?? []) {
        const e = s.errors?.[0];
        status.push({ id: s.id, status: s.status, erro: e ? (e.message ?? e.title ?? 'erro') : null, codigo: e?.code ?? null });
      }
    }
  }
  return { mensagens, status, wabaId };
}
