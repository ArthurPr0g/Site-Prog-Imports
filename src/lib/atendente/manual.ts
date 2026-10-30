import { baixarMidia, enviarTexto, marcarLidaEDigitando, type MensagemRecebida } from '@/lib/atendente/whatsapp-api';
import { mesmoTelefone } from '@/lib/atendente/avisos';

// Manual do Empreendedorismo Médico (newsletter da Liberdade Médica) — PROVISÓRIO, MVP de 30/10/2026.
// O número da Lia só REPASSA as mensagens do Ian para a porta do Manual (Edge Function mem-whatsapp,
// no Supabase da LM) e entrega no WhatsApp o que a porta mandar de volta. A Lia não responde, não usa
// IA e não grava nada no banco da Prog para esses números.
// Para tirar: apagar este arquivo, a linha do webhook que chama repassarAoManual e a rota /api/manual/enviar,
// e as variáveis MANUAL_* da Vercel. O número próprio da LM passa a chamar a mesma porta.

function numerosDoManual(): string[] {
  return (process.env.MANUAL_NUMEROS ?? '').split(',').map((n) => n.trim()).filter(Boolean);
}

export function ehDoManual(telefone: string): boolean {
  return numerosDoManual().some((n) => mesmoTelefone(n, telefone));
}

export function tokenDoManualConfere(token: string | null): boolean {
  const certo = process.env.MANUAL_TOKEN ?? '';
  return certo.length >= 32 && token === certo;
}

/** Entrega a mensagem do Ian na porta do Manual (texto ou áudio em base64). */
export async function repassarAoManual(m: MensagemRecebida): Promise<void> {
  const url = process.env.MANUAL_PORTA_URL;
  if (!url || !process.env.MANUAL_TOKEN) return;
  await marcarLidaEDigitando(m.id);
  let corpo: Record<string, string>;
  if (m.midia?.tipo === 'audio') {
    const arquivo = await baixarMidia(m.midia.id);
    if (!arquivo) {
      await enviarTexto(m.de, 'Não consegui baixar o áudio 😕 Pode mandar de novo?');
      return;
    }
    corpo = { de: m.de, msg_id: m.id, tipo: 'audio', audio_base64: arquivo.dados.toString('base64'), mime: arquivo.mime || m.midia.mime || 'audio/ogg' };
  } else if (m.texto.trim()) {
    corpo = { de: m.de, msg_id: m.id, tipo: 'texto', texto: m.texto };
  } else {
    return; // figurinha, reação, foto: o Manual só trata texto e áudio
  }
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-mem-canal-token': process.env.MANUAL_TOKEN },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) await enviarTexto(m.de, 'Tive um problema para registrar sua mensagem. Pode tentar de novo em alguns minutos?');
  } catch {
    await enviarTexto(m.de, 'Tive um problema para registrar sua mensagem. Pode tentar de novo em alguns minutos?');
  }
}
