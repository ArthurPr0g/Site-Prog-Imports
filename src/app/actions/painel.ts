'use server';

import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIDIA = /^\d{5,40}$/;

async function admin() {
  const dono = await requireAdmin();
  if (!dono) return null;
  return createClient();
}

/** Grava a palavra, a mensagem e a peça de um post.
 *
 *  Zera o contador de comentários lidos: com a palavra trocada, os comentários
 *  antigos precisam ser relidos com a palavra nova na próxima atualização. */
export async function salvarPostAction(entrada: {
  mediaId: string;
  palavra: string;
  resposta: string;
  pecaId: string | null;
}): Promise<ActionResult> {
  const supabase = await admin();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  if (!MIDIA.test(entrada.mediaId)) return errResult('Post inválido.');
  if (entrada.pecaId && !UUID.test(entrada.pecaId)) return errResult('Peça inválida.');
  const palavra = entrada.palavra.trim().replace(/\s+/g, ' ').toUpperCase();
  if (palavra.length > 30) return errResult('A palavra-chave pode ter no máximo 30 letras.');
  const resposta = entrada.resposta.trim();
  if (resposta.length > 1000) return errResult('A mensagem pode ter no máximo 1000 caracteres.');

  const { error } = await supabase.from('studio_posts').upsert(
    {
      media_id: entrada.mediaId,
      palavra,
      resposta,
      piece_id: entrada.pecaId,
      comentarios_lidos: -1,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'media_id' }
  );
  if (error) return errResult(friendlyDbError(error, 'Não consegui salvar o post.'));
  return okResult('Post salvo.');
}

/** Marca (ou desmarca) pedidos como respondidos no direct. */
export async function marcarRespondidoAction(ids: string[], respondido: boolean): Promise<ActionResult> {
  const supabase = await admin();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const validos = ids.filter((id) => UUID.test(id)).slice(0, 500);
  if (validos.length === 0) return errResult('Nenhum pedido selecionado.');

  const { error } = await supabase
    .from('studio_respostas')
    .update({ respondido_em: respondido ? new Date().toISOString() : null })
    .in('id', validos);
  if (error) return errResult(friendlyDbError(error, 'Não consegui marcar.'));
  return okResult(respondido ? 'Marcado como respondido.' : 'Voltou para a fila.');
}
