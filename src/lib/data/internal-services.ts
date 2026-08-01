import { createClient } from '@/lib/supabase/server';
import type { InternalService } from '@/lib/services';

type Row = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  lead_time_days: number;
  active: boolean;
  position: number;
};

function toService(r: Row): InternalService {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    price: Number(r.price),
    leadTimeDays: r.lead_time_days,
    active: r.active,
    position: r.position,
  };
}

export async function listInternalServices(): Promise<InternalService[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('internal_services')
    .select('*')
    .order('position', { ascending: true })
    .order('name', { ascending: true });
  return (data ?? []).map((r) => toService(r as Row));
}
