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

  const isExclusive = product.name.toLowerCase().includes('exclusiv') || product.category === 'Notebook Gamer';

  return (
    <div className="min-h-screen bg-page">
      <PromoBar />
      <Header searchIndex={searchIndex} user={user} />

      <div className="mx-auto max-w-[1280px] px-6 pt-6 text-[13px] text-fg-tertiary">
        <Link href="/" className="text-fg-tertiary">Home</Link> /{' '}
        <Link href={`/?categoria=${encodeURIComponent(product.category)}#produtos`} className="text-fg-tertiary">
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
          <div className="mb-5.5 flex items-center gap-2.5">
            <StarRating rating={product.rating} />
            <span className="text-[13px] text-fg-tertiary">
              {product.rating} · {product.review_count} avaliações
            </span>
            <span className="text-[13px] text-fg-tertiary">· SKU {product.sku}</span>
          </div>

          <BuyBox
            productId={product.id}
            sku={product.sku}
            name={product.name}
            price={product.price}
            promoPrice={product.promoPrice}
            image={product.images[0]?.label ?? product.name.toLowerCase()}
            imageUrl={product.images.find((img) => img.url)?.url ?? null}
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
