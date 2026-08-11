import type { MetadataRoute } from 'next';
import { SITE_URL, urlAbsoluta } from '@/lib/seo';

/** `/robots.txt` — antes disso o arquivo não existia (404), e o buscador
 *  entrava sem instrução nenhuma: rastreava `/admin` e `/conta`, que são áreas
 *  logadas e sem valor de busca, gastando o orçamento de rastreio que devia ir
 *  para os produtos.
 *
 *  As áreas bloqueadas aqui também têm `noindex` na própria página. As duas
 *  coisas resolvem problemas diferentes: `robots.txt` evita a visita, o
 *  `noindex` evita o índice caso a URL chegue por um link externo — e uma
 *  página bloqueada no robots pode ser indexada sem ser lida, aparecendo na
 *  busca sem título nem descrição. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/', '/conta', '/conta/', '/api/', '/auth/'],
      },
    ],
    sitemap: urlAbsoluta('/sitemap.xml'),
    host: SITE_URL,
  };
}
