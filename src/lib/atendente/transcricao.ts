// Transcrição dos áudios do WhatsApp. Só no servidor.
//
// O Claude não recebe áudio (só texto, imagem e PDF; conferido na documentação
// em 28/10/2026), então o áudio vira texto antes. Serviço padrão: Whisper na
// Groq (API no formato da OpenAI; aceita o .ogg do WhatsApp; US$ 0,04 por hora
// de áudio no whisper-large-v3-turbo, conferido em 28/10/2026). Dá para trocar
// por outro serviço compatível com TRANSCRICAO_URL e TRANSCRICAO_MODELO.
// Sem TRANSCRICAO_API_KEY, devolve null e a IA pede para o cliente escrever.

const URL_PADRAO = 'https://api.groq.com/openai/v1/audio/transcriptions';
const MODELO_PADRAO = 'whisper-large-v3-turbo';

export const transcricaoConfigurada = () => !!process.env.TRANSCRICAO_API_KEY;

export async function transcrever(dados: Buffer, mime: string): Promise<string | null> {
  const chave = process.env.TRANSCRICAO_API_KEY;
  if (!chave) return null;
  const ext = mime.includes('mpeg') ? 'mp3' : mime.includes('mp4') || mime.includes('m4a') ? 'm4a' : mime.includes('wav') ? 'wav' : 'ogg';
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(dados)], { type: mime || 'audio/ogg' }), `audio.${ext}`);
  form.append('model', process.env.TRANSCRICAO_MODELO || MODELO_PADRAO);
  form.append('response_format', 'json');
  // Português e vocabulário que aparece nas mensagens: sem isso, "Claude" vira "Cláudio".
  form.append('language', 'pt');
  form.append('prompt', 'Claude, Claude Code, Lia, Hub, Prog Imports, Prog Soluções, Liberdade Médica, Workshop, captação, lead, deploy.');
  try {
    const r = await fetch(process.env.TRANSCRICAO_URL || URL_PADRAO, {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}` },
      body: form,
      signal: AbortSignal.timeout(45000),
    });
    if (!r.ok) {
      console.error('[atendente] transcrição falhou', r.status, (await r.text()).slice(0, 300));
      return null;
    }
    const j = (await r.json()) as { text?: string };
    const texto = j.text?.trim();
    return texto || null;
  } catch (e) {
    console.error('[atendente] transcrição falhou', e);
    return null;
  }
}

export type SegmentoTranscrito = { inicio: number; fim: number; texto: string };
export type Transcrito =
  | { ok: true; texto: string; segmentos: SegmentoTranscrito[]; segundos: number }
  | { ok: false; limite: true; esperarSeg: number }
  | { ok: false; limite: false };

/**
 * Transcrição com os segmentos e o tempo de cada um (sala de reunião, 31/10/2026): response_format verbose_json
 * com timestamp_granularities[]=segment (console.groq.com/docs/speech-to-text). Diferente de transcrever(), diz
 * quando foi o limite do plano (429, com o retry-after em segundos; console.groq.com/docs/rate-limits), para a
 * sala guardar o trecho e transcrever depois em vez de perder.
 */
export async function transcreverComTempo(dados: Buffer, mime: string, dica?: string): Promise<Transcrito> {
  const chave = process.env.TRANSCRICAO_API_KEY;
  if (!chave) return { ok: false, limite: false };
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(dados)], { type: mime || 'audio/webm' }), mime.includes('ogg') ? 'audio.ogg' : 'audio.webm');
  form.append('model', process.env.TRANSCRICAO_MODELO || MODELO_PADRAO);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');
  form.append('language', 'pt');
  form.append('prompt', `Prog Soluções, Arthur, site, sistema, loja virtual, proposta, sinal, Pix. ${dica ?? ''}`.slice(0, 600));
  try {
    const r = await fetch(process.env.TRANSCRICAO_URL || URL_PADRAO, {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}` },
      body: form,
      signal: AbortSignal.timeout(45000),
    });
    if (r.status === 429) {
      const seg = Number(r.headers.get('retry-after'));
      return { ok: false, limite: true, esperarSeg: Number.isFinite(seg) && seg > 0 ? Math.min(3600, Math.ceil(seg)) : 60 };
    }
    if (!r.ok) {
      console.error('[reunioes] transcrição falhou', r.status, (await r.text()).slice(0, 300));
      return { ok: false, limite: false };
    }
    const j = (await r.json()) as { text?: string; duration?: number; segments?: { start?: number; end?: number; text?: string; no_speech_prob?: number }[] };
    const segmentos = (j.segments ?? [])
      // Segmento que o próprio Whisper acha que é silêncio: costuma ser frase inventada.
      .filter((s) => (s.text ?? '').trim() && (s.no_speech_prob ?? 0) < 0.8)
      .map((s) => ({ inicio: Number(s.start ?? 0), fim: Number(s.end ?? s.start ?? 0), texto: String(s.text).trim() }));
    return { ok: true, texto: (j.text ?? '').trim(), segmentos, segundos: Number(j.duration ?? 0) };
  } catch (e) {
    console.error('[reunioes] transcrição falhou', e);
    return { ok: false, limite: false };
  }
}
