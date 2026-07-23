import { listActiveProducts, listCategories } from '@/lib/data/catalog';
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
  const [products, categories, banners, services, testimonials, user, settings] = await Promise.all([
    listActiveProducts(),
    listCategories(),
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

  const productCountByCategory = products.reduce<Record<string, number>>((acc, p) => {
    acc[p.category] = (acc[p.category] ?? 0) + 1;
    return acc;
  }, {});

  // "Serviços" não é uma categoria de produto de verdade — é um atalho fixo para a
  // seção de serviços da página. Ainda assim, se o admin cadastrar uma categoria
  // "Serviços" (só para ter uma capa própria), usamos a foto dela aqui em vez de
  // deixá-la virar mais um filtro de produtos (que sempre daria 0 resultados).
  const servicosCategory = categories.find((c) => c.name === 'Serviços');
  const productCategories = categories.filter((c) => c.name !== 'Serviços');

  const categoryCards: CategoryCard[] = [
    ...productCategories.map((c) => ({
      name: c.name,
      glyph: c.glyph,
      imageUrl: c.image_url,
      count: `${productCountByCategory[c.name] ?? 0} produtos`,
      href: `/?categoria=${encodeURIComponent(c.name)}#produtos`,
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
      <Categories categories={categoryCards} />
      <ProductGrid products={productsForFilter} activeCategoria={categoria} />
      <Institutional />
      <Services services={services} />
      <Testimonials testimonials={testimonials} />
      <Newsletter />
      <Footer />
      <CartDrawer />
    </div>
  );
}
