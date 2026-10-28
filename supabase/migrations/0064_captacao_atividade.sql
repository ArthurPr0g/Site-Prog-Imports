-- Captação: sinais de atividade (anti "empresa fantasma") e mais dados do
-- negócio para o vendedor (2026-10-27).
--
-- Pedido do dono: não mandar o time de vendas atrás de empresa que fechou ou
-- que não tem movimento, e dar ao vendedor conhecimento do negócio do cliente.
--
-- Origem: colunas calculadas pelo google-maps-scraper-kit (scripts/scrape.py,
-- função derive) a partir do que o Google Maps mostra: status, avaliações com
-- data, dono do perfil, horário, atributos e agendamento online.
-- Leads importados antes desta data ficam com essas colunas vazias até a
-- próxima busca (reimportar atualiza os dados públicos e a nota).

alter table public.leads
  -- "Permanently closed", "Temporarily closed"... (vazio = aberto)
  add column if not exists maps_status text,
  -- Data da avaliação mais recente entre as que o Google mostrou.
  add column if not exists last_review_at date,
  -- O dono reivindicou o perfil no Google (sinal de negócio ativo).
  add column if not exists owner_claimed boolean,
  -- {"Monday": ["8:00–18:00"], ...}
  add column if not exists opening_hours jsonb,
  -- Comodidades, acessibilidade, pagamentos... (opções marcadas no Google)
  add column if not exists attributes text[],
  -- Ferramenta de agendamento/pedido online ligada ao perfil (ex.: agenda.link).
  add column if not exists online_booking text,
  -- Quantas avaliações por nota: {"1": 3, ..., "5": 120}
  add column if not exists rating_dist jsonb,
  -- Até 3 avaliações recentes: [{"n": 5, "d": "2026-09-30", "t": "..."}]
  add column if not exists recent_reviews jsonb;

-- E-mails capturados por engano viram vazio: modelo de site (info@example.com),
-- endereço técnico (sentry, wixpress), de plataforma (linktr.ee, doctoralia)
-- e nome de arquivo de imagem (nuvempago@2x.png). Mesma regra do kit e de
-- src/lib/captacao.ts (EMAIL_LIXO).
update public.leads
set email = null, updated_at = now()
where email ~* '@([a-z0-9-]+\.)*(example|exemplo|sentry|wixpress|yourdomain|seudominio|seusite|suaempresa|linktr\.ee|doctoralia|domain\.com|dominio\.com|email\.com$|mail\.com$)'
   or email ~* '\.(png|jpe?g|gif|webp|svg)$'
   or email ~* '^(name|email|user|you|someone|seuemail|seu-email|seunome|nome|seu|voce|você|exemplo|johndoe|john\.doe)@';

-- "%20" (espaço codificado) grudado no começo do e-mail.
update public.leads
set email = regexp_replace(email, '^(%20|\s)+', ''), updated_at = now()
where email ~ '^(%20|\s)';

-- Ficha do vendedor: os campos novos e a comparação com a região (mesmo
-- país, cidade e ramo), igual ao diagnóstico.
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
