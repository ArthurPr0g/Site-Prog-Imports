import type { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';
import { urlAbsoluta } from '@/lib/seo';

/** O sitemap é gerado a cada requisição, e não em build: produto novo entra no
 *  ar pelo painel, sem deploy. Um sitemap congelado no build ficaria desatualizado
 *  no dia seguinte ao primeiro cadastro. */
export const dynamic = 'force-dynamic';

/** `/sitemap.xml` — antes disso o arquivo não existia (404), e a descoberta dos
 *  produtos dependia inteiramente de o robô seguir links a partir da home.
 *
 *  Só entra o que é público e indexável: página de conta, painel e telas de
 *  login ficam de fora de propósito — sitemap é a lista do que se QUER na busca,
 *  não o inventário de rotas. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  // `created_at` e não `updated_at`: estas duas tabelas não têm coluna de
  // atualização. Data de criação é um `lastModified` conservador — nunca diz que
  // mudou algo que não mudou, que é o erro que faz o buscador desconfiar do
  // sitemap inteiro.
  const [produtos, colecoes] = await Promise.all([
    supabase.from('products').select('sku, created_at').eq('active', true).order('position'),
    supabase.from('collections').select('id, created_at').eq('show_on_site', true),
  ]);

  const agora = new Date();

  const fixas: MetadataRoute.Sitemap = [
    {
      url: urlAbsoluta('/'),
      lastModified: agora,
      changeFrequency: 'daily',
      // A home é a porta de entrada e a página com mais links internos.
      priority: 1,
    },
    {
      url: urlAbsoluta('/produtos'),
      lastModified: agora,
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ];

  const paginasDeProduto: MetadataRoute.Sitemap = (produtos.data ?? []).map((p) => ({
    url: urlAbsoluta(`/produto/${p.sku}`),
    lastModified: p.created_at ? new Date(p.created_at) : agora,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const paginasDeColecao: MetadataRoute.Sitemap = (colecoes.data ?? []).map((c) => ({
    url: urlAbsoluta(`/colecao/${c.id}`),
    lastModified: c.created_at ? new Date(c.created_at) : agora,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [...fixas, ...paginasDeProduto, ...paginasDeColecao];
}
