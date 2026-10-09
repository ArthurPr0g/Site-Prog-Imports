'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult } from '@/lib/action-result';
import { buscarAssuntos } from '@/lib/estudio/assuntos';
import { traduzirAssuntos } from '@/lib/estudio/traducao';

async function adminClient() {
  const admin = await requireAdmin();
  if (!admin) return null;
  return createClient();
}

/** Busca as fontes e guarda o que é novo.
 *
 *  O `upsert` por `url` com `ignoreDuplicates` é o que faz clicar duas vezes
 *  não encher a lista: notícia que já está na pauta não volta, e — o que
 *  importa mais — notícia que o dono descartou não ressuscita como novidade na
 *  atualização seguinte. */
export async function atualizarAssuntosAction(): Promise<ActionResult & { novos?: number }> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  let achados;
  try {
    achados = await buscarAssuntos();
  } catch {
    return errResult('Não consegui ler as fontes agora. Tente de novo em alguns minutos.');
  }
  if (achados.length === 0) {
    return errResult('As fontes responderam, mas nada do que saiu hoje é sobre o que a loja vende.');
  }

  const { data, error } = await supabase
    .from('studio_topics')
    .upsert(achados, { onConflict: 'url', ignoreDuplicates: true })
    .select('id');

  if (error) return errResult('Não consegui gravar a pauta.');

  const traduzidos = await traduzirPendentes(supabase);

  revalidatePath('/admin/estudio');
  const novos = data?.length ?? 0;
  const recado =
    novos === 0
      ? 'Nenhum assunto novo desde a última busca.'
      : `${novos} ${novos === 1 ? 'assunto novo' : 'assuntos novos'} na pauta.`;

  return {
    ...okResult(traduzidos > 0 ? `${recado} ${traduzidos} traduzidos.` : recado),
    novos,
  };
}

/** Traduz o que ainda está em inglês na mesa.
 *
 *  Roda junto da busca, e não só sobre o que acabou de entrar: assim um lote
 *  que falhou na tradução — chave fora do ar, erro da API — se resolve
 *  sozinho na próxima atualização, em vez de ficar em inglês para sempre.
 *
 *  Só o que está em `novo`: traduzir o que já foi descartado é gastar para
 *  enfeitar o que ninguém vai ler. */
async function traduzirPendentes(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<number> {
  const { data: pendentes } = await supabase
    .from('studio_topics')
    .select('id, titulo, resumo')
    .eq('status', 'novo')
    .is('titulo_pt', null)
    .order('relevancia', { ascending: false })
    .limit(40);

  if (!pendentes?.length) return 0;

  const traduzidos = await traduzirAssuntos(pendentes);
  if (traduzidos.length === 0) return 0;

  // Uma linha por vez: o PostgREST não tem update em massa com valores
  // diferentes por linha, e um upsert aqui arriscaria recriar o que foi
  // descartado.
  const gravados = await Promise.allSettled(
    traduzidos.map((t) =>
      supabase
        .from('studio_topics')
        .update({ titulo_pt: t.titulo_pt, resumo_pt: t.resumo_pt })
        .eq('id', t.id)
    )
  );

  return gravados.filter((r) => r.status === 'fulfilled' && !r.value.error).length;
}

export async function mudarStatusDoAssuntoAction(
  id: string,
  status: 'novo' | 'descartado' | 'produzido'
): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return errResult('Você não tem permissão para fazer isso.');

  const { error } = await supabase.from('studio_topics').update({ status }).eq('id', id);
  if (error) return errResult('Não consegui atualizar o assunto.');

  revalidatePath('/admin/estudio');
  return okResult(status === 'descartado' ? 'Assunto descartado.' : 'Assunto atualizado.');
}
