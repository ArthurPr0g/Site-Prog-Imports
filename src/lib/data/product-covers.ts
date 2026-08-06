import { createClient } from '@/lib/supabase/server';

/** Foto de capa de cada produto pedido: a imagem de menor `position`, que é a
 *  mesma que a vitrine usa como principal.
 *
 *  Uma consulta para todos os ids em vez de uma por linha — as listagens do
 *  gerenciamento mostram dezenas de produtos por página.
 *
 *  Não filtra por `active`: produto fora do ar continua aparecendo em orçamento,
 *  venda e estoque antigos, e esconder a foto justamente aí deixaria a tela
 *  menos reconhecível do que era antes de ter foto. */
export async function listProductCovers(productIds: (string | null)[]): Promise<Map<string, string>> {
  const ids = [...new Set(productIds.filter((id): id is string => !!id))];
  const capas = new Map<string, string>();
  if (ids.length === 0) return capas;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('product_images')
    .select('product_id, url, position')
    .in('product_id', ids)
    .order('position');

  if (error) {
    console.error('[capas] consulta falhou', error);
    return capas;
  }

  // Ordenado por posição: o primeiro de cada produto vence, e os seguintes são
  // descartados.
  for (const linha of data ?? []) {
    if (linha.product_id && linha.url && !capas.has(linha.product_id)) {
      capas.set(linha.product_id, linha.url);
    }
  }
  return capas;
}
