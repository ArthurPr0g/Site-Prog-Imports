import { BRAND } from '@/lib/brand';
import { WHATSAPP_NUMBER, INSTAGRAM_HANDLE } from '@/lib/constants';
import { SITE_URL, SITE_DESCRIPTION, urlAbsoluta } from '@/lib/seo';

/** Dados estruturados em JSON-LD.
 *
 *  Só entra informação que existe de verdade no projeto. CNPJ, endereço físico,
 *  horário de atendimento e nota de avaliação ficam de fora enquanto o dono não
 *  informar: schema com dado inventado é pior que schema ausente — o Google
 *  cruza com outras fontes, e uma divergência derruba a confiança em tudo que o
 *  site declara.
 *
 *  Em especial, NÃO há `aggregateRating`. O catálogo tem nota 4.9 gravada e
 *  zero avaliações reais; publicar isso como se fosse média de clientes é
 *  exatamente o que a política de avaliações do Google chama de conteúdo
 *  enganoso. */

/** Injeta o bloco. `dangerouslySetInnerHTML` é a forma suportada de emitir
 *  JSON-LD no React — o conteúdo é gerado aqui, nunca vem do usuário. */
export function JsonLd({ schema }: { schema: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
    />
  );
}

/** Quem é a loja. Vai no site inteiro, com `@id` fixo para as outras entidades
 *  poderem apontar para ela em vez de repetir os dados. */
export function organizationSchema() {
  const perfis = [INSTAGRAM_HANDLE ? `https://instagram.com/${INSTAGRAM_HANDLE}` : null].filter(
    Boolean
  ) as string[];

  return {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    '@id': `${SITE_URL}/#organizacao`,
    name: BRAND.name,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    logo: urlAbsoluta('/images/logo.png'),
    image: urlAbsoluta('/images/logo.png'),
    slogan: BRAND.tagline,
    ...(perfis.length > 0 && { sameAs: perfis }),
    ...(WHATSAPP_NUMBER && {
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        telephone: `+${WHATSAPP_NUMBER}`,
        availableLanguage: ['Portuguese'],
      },
    }),
  };
}

/** O site em si, com a busca interna declarada: é o que permite ao Google
 *  oferecer a caixa de busca do site direto no resultado. */
export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#site`,
    name: BRAND.name,
    url: SITE_URL,
    inLanguage: 'pt-BR',
    publisher: { '@id': `${SITE_URL}/#organizacao` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/produtos?busca={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export type ProdutoParaSchema = {
  sku: string;
  nome: string;
  descricao: string;
  imagens: string[];
  marca: string;
  categoria: string;
  preco: number;
  disponivel: boolean;
  /** Novo, seminovo, etc. Vira a condição do schema. */
  estado: string;
  specs: { k: string; v: string }[];
};

/** Condição do produto no vocabulário do schema.org. */
function condicaoSchema(estado: string): string {
  const e = estado.toLowerCase();
  if (e.includes('semin') || e.includes('usado')) return 'https://schema.org/UsedCondition';
  if (e.includes('recond') || e.includes('vitrine')) return 'https://schema.org/RefurbishedCondition';
  return 'https://schema.org/NewCondition';
}

/** A ficha do produto para o buscador: é o que habilita preço, disponibilidade
 *  e foto aparecerem direto no resultado da busca e nas respostas de IA. */
export function productSchema(p: ProdutoParaSchema) {
  const url = urlAbsoluta(`/produto/${p.sku}`);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#produto`,
    name: p.nome,
    description: p.descricao,
    sku: p.sku,
    ...(p.imagens.length > 0 && { image: p.imagens }),
    ...(p.marca && { brand: { '@type': 'Brand', name: p.marca } }),
    ...(p.categoria && { category: p.categoria }),
    // A ficha técnica entra como propriedades adicionais: é dela que os
    // mecanismos de resposta tiram "quanto de RAM tem", sem precisar interpretar
    // o texto da página.
    ...(p.specs.length > 0 && {
      additionalProperty: p.specs.map((s) => ({
        '@type': 'PropertyValue',
        name: s.k,
        value: s.v,
      })),
    }),
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'BRL',
      price: p.preco.toFixed(2),
      itemCondition: condicaoSchema(p.estado),
      availability: p.disponivel
        ? 'https://schema.org/InStock'
        : 'https://schema.org/PreOrder',
      seller: { '@id': `${SITE_URL}/#organizacao` },
    },
  };
}

/** Caminho de navegação. O site já mostra "Home / Categoria / Produto" na tela;
 *  aqui a mesma trilha é dita ao buscador, que a usa no lugar da URL crua no
 *  resultado. */
export function breadcrumbSchema(itens: { nome: string; caminho: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: itens.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.nome,
      item: urlAbsoluta(item.caminho),
    })),
  };
}

/** Lista de produtos de uma página de catálogo, na ordem em que aparecem. */
export function itemListSchema(produtos: { sku: string; nome: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: produtos.length,
    itemListElement: produtos.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: urlAbsoluta(`/produto/${p.sku}`),
      name: p.nome,
    })),
  };
}
