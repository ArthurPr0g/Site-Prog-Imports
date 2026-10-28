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
