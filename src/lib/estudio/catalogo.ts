// Busca os produtos no formato que o Estúdio usa.
//
// Mora à parte das páginas porque as duas telas do editor — peça nova e peça
// salva — precisam exatamente da mesma lista, e duplicar a consulta é como
// listas de produto saem diferentes entre telas sem ninguém perceber.

import { createClient } from '@/lib/supabase/server';
import type { ProdutoDoEstudio } from '@/lib/estudio/produto';

export async function listarProdutosDoEstudio(): Promise<ProdutoDoEstudio[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('products')
    .select(
      'id, sku, name, base_name, price, promo_price, cpu, gpu, ram, storage, screen_type, condition, stock, product_images(url, position)'
    )
    .eq('active', true)
    .order('name');

  type Linha = Omit<ProdutoDoEstudio, 'capa' | 'price' | 'promo_price'> & {
    price: number | string;
    promo_price: number | string | null;
    product_images: { url: string | null; position: number | null }[] | null;
  };

  return ((data ?? []) as unknown as Linha[]).map((p) => {
    // A capa é a imagem de posição 0 — a mesma que a vitrine mostra. Usar outra
    // faria a peça do Instagram divergir do que o cliente vê ao clicar.
    const capa =
      [...(p.product_images ?? [])]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .find((i) => i.url)?.url ?? null;

    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      base_name: p.base_name,
      price: Number(p.price),
      promo_price: p.promo_price === null ? null : Number(p.promo_price),
      cpu: p.cpu,
      gpu: p.gpu,
      ram: p.ram,
      storage: p.storage,
      screen_type: p.screen_type,
      condition: p.condition,
      stock: p.stock,
      capa,
    };
  });
}
