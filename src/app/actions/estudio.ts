'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult, friendlyDbError } from '@/lib/action-result';
import { modeloPorCodigo } from '@/lib/estudio/modelos';

export type PecaInput = {
  id?: string;
  modelo: string;
  titulo: string;
  conteudo: Record<string, string>;
  productId: string | null;
  legenda: string;
  /** A mensagem de direct para quem comentar a palavra-chave da peça. */
  respostaDireta?: string;
  status: 'Rascunho' | 'Pronta' | 'Publicada';
};

async function adminClient() {
  const admin = await requireAdmin();
  if (!admin) return null;
  return createClient();
}

export async function salvarPecaAction(entrada: PecaInput): Promise<ActionResult & { id?: string }> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const modelo = modeloPorCodigo(entrada.modelo);
  if (!modelo) return errResult('Modelo não existe no playbook.');

  // O título é o nome interno da peça, para ela ser encontrada na lista. Quando
  // o dono não dá um, o texto da arte serve melhor que "Peça sem título".
  const titulo =
    entrada.titulo.trim() ||
    entrada.conteudo.titulo?.trim() ||
    entrada.conteudo.capaTitulo?.trim() ||
    `${modelo.nome} sem título`;

  const linha = {
    modelo: entrada.modelo,
    formato: modelo.formato,
    titulo,
    conteudo: entrada.conteudo,
    product_id: entrada.productId,
    legenda: entrada.legenda,
    resposta_direta: entrada.respostaDireta ?? '',
    status: entrada.status,
    updated_at: new Date().toISOString(),
  };

  if (entrada.id) {
    const { error } = await supabase.from('studio_pieces').update(linha).eq('id', entrada.id);
    if (error) return errResult(friendlyDbError(error, 'Não foi possível salvar a peça.'));
    revalidatePath('/admin/estudio');
    return { ...okResult('Peça salva.'), id: entrada.id };
  }

  const { data, error } = await supabase.from('studio_pieces').insert(linha).select('id').single();
  if (error) return errResult(friendlyDbError(error, 'Não foi possível criar a peça.'));
  revalidatePath('/admin/estudio');
  return { ...okResult('Peça criada.'), id: data?.id };
}

export async function excluirPecaAction(id: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const { error } = await supabase.from('studio_pieces').delete().eq('id', id);
  if (error) return errResult(friendlyDbError(error, 'Não foi possível excluir a peça.'));
  revalidatePath('/admin/estudio');
  return okResult('Peça excluída.');
}
