import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatBRL } from '@/lib/format';
import { descricaoCurta } from '@/lib/seo';
import { JsonLd, productSchema, breadcrumbSchema } from '@/components/seo/JsonLd';
import { getProductBySku, listActiveProducts } from '@/lib/data/catalog';
import { getCurrentUser } from '@/lib/auth';
import { PromoBar } from '@/components/layout/PromoBar';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { Gallery } from '@/components/product/Gallery';
import { BuyBox } from '@/components/product/BuyBox';
import { ProductTabs } from '@/components/product/ProductTabs';
import { RelatedProducts } from '@/components/product/RelatedProducts';
import { StarRating } from '@/components/ui/Price';
import { ReadyToShipBadge } from '@/components/ui/ReadyToShipBadge';

/** Título e descrição vêm do próprio produto.
 *
 *  Antes toda página herdava o título da loja: os 22 produtos apareciam na busca
 *  com o mesmo texto, competindo entre si e sem dizer o que eram. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ sku: string }>;
}): Promise<Metadata> {
  const { sku } = await params;
  const product = await getProductBySku(sku);

  if (!product) {
    return { title: 'Produto não encontrado', robots: { index: false, follow: true } };
  }

  const preco = Number(product.promo_price ?? product.price);
  const caminho = `/produto/${product.sku}`;
  // A descrição sai do texto do produto; sem ele, é montada com o que existe de
  // fato no cadastro — nunca com adjetivo inventado.
  const descricao = descricaoCurta(
    product.description ||
      [
        product.name,
        product.categories?.name,
        product.brands?.name,
        preco > 0 ? `por ${formatBRL(preco)}` : '',
        'importado dos EUA com garantia Prog Imports.',
      ]
        .filter(Boolean)
        .join(' · ')
  );

  const foto = (product.product_images ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .find((i) => i.url)?.url;

  return {
    title: product.name,
    description: descricao,
    alternates: { canonical: caminho },
    openGraph: {
      type: 'website',
      title: product.name,
      description: descricao,
      url: caminho,
      images: foto ? [{ url: foto, alt: product.name }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description: descricao,
      images: foto ? [foto] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const [product, allProducts, user] = await Promise.all([
    getProductBySku(sku),
    listActiveProducts(),
    getCurrentUser(),
  ]);

  if (!product) notFound();

  const searchIndex = allProducts.map((p) => ({
    sku: p.sku,
    name: p.name,
    category: p.category,
    price: p.promoPrice ?? p.price,
  }));

  // Marcado por produto no admin. Antes era inferido do nome ou da categoria,
  // o que carimbava "exclusivo" em todo notebook gamer — inclusive nos modelos
  // que o Brasil também vende.
  const isExclusive = product.exclusive_us === true;

  // O próprio produto está entre os "siblings" (o grupo de variações inclui a
  // origem), então dá para reaproveitar o dado já carregado em vez de uma
  // consulta nova só para saber se há unidade em mãos.
  const readyToShip = product.siblings.some((s) => s.id === product.id && s.readyToShip);

  const precoAtual = Number(product.promo_price ?? product.price);

  return (
    <div className="min-h-screen bg-page">
      {/* A ficha do produto para o buscador: preço, disponibilidade, condição e
          especificações. É o que habilita o resultado rico na busca e o que os
          mecanismos de resposta leem em vez de adivinhar pelo texto. */}
      <JsonLd
        schema={productSchema({
          sku: product.sku,
          nome: product.name,
          descricao: product.description || product.name,
          imagens: (product.images ?? []).map((i) => i.url).filter(Boolean) as string[],
          marca: product.brand ?? '',
          categoria: product.category ?? '',
          preco: precoAtual,
          disponivel: readyToShip,
          estado: product.condition ?? '',
          specs: (product.specs ?? []).map((s) => ({ k: s.k, v: s.v })),
        })}
      />
      <JsonLd
        schema={breadcrumbSchema([
          { nome: 'Home', caminho: '/' },
          ...(product.category
            ? [{ nome: product.category, caminho: `/?categoria=${encodeURIComponent(product.category)}` }]
            : []),
          { nome: product.name, caminho: `/produto/${product.sku}` },
        ])}
      />

      <PromoBar />
      <Header searchIndex={searchIndex} user={user} />

      <nav aria-label="Você está em" className="mx-auto max-w-[1280px] px-6 pt-6 text-[13px] text-fg-tertiary">
        <Link href="/" className="text-fg-tertiary">Home</Link> /{' '}
        <Link href={`/?categoria=${encodeURIComponent(product.category)}#colecoes`} className="text-fg-tertiary">
          {product.category}
        </Link>{' '}
        / <span className="text-fg">{product.name}</span>
      </nav>

      <main>
      <section className="mx-auto grid max-w-[1280px] grid-cols-1 items-start gap-8 px-6 pt-6 md:grid-cols-[1.1fr_.9fr] md:gap-12">
        <Gallery images={product.images} badge={isExclusive ? 'EXCLUSIVO EUA' : undefined} />

        <div>
          <div className="mb-2.5 text-xs font-extrabold uppercase tracking-[.12em] text-accent">
            {product.category} · {product.brand}
          </div>
          <h1 className="mb-2.5 font-display text-[28px] font-bold leading-tight tracking-[-.02em] md:text-[34px]">
            {product.name}
          </h1>
          <div className="mb-5.5 flex flex-wrap items-center gap-2.5">
            <StarRating rating={product.rating} />
            <span className="text-[13px] text-fg-tertiary">
              {product.rating} · {product.review_count} avaliações
            </span>
            <span className="text-[13px] text-fg-tertiary">· SKU {product.sku}</span>
            {/* Estado de conservação é informação material pra quem compra
                importado (novo x seminovo x open box) e antes só aparecia
                embutido no nome do produto. Com o nome limpo, precisa de
                lugar próprio — aqui, antes do preço. */}
            {product.condition && (
              <span className="rounded-full border border-border-strong px-3 py-1 text-[11.5px] font-extrabold uppercase tracking-[.06em] text-fg-secondary">
                {product.condition}
              </span>
            )}
            {/* Só aparece com unidade física disponível. Sem ele o produto
                continua à venda, por encomenda — a ausência não é indisponibilidade. */}
            {readyToShip && <ReadyToShipBadge />}
          </div>

          <BuyBox
            productId={product.id}
            sku={product.sku}
            name={product.name}
            price={product.price}
            promoPrice={product.promoPrice}
            image={product.images[0]?.label ?? product.name.toLowerCase()}
            imageUrl={product.images.find((img) => img.url)?.url ?? null}
            highlights={product.highlights ?? []}
            siblings={product.siblings}
          />
        </div>
      </section>

      <ProductTabs description={product.description} specs={product.specs} reviews={product.reviews} />
      <RelatedProducts products={product.related} />
      </main>

      <Footer />
      <CartDrawer />
    </div>
  );
}
