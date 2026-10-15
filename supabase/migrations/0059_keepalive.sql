-- Ping diário do GitHub Actions (.github/workflows/supabase-keepalive.yml).
--
-- O plano grátis da Supabase pausa o projeto sem atividade de banco na última
-- semana. A função só devolve a hora: chamá-la executa SQL de verdade (conta
-- como atividade) sem login, sem senha guardada em lugar nenhum e sem expor
-- dado algum.
create or replace function public.keepalive()
returns timestamptz
language sql
stable
set search_path = ''
as $$ select now() $$;

revoke execute on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
