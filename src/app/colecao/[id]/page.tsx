import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCollectionById, listActiveProducts } from '@/lib/data/catalog';
import { BRAND } from '@/lib/brand';
import { descricaoCurta } from '@/lib/seo';
import { JsonLd, itemListSchema, breadcrumbSchema } from '@/components/seo/JsonLd';
import { getCurrentUser } from '@/lib/auth';
import { PromoBar } from '@/components/layout/PromoBar';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { CollectionExplorer } from '@/components/collection/CollectionExplorer';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const collection = await getCollectionById(id);

  if (!collection) {
    return { title: 'Coleção não encontrada', robots: { index: false, follow: true } };
  }

  return {
    title: collection.name,
    description: descricaoCurta(
      `${collection.name} na ${BRAND.name}: ${collection.products.length} produto(s) importados dos Estados Unidos, com garantia e atendimento direto.`
    ),
    alternates: { canonical: `/colecao/${id}` },
    openGraph: { title: `${collection.name} | ${BRAND.name}`, url: `/colecao/${id}` },
  };
}

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [collection, allProducts, user] = await Promise.all([getCollectionById(id), listActiveProducts(), getCurrentUser()]);

  if (!collection) notFound();

  const searchIndex = allProducts.map((p) => ({
    sku: p.sku,
    name: p.name,
    category: p.category,
    price: p.promoPrice ?? p.price,
  }));

  return (
    <div className="min-h-screen bg-page">
      <PromoBar />
      <Header searchIndex={searchIndex} user={user} />

      <JsonLd
        schema={itemListSchema(collection.products.slice(0, 50).map((p) => ({ sku: p.sku, nome: p.name })))}
      />
      <JsonLd
        schema={breadcrumbSchema([
          { nome: 'Home', caminho: '/' },
          { nome: collection.name, caminho: `/colecao/${collection.id}` },
        ])}
      />

      <nav aria-label="Você está em" className="mx-auto max-w-[1280px] px-6 pt-6 text-[13px] text-fg-tertiary">
        <Link href="/" className="text-fg-tertiary">
          Home
        </Link>{' '}
        / <span className="text-fg">{collection.name}</span>
      </nav>

      <main>
      <div className="mx-auto max-w-[1280px] px-6 pt-4">
        <h1 className="font-display text-[30px] font-bold tracking-[-.02em] sm:text-[36px]">{collection.name}</h1>
        <p className="mt-1.5 text-[13.5px] text-fg-tertiary">{collection.products.length} produtos nessa coleção</p>
      </div>

      <CollectionExplorer products={collection.products} />
      </main>

      <Footer />
      <CartDrawer />
    </div>
  );
}
