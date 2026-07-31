import { notFound } from 'next/navigation';
import Link from 'next/link';
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

  return (
    <div className="min-h-screen bg-page">
      <PromoBar />
      <Header searchIndex={searchIndex} user={user} />

      <div className="mx-auto max-w-[1280px] px-6 pt-6 text-[13px] text-fg-tertiary">
        <Link href="/" className="text-fg-tertiary">Home</Link> /{' '}
        <Link href={`/?categoria=${encodeURIComponent(product.category)}#colecoes`} className="text-fg-tertiary">
          {product.category}
        </Link>{' '}
        / <span className="text-fg">{product.name}</span>
      </div>

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

      <Footer />
      <CartDrawer />
    </div>
  );
}
