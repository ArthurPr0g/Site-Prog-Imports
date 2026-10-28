-- Captação: porte estimado do cliente (2026-10-27).
--
-- Pedido do dono: julgar o tamanho do cliente. Pequena empresa recebe os
-- pacotes básicos (ou intermediário); média e grande, os maiores e mais
-- completos. Rede ou franquia nacional perde prioridade (site e sistema vêm da
-- marca). Regra em src/lib/captacao.ts (estimarPorte); a base inteira é
-- reavaliada por scripts/captacao/reavaliar-base.ts.

alter table public.leads
  add column if not exists porte text check (porte in ('pequena', 'media', 'grande')),
  -- Unidades da mesma marca na mesma cidade (contadas na base).
  add column if not exists unidades integer not null default 1;

-- Ficha do vendedor: + porte e unidades.
create or replace function public.lead_kit(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'seller_name', k.seller_name,
    'seller_whatsapp', k.seller_whatsapp,
    'seller_email', k.seller_email,
    'instructions', k.instructions,
    'catalog', k.catalog,
    'more_requested_at', k.more_requested_at,
    'created_at', k.created_at,
    'templates', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'channel', t.channel, 'lang', t.lang, 'step', t.step, 'variant', t.variant, 'subject', t.subject, 'body', t.body
      )), '[]') from public.lead_templates t
    ),
    'leads', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'public_token', l.public_token, 'name', l.name, 'category', l.category, 'niche', l.niche,
        'city', l.city, 'state', l.state, 'country', l.country, 'address', l.address, 'phone', l.phone,
        'sem_whatsapp', l.sem_whatsapp, 'email', l.email, 'website', l.website, 'site_check', l.site_check,
        'instagram', l.instagram, 'facebook', l.facebook, 'maps_url', l.maps_url, 'rating', l.rating,
        'review_count', l.review_count, 'score', l.score, 'reasons', l.reasons,
        'suggested_services', l.suggested_services, 'status', l.status, 'notes', l.notes,
        'first_contact_at', l.first_contact_at, 'followup_step', l.followup_step, 'ab_variant', l.ab_variant,
        'diag_views', l.diag_views, 'diag_last_view_at', l.diag_last_view_at, 'screenshot_url', l.screenshot_url,
        'discovery', l.discovery, 'discovery_at', l.discovery_at,
        'maps_status', l.maps_status, 'last_review_at', l.last_review_at, 'owner_claimed', l.owner_claimed,
        'opening_hours', l.opening_hours, 'attributes', l.attributes, 'online_booking', l.online_booking,
        'rating_dist', l.rating_dist, 'recent_reviews', l.recent_reviews,
        'porte', l.porte, 'unidades', l.unidades,
        'regiao', (
          select jsonb_build_object(
            'total', count(*),
            'com_site', count(*) filter (
              where c.website is not null
                and c.website !~* '(instagram|facebook|fb\.(com|me)|wa\.me|whatsapp|linktr\.ee|linkin\.bio|beacons\.ai|business\.site|negocio\.site|sites\.google|apointoo|calendly|booksy|doctoralia|ifood)'
                and coalesce(c.site_check, '') not like '%fora%'
                and coalesce(c.site_check, '') not like '%parado%'
            ),
            'nota_media', round(avg(c.rating), 1),
            'avaliacoes_media', round(avg(c.review_count))
          )
          from public.leads c
          where c.id <> l.id and c.country = l.country
            and c.city is not distinct from l.city and c.niche is not distinct from l.niche
        ),
        'currency', i.currency, 'one_time', i.one_time, 'monthly', i.monthly, 'combo', i.combo, 'services', i.services
      ) order by i.position), '[]')
      from public.lead_kit_items i join public.leads l on l.id = i.lead_id
      where i.kit_id = k.id
    )
  )
  from public.lead_seller_kits k
  where k.token = p_token and k.active;
$$;

revoke all on function public.lead_kit(uuid) from public;
grant execute on function public.lead_kit(uuid) to anon, authenticated;
