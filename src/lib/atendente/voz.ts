// Voz da Lia (pedido do Arthur, 31/10/2026): quando ELE manda áudio, ela responde em áudio, com a voz
// "Roberta - Smooth and Confident" do ElevenLabs (plano Starter, licença comercial). Só no servidor.
//
// O ElevenLabs devolve Ogg/Opus mono 48 kHz (output_format opus_48000_*), que é exatamente o formato que a
// Meta exige para mensagem de voz (voice: true), então não precisa de ffmpeg na Vercel. Conferido em 31/10.
// Desde 31/10 também para clientes: quem manda áudio recebe áudio (agente.ts, modo 'quando-preciso').
// A voz é natural, mas a Lia continua sem dizer que é pessoa: confirma que é assistente se perguntarem.

const VOZ_PADRAO = 'RGymW84CSmfVugnA5tvA'; // Roberta - Smooth and Confident (pt-BR)
const MODELO = 'eleven_multilingual_v2';
const LIMITE = 700; // ~45 s de fala; o resto do texto segue escrito

export const vozConfigurada = () => !!process.env.ELEVENLABS_API_KEY;

/** Texto que dá para falar: sem links, sem marcação do WhatsApp, sem emojis e sem linhas de rodapé com ícone. */
export function textoFalavel(texto: string): string {
  let t = texto
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_~`]/g, '')
    .replace(/\p{Extended_Pictographic}|️|‍/gu, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^[-•·]?\s*$/.test(l))
    // Título solto ("Ideia anotada") sem ponto emendaria na frase seguinte: o ponto dá a pausa natural.
    .map((l) => (/[.!?:;,…]$/.test(l) ? l : `${l}.`))
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  if (t.length > LIMITE) {
    // Corta no fim de uma frase para não terminar no meio da palavra.
    const corte = t.slice(0, LIMITE);
    const fim = Math.max(corte.lastIndexOf('. '), corte.lastIndexOf('? '), corte.lastIndexOf('! '), corte.lastIndexOf('\n'));
    t = (fim > LIMITE * 0.5 ? corte.slice(0, fim + 1) : corte).trim();
  }
  return t;
}

/** Gera a fala em Ogg/Opus. Devolve null se não houver chave, se o texto não tiver o que falar ou se falhar. */
export async function falar(texto: string): Promise<Buffer | null> {
  const chave = process.env.ELEVENLABS_API_KEY;
  const fala = textoFalavel(texto);
  if (!chave || fala.length < 2) return null;
  const voz = process.env.ELEVENLABS_VOZ_DONO || VOZ_PADRAO;
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voz}?output_format=opus_48000_32`, {
      method: 'POST',
      headers: { 'xi-api-key': chave, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: fala,
        model_id: MODELO,
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!r.ok) {
      console.error('[voz] ElevenLabs', r.status, (await r.text()).slice(0, 200));
      return null;
    }
    return Buffer.from(await r.arrayBuffer());
  } catch (e) {
    console.error('[voz] falhou', e);
    return null;
  }
}
