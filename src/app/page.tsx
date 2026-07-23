import { listActiveProducts, listCategories, listTopCollections, listFeedCollections } from '@/lib/data/catalog';
import { listBanners, listServices, listTestimonials, getSiteSettings } from '@/lib/data/content';
import { getCurrentUser } from '@/lib/auth';
import { PromoBar } from '@/components/layout/PromoBar';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { HeroCarousel } from '@/components/home/HeroCarousel';
import { AnimatedHeroBanners } from '@/components/home/hero-animated/AnimatedHeroBanners';
import { BrandsMarquee } from '@/components/home/BrandsMarquee';
import { Categories, type CategoryCard } from '@/components/home/Categories';
import { ProductGrid } from '@/components/home/ProductGrid';
import { CollectionRow } from '@/components/home/CollectionRow';
import { Institutional } from '@/components/home/Institutional';
import { Services } from '@/components/home/Services';
import { Testimonials } from '@/components/home/Testimonials';
import { Newsletter } from '@/components/home/Newsletter';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { categoria } = await searchParams;
  const [products, categories, topCollections, feedCollections, banners, services, testimonials, user, settings] = await Promise.all([
    listActiveProducts(),
    listCategories(),
    listTopCollections(),
    listFeedCollections(),
    listBanners(),
    listServices(),
    listTestimonials(),
    getCurrentUser(),
    getSiteSettings(),
  ]);

  const heroSlides = banners.map((b) => ({
    id: b.product_id ?? b.id,
    sku: b.products?.sku ?? '',
    tag: b.tag,
    title: b.title,
    subtitle: b.subtitle,
    price: b.products?.promo_price ? Number(b.products.promo_price) : Number(b.products?.price ?? 0),
    image: b.image_label,
  }));

  const searchIndex = products.map((p) => ({
    sku: p.sku,
    name: p.name,
    category: p.category,
    price: p.promoPrice ?? p.price,
  }));

  const productsForFilter = categoria
    ? products.filter((p) => p.category === categoria)
    : products;

  const feedSections = feedCollections
    .map((c) => ({ id: c.id, name: c.name, products: products.filter((p) => p.collections.includes(c.name)) }))
    .filter((c) => c.products.length > 0);
  const feedSectionIds = new Set(feedSections.map((c) => c.id));

  // "Serviços" não é uma coleção de verdade — é um atalho fixo para a seção de
  // serviços da página. Ainda assim, se o admin cadastrar uma categoria "Serviços"
  // (só para ter uma capa própria), usamos a foto dela aqui.
  const servicosCategory = categories.find((c) => c.name === 'Serviços');

  const collectionCards: CategoryCard[] = [
    ...topCollections.map((c) => ({
      name: c.name,
      glyph: c.name.slice(0, 2).toUpperCase(),
      imageUrl: c.image_url,
      count: `${products.filter((p) => p.collections.includes(c.name)).length} produtos`,
      // Se a coleção também aparece no feed abaixo, o card pula direto pra seção
      // dela; senão, abre a página dedicada com o grid completo e filtros.
      href: feedSectionIds.has(c.id) ? `/#colecao-${c.id}` : `/colecao/${c.id}`,
    })),
    {
      name: 'Serviços',
      glyph: servicosCategory?.glyph || 'SV',
      imageUrl: servicosCategory?.image_url ?? null,
      count: `${services.length} serviços`,
      href: '#servicos',
    },
  ];

  return (
    <div className="min-h-screen overflow-x-clip bg-page">
      <PromoBar />
      <Header searchIndex={searchIndex} user={user} />
      <AnimatedHeroBanners />
      {settings.showSmallBanners && <HeroCarousel slides={heroSlides} />}
      <BrandsMarquee />
      <Categories categories={collectionCards} />
      {categoria || feedSections.length === 0 ? (
        <ProductGrid products={productsForFilter} activeCategoria={categoria} />
      ) : (
        <div id="produtos">
          {feedSections.map((c) => (
            <CollectionRow key={c.id} id={`colecao-${c.id}`} title={c.name} products={c.products} />
          ))}
        </div>
      )}
      <Institutional />
      <Services services={services} />
      <Testimonials testimonials={testimonials} />
      <Newsletter />
      <Footer />
      <CartDrawer />
    </div>
  );
}
