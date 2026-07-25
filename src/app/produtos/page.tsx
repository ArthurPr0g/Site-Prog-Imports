import Link from 'next/link';
import { listActiveProducts } from '@/lib/data/catalog';
import { getCurrentUser } from '@/lib/auth';
import { PromoBar } from '@/components/layout/PromoBar';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { CollectionExplorer } from '@/components/collection/CollectionExplorer';

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

      <div className="mx-auto max-w-[1280px] px-6 pt-6 text-[13px] text-fg-tertiary">
        <Link href="/" className="text-fg-tertiary">
          Home
        </Link>{' '}
        / <span className="text-fg">Todos os produtos</span>
      </div>

      <div className="mx-auto max-w-[1280px] px-6 pt-4">
        <h1 className="font-display text-[30px] font-bold tracking-[-.02em] sm:text-[36px]">Todos os produtos</h1>
        <p className="mt-1.5 text-[13.5px] text-fg-tertiary">{products.length} produtos disponíveis</p>
      </div>

      <CollectionExplorer products={products} />

      <Footer />
      <CartDrawer />
    </div>
  );
}
