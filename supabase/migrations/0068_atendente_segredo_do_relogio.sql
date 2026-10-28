-- Atendente: grava (ou troca) o segredo do relógio no Vault sem o valor passar
-- por SQL digitado à mão nem pelo git (2026-10-28).
--
-- Só a chave secreta do servidor (service_role) pode chamar. Uso:
--   node scripts/gravar-segredo-relogio.mjs   (lê ATENDENTE_TICK_SECRET do .env.local)
-- O mesmo valor tem de estar na Vercel como ATENDENTE_TICK_SECRET.

create or replace function public.atendente_gravar_segredo_do_relogio(p_valor text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_valor is null or length(p_valor) < 32 then
    raise exception 'Segredo curto demais (mínimo 32 caracteres).';
  end if;
  select id into v_id from vault.secrets where name = 'atendente_tick_secret';
  if v_id is null then
    perform vault.create_secret(p_valor, 'atendente_tick_secret', 'Relógio do atendente de IA (Bearer de /api/atendente/tick)');
  else
    perform vault.update_secret(v_id, p_valor);
  end if;
end;
$$;

revoke all on function public.atendente_gravar_segredo_do_relogio(text) from public, anon, authenticated;
grant execute on function public.atendente_gravar_segredo_do_relogio(text) to service_role;
