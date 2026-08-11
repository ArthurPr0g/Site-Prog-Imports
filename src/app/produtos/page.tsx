import type { Metadata } from 'next';
import Link from 'next/link';
import { listActiveProducts } from '@/lib/data/catalog';
import { BRAND } from '@/lib/brand';
import { descricaoCurta } from '@/lib/seo';
import { JsonLd, itemListSchema, breadcrumbSchema } from '@/components/seo/JsonLd';
import { getCurrentUser } from '@/lib/auth';
import { PromoBar } from '@/components/layout/PromoBar';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { CollectionExplorer } from '@/components/collection/CollectionExplorer';

export const metadata: Metadata = {
  title: 'Todos os produtos importados dos EUA',
  description: descricaoCurta(
    `Catálogo completo da ${BRAND.name}: MacBooks, iPhones, iPads e notebooks gamer importados dos Estados Unidos, com garantia e atendimento direto pelo WhatsApp.`
  ),
  alternates: { canonical: '/produtos' },
  openGraph: {
    title: `Todos os produtos | ${BRAND.name}`,
    url: '/produtos',
  },
};

export default async function AllProductsPage() {
  const [products, user] = await Promise.all([listActiveProducts(), getCurrentUser()]);

  const searchIndex = products.map((p) => ({
    sku: p.sku,
    name: p.name,
    category: p.category,
    price: p.promoPrice ?? p.price,
  }));

  return (
    <div className="min-h-screen bg-page">
      <PromoBar />
      <Header searchIndex={searchIndex} user={user} />

      <JsonLd schema={itemListSchema(products.slice(0, 50).map((p) => ({ sku: p.sku, nome: p.name })))} />
      <JsonLd
        schema={breadcrumbSchema([
          { nome: 'Home', caminho: '/' },
          { nome: 'Todos os produtos', caminho: '/produtos' },
        ])}
      />

      <nav aria-label="Você está em" className="mx-auto max-w-[1280px] px-6 pt-6 text-[13px] text-fg-tertiary">
        <Link href="/" className="text-fg-tertiary">
          Home
        </Link>{' '}
        / <span className="text-fg">Todos os produtos</span>
      </nav>

      <main>
      <div className="mx-auto max-w-[1280px] px-6 pt-4">
        <h1 className="font-display text-[30px] font-bold tracking-[-.02em] sm:text-[36px]">Todos os produtos</h1>
        <p className="mt-1.5 text-[13.5px] text-fg-tertiary">{products.length} produtos disponíveis</p>
      </div>

      <CollectionExplorer products={products} />
      </main>

      <Footer />
      <CartDrawer />
    </div>
  );
}
