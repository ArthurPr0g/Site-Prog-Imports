-- Fecha site_settings e coupons para visitantes (2026-10-15).
--
-- As duas tabelas tinham SELECT liberado para qualquer um (`using (true)`).
-- Com a chave pública, um visitante lia de site_settings o CPF/CNPJ do
-- contratado, documento, telefone e endereço do remetente e o caminho da
-- assinatura — exatamente o que a migração 0036 tirou do repositório para não
-- expor. De coupons, lia todos os códigos de desconto.
--
-- O que a loja pública precisa continua acessível por função, e só isso:
-- - a home lê `show_small_banners` (banners pequenos ligados ou não);
-- - o carrinho valida UM código e recebe só o percentual.
-- Políticas alteradas com ALTER POLICY (sem drop): o nome muda para refletir
-- que agora é leitura de admin.

create or replace function public.vitrine_settings()
returns table (show_small_banners boolean)
language sql
stable
security definer
set search_path = ''
as $$ select s.show_small_banners from public.site_settings s limit 1 $$;

revoke execute on function public.vitrine_settings() from public;
grant execute on function public.vitrine_settings() to anon, authenticated;

-- Devolve o percentual se o cupom existe e está ativo; nulo caso contrário.
-- Quem chama precisa já saber o código: a lista de cupons não sai daqui.
create or replace function public.validar_cupom(p_codigo text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select c.pct from public.coupons c
  where c.code = upper(trim(p_codigo)) and c.active
  limit 1
$$;

revoke execute on function public.validar_cupom(text) from public;
grant execute on function public.validar_cupom(text) to anon, authenticated;

alter policy site_settings_public_read on public.site_settings using (public.is_admin());
alter policy site_settings_public_read on public.site_settings rename to site_settings_admin_read;

alter policy coupons_public_read on public.coupons using (public.is_admin());
alter policy coupons_public_read on public.coupons rename to coupons_admin_read;
