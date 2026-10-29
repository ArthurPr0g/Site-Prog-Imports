// Ideias e prompts do Arthur pelo WhatsApp da Lia (migration 0088). Só no servidor.
//
// Tudo o que o Arthur manda do número dele (ia_config.owner_whatsapp), menos
// "relatório", vira anotação na página Ideias do Hub pessoal:
//   - começa com "Claude" ou "prompt" → PROMPT para o Claude Code (o gancho
//     UserPromptSubmit do PC busca os pendentes na próxima mensagem do chat);
//   - o resto → IDEIA.
// Áudio é transcrito antes (transcricao.ts). A Lia responde confirmando.

import type { DbDoAtendente } from './db';
import { baixarMidia, enviarTexto, type MensagemRecebida } from './whatsapp-api';
import { transcrever, transcricaoConfigurada } from './transcricao';

/** "Claude, ..." / "prompt: ..." / "para o Claude: ..." no começo da mensagem. */
const PREFIXO_DE_PROMPT = /^\s*(?:para o\s+)?(?:claude(?:\s+code)?|prompt)\b[\s,:;.\-–—]*/i;

export function separarPrompt(texto: string): { tipo: 'ideia' | 'prompt'; texto: string } {
  const m = texto.match(PREFIXO_DE_PROMPT);
  if (m && texto.slice(m[0].length).trim()) return { tipo: 'prompt', texto: texto.slice(m[0].length).trim() };
  return { tipo: 'ideia', texto: texto.trim() };
}

/** Grava a mensagem do Arthur como ideia/prompt e responde no WhatsApp. */
export async function anotarDoDono(db: DbDoAtendente, m: MensagemRecebida): Promise<void> {
  let bruto = m.texto?.trim() ?? '';
  let origem: 'whatsapp' | 'whatsapp_audio' = 'whatsapp';
  if (m.midia?.tipo === 'audio') {
    origem = 'whatsapp_audio';
    const arquivo = await baixarMidia(m.midia.id);
    const texto = arquivo ? await transcrever(arquivo.dados, arquivo.mime || m.midia.mime) : null;
    if (!texto) {
      await enviarTexto(
        m.de,
        transcricaoConfigurada()
          ? 'Recebi o áudio, mas não consegui transcrever agora. Pode mandar de novo ou por escrito?'
          : 'Recebi o áudio, mas a transcrição ainda não está ligada (falta a chave TRANSCRICAO_API_KEY na Vercel). Por enquanto, manda por escrito que eu anoto.',
      );
      return;
    }
    bruto = texto;
  }
  // Foto/arquivo sem legenda, figurinha, reação: não há o que anotar.
  if (!bruto || /^\[o cliente mandou/.test(bruto) || m.reacao) return;

  const { tipo, texto } = separarPrompt(bruto);
  const { error } = await db
    .from('ideias')
    .upsert(
      { tipo, texto: texto.slice(0, 8000), origem, status: tipo === 'prompt' ? 'pendente' : 'nova', external_id: m.id },
      { onConflict: 'external_id', ignoreDuplicates: true },
    );
  if (error) {
    console.error('[ideias] falha ao gravar', error);
    await enviarTexto(m.de, 'Não consegui anotar agora. Tenta de novo em instantes?');
    return;
  }
  const eco = texto.length > 220 ? texto.slice(0, 217) + '…' : texto;
  await enviarTexto(
    m.de,
    tipo === 'prompt'
      ? `Prompt guardado para o Claude Code ✓\n\n"${eco}"\n\nEle pega na próxima vez que você mandar algo no chat.`
      : `Anotado nas suas Ideias ✓${origem === 'whatsapp_audio' ? ' (áudio transcrito)' : ''}\n\n"${eco}"`,
  );
}
