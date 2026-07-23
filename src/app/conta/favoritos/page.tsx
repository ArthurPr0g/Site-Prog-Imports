import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { FavoriteCard } from '@/components/account/FavoriteCard';

export default async function FavoritesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/entrar?next=/conta');

  const supabase = await createClient();
  const { data } = await supabase
    .from('favorites')
    .select('product_id, products(id, sku, name, price, promo_price, categories(name), product_images(label, url, position))')
    .eq('customer_id', user.id);

  const items = (data ?? [])
    .map((f) => f.products)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => {
      const images = (p.product_images ?? []).sort((a, b) => a.position - b.position);
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.categories?.name ?? '',
        price: Number(p.promo_price ?? p.price),
        image: images[0]?.label ?? p.name.toLowerCase(),
        imageUrl: images.find((img) => img.url)?.url ?? null,
      };
    });

  return (
    <div>
      <h1 className="mb-6 font-display text-[26px] font-bold tracking-[-.02em]">Meus favoritos</h1>
      {items.length === 0 && (
        <div className="rounded-[20px] border border-border bg-card p-8 text-center text-sm text-fg-tertiary">
          Você ainda não favoritou nenhum produto.
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
        {items.map((it) => (
          <FavoriteCard key={it.id} productId={it.id} sku={it.sku} name={it.name} category={it.category} price={it.price} image={it.image} imageUrl={it.imageUrl} />
        ))}
      </div>
    </div>
  );
}
