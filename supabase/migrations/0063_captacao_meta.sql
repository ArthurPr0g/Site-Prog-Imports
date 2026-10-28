-- Meta da Captação na página do vendedor (2026-10-27).
--
-- Pedido do dono: o vendedor acompanha, quase em tempo real, o dinheiro na
-- mesa (todos os leads em aberto), o realizado e a meta de R$ 100 mil em 6
-- meses, com os mesmos números do painel.
--
-- A conta (preços, combo, rampa da meta, projeção) fica no TypeScript
-- (src/lib/meta-captacao.ts), igual à do painel. Esta função só entrega o
-- mínimo para ela: etapa, país, serviços sugeridos e datas de cada lead, sem
-- nome, telefone, e-mail ou endereço. Só com link de vendedor ativo.

create or replace function public.lead_kit_meta(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'leads', (
      select coalesce(jsonb_agg(jsonb_build_object(
        's', l.status, 'c', l.country, 'sv', l.suggested_services,
        'fc', l.first_contact_at, 'ra', l.replied_at, 'ca', l.closed_at
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
$$;

revoke all on function public.lead_kit_meta(uuid) from public;
grant execute on function public.lead_kit_meta(uuid) to anon, authenticated;
