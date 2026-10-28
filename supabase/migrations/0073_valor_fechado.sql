-- Valor realmente negociado no fechamento (2026-10-28).
-- A meta somava a estimativa do pacote do diagnóstico; agora, quando o lead
-- fecha com valor conhecido (a Lia grava o da última proposta), a meta usa o
-- valor negociado. Sem valor gravado, continua a estimativa.
alter table public.leads
  add column if not exists closed_value numeric(12,2),
  add column if not exists closed_monthly numeric(12,2),
  add column if not exists closed_currency text check (closed_currency in ('BRL', 'USD'));

-- Meta do vendedor (página do link): mesma função, com os campos novos.
create or replace function public.lead_kit_meta(p_token uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'leads', (
      select coalesce(jsonb_agg(jsonb_build_object(
        's', l.status, 'c', l.country, 'sv', l.suggested_services,
        'fc', l.first_contact_at, 'ra', l.replied_at, 'ca', l.closed_at,
        'cv', l.closed_value, 'cm', l.closed_monthly, 'cc', l.closed_currency
      )), '[]')
      from public.leads l
    ),
    -- Preço por nome do catálogo ativo: base do valor dos leads do Brasil.
    'catalogo', (
      select coalesce(jsonb_agg(jsonb_build_array(s.name, s.price)), '[]')
      from public.internal_services s
      where s.active
    )
  )
  where exists (select 1 from public.lead_seller_kits k where k.token = p_token and k.active);
$function$;
