// Arquivos dos clientes fechados. Só no servidor.
//
// Pedido do dono (28/10/2026): cada cliente que fechar ganha uma pasta no
// OneDrive ("Empresa - Responsável") com o que ele mandou pelo WhatsApp, da
// conversa inteira. A Meta guarda a mídia só por 30 dias, então o relógio copia
// para o bucket privado `clientes` assim que o lead vira "fechado" (por
// qualquer caminho: Lia, painel ou link do vendedor). A tarefa do PC
// (scripts/onedrive/sincronizar-clientes.mjs) baixa para o OneDrive.

import type { DbDoAtendente } from '@/lib/atendente/db';
import { baixarMidia } from '@/lib/atendente/whatsapp-api';

const POR_VEZ = 6;
const TRINTA_DIAS = 30 * 24 * 60 * 60 * 1000;

const EXTENSAO: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'application/pdf': 'pdf',
};

export function extensaoDe(mime: string | null, nome: string | null): string {
  const doNome = nome?.match(/\.([a-z0-9]{1,5})$/i)?.[1];
  return (doNome ?? EXTENSAO[(mime ?? '').split(';')[0].trim()] ?? 'bin').toLowerCase();
}

/** Copia para o bucket as mídias pendentes de quem fechou. Devolve quantas copiou. */
export async function guardarArquivosDeClientes(db: DbDoAtendente): Promise<number> {
  const { data: pendentes } = await db
    .from('ia_messages')
    .select('id, media_id, media_type, media_mime, media_name, created_at, ia_conversations!inner(lead_id, leads!inner(status))')
    .not('media_id', 'is', null)
    .neq('media_type', 'sticker')
    .is('storage_path', null)
    .eq('direction', 'in')
    .eq('ia_conversations.leads.status', 'fechado')
    .order('created_at')
    .limit(POR_VEZ);

  let copiados = 0;
  for (const m of pendentes ?? []) {
    const leadId = m.ia_conversations.lead_id;
    // Passou dos 30 dias: a Meta já apagou. Marca para não tentar de novo.
    if (Date.now() - new Date(m.created_at).getTime() > TRINTA_DIAS) {
      await db.from('ia_messages').update({ storage_path: 'expirado' }).eq('id', m.id);
      continue;
    }
    const arq = await baixarMidia(m.media_id!);
    if (!arq) {
      await db.from('ia_messages').update({ storage_path: 'expirado' }).eq('id', m.id);
      continue;
    }
    const caminho = `${leadId}/${m.id}.${extensaoDe(arq.mime || m.media_mime, m.media_name)}`;
    const { error } = await db.storage
      .from('clientes')
      .upload(caminho, arq.dados, { contentType: arq.mime || m.media_mime || 'application/octet-stream', upsert: true });
    if (error) {
      console.error('[arquivos] falha ao guardar', m.id, error.message);
      continue;
    }
    await db.from('ia_messages').update({ storage_path: caminho }).eq('id', m.id);
    copiados++;
  }
  return copiados;
}
