import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AddressForm } from '@/components/account/AddressForm';

export default async function AddressPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: address } = await supabase.from('addresses').select('*').eq('customer_id', user.id).maybeSingle();

  return (
    <div>
      <h1 className="mb-6 font-display text-[26px] font-bold tracking-[-.02em]">Endereço de entrega</h1>
      <AddressForm address={address} />
    </div>
  );
}
