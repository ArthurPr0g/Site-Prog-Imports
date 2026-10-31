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

/* ------------------------------------------------------------ teste de voz do Arthur (31/10/2026) */

// "Lia, estou só fazendo um teste para você responder com mensagem de voz": ela responde num tom
// brincalhão, com risada, e mostra em ~15-20 s o que sabe fazer. Usa o eleven_v3, que entende [laughs].
export function ehTesteDeVoz(texto: string): boolean {
  const t = texto.toLowerCase();
  // Sem \b antes do "á": em JavaScript o \b não reconhece letra acentuada como parte da palavra.
  return t.length <= 300 && /\btest(e|ando|ar)\b/.test(t) && /(\bvoz\b|[áa]udio|\bfala(ndo)?\b)/.test(t);
}

const FALAS_DO_TESTE = [
  '[laughs] Tudo bem, Prog? Teste recebido, alto e claro! [giggles] Olha só o que eu faço: anoto suas ideias, mando pedido pro Claude, atualizo negociação de cliente e, se alguém me manda áudio, eu respondo assim, com essa vozinha. Mais alguma coisa, chefe?',
  '[laughs] Oi, Prog! Tô ouvindo, tô ouvindo! Pode testar à vontade. [giggles] Enquanto isso eu sigo aqui: atendo os clientes, faço a pesquisa de cada um, monto o briefing e te aviso quando tiver coisa pra você decidir. Bora vender?',
  '[giggles] Tudo bem, Prog? Funcionou, viu? Agora eu falo! [laughs] Me manda um áudio com uma ideia, um pedido pro Claude ou como foi uma reunião, que eu organizo tudo e te respondo assim, rapidinho. Manda ver!',
];

/** Fala do teste (com as marcações de risada) e o mesmo texto limpo, para ir escrito logo depois. */
export function falaDoTesteDeVoz(): { fala: string; texto: string } {
  const fala = FALAS_DO_TESTE[Math.floor(Math.random() * FALAS_DO_TESTE.length)];
  return { fala, texto: fala.replace(/\[[^\]]+\]\s*/g, '').trim() };
}

/** Gera a fala em Ogg/Opus. Devolve null se não houver chave, se o texto não tiver o que falar ou se falhar.
 *  `expressivo`: eleven_v3, que interpreta marcações como [laughs] (o texto vai como está, sem limpar). */
export async function falar(texto: string, expressivo = false): Promise<Buffer | null> {
  const chave = process.env.ELEVENLABS_API_KEY;
  const fala = expressivo ? texto.trim() : textoFalavel(texto);
  if (!chave || fala.length < 2) return null;
  const voz = process.env.ELEVENLABS_VOZ_DONO || VOZ_PADRAO;
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voz}?output_format=opus_48000_32`, {
      method: 'POST',
      headers: { 'xi-api-key': chave, 'Content-Type': 'application/json' },
      body: JSON.stringify(
        expressivo
          ? { text: fala, model_id: 'eleven_v3' }
          : {
              text: fala,
              model_id: MODELO,
              voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
            }
      ),
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
