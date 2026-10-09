'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { type ActionResult, okResult, errResult } from '@/lib/action-result';
import { buscarAssuntos } from '@/lib/estudio/assuntos';

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

  // A tradução não acontece aqui. Buscar cinco feeds e traduzir dezenas de
  // manchetes na mesma requisição estoura o tempo da função — e foi o que
  // aconteceu: a pauta gravou e a tradução morreu junto com o processo, sem
  // deixar erro na tela. Agora quem traduz é `/api/estudio/traduzir`, em
  // lotes, chamado pela própria tela depois desta volta.
  revalidatePath('/admin/estudio');
  const novos = data?.length ?? 0;
  return {
    ...okResult(
      novos === 0
        ? 'Nenhum assunto novo desde a última busca.'
        : `${novos} ${novos === 1 ? 'assunto novo' : 'assuntos novos'} na pauta.`
    ),
    novos,
  };
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
