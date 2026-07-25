-- Suporte para o assistente flutuante com IA (Claude): guarda um contador de
-- uso por "chave" (IP do visitante) numa janela deslizante, para limitar
-- quantas mensagens cada pessoa pode mandar por hora sem depender de estado
-- em memória do servidor (que não é confiável em ambiente serverless).
create table if not exists public.assistant_rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count int not null default 0
);

alter table public.assistant_rate_limits enable row level security;
-- Sem policies: só acessível via a função abaixo (security definer),
-- nunca diretamente pelo client anon/authenticated.

-- Incrementa o contador de forma atômica (o UPSERT garante o lock de linha)
-- e reinicia a janela quando ela expira. Retorna true se a requisição pode
-- prosseguir, false se estourou o limite.
create or replace function public.check_assistant_rate_limit(
  p_key text,
  p_window_seconds int,
  p_limit int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.assistant_rate_limits (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set count = case
        when public.assistant_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
          then 1
        else public.assistant_rate_limits.count + 1
      end,
      window_start = case
        when public.assistant_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
          then now()
        else public.assistant_rate_limits.window_start
      end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

grant execute on function public.check_assistant_rate_limit(text, int, int) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
