-- Créditos do ElevenLabs e armazenamento do Supabase (pedido do Arthur, 31/10/2026). Só acréscimos.
--
-- 1. ia_config.elevenlabs: estado da voz por ciclo do plano (avisos de 80% e 95% já mandados e se a voz dos
--    clientes está no modelo econômico). Ex.: {"ciclo": "2026-11-30", "avisos": {"80": iso, "95": iso},
--    "economico": true, "lido": {...}}.
-- 2. ia_config.armazenamento_avisos: aviso de 80% do 1 GB grátis, um por mês: {"2026-10": {"80": iso}}.
-- 3. uso_do_armazenamento(): soma do tamanho dos objetos por bucket e o tamanho do banco. Só a chave do
--    servidor executa (o painel chama depois de conferir o admin).
-- 4. objetos_para_arquivar(dias): áudios de reunião e prints de ajuste mais velhos que N dias, para o script do
--    PC baixar para a pasta do cliente (OneDrive) e apagar do Storage.
-- 5. arquivos_arquivados: o que saiu do Storage e onde ficou no PC (a tela mostra "arquivado no OneDrive").

alter table public.ia_config add column if not exists elevenlabs jsonb not null default '{}'::jsonb;
alter table public.ia_config add column if not exists armazenamento_avisos jsonb not null default '{}'::jsonb;

create or replace function public.uso_do_armazenamento()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'banco', pg_catalog.pg_database_size(pg_catalog.current_database()),
    'buckets', coalesce((
      select jsonb_agg(jsonb_build_object('bucket', b.id, 'objetos', coalesce(o.n, 0), 'bytes', coalesce(o.bytes, 0)) order by coalesce(o.bytes, 0) desc)
        from storage.buckets b
        left join (
          select bucket_id, count(*) as n, sum(coalesce((metadata ->> 'size')::bigint, 0)) as bytes
            from storage.objects
           group by bucket_id
        ) o on o.bucket_id = b.id
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.uso_do_armazenamento() from public, anon, authenticated;
grant execute on function public.uso_do_armazenamento() to service_role;

create or replace function public.objetos_para_arquivar(p_dias integer default 60)
returns table (bucket text, caminho text, bytes bigint, criado_em timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select o.bucket_id, o.name, coalesce((o.metadata ->> 'size')::bigint, 0), o.created_at
    from storage.objects o
   where o.created_at < now() - make_interval(days => greatest(p_dias, 0))
     and (o.bucket_id = 'reunioes' or (o.bucket_id = 'clientes' and o.name like 'ajustes/%'))
   order by o.created_at
   limit 500;
$$;
revoke all on function public.objetos_para_arquivar(integer) from public, anon, authenticated;
grant execute on function public.objetos_para_arquivar(integer) to service_role;

create table if not exists public.arquivos_arquivados (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  caminho text not null,
  cliente text,
  local_path text not null check (char_length(local_path) <= 600),
  onedrive_path text check (onedrive_path is null or char_length(onedrive_path) <= 600),
  bytes bigint not null default 0,
  reuniao_id uuid references public.reunioes (id) on delete set null,
  arquivado_em timestamptz not null default now(),
  unique (bucket, caminho)
);
create index if not exists arquivos_arquivados_reuniao_idx on public.arquivos_arquivados (reuniao_id);
alter table public.arquivos_arquivados enable row level security;
-- Só a chave do servidor lê e grava (o painel lê pelo servidor, depois de conferir o admin).
revoke all on public.arquivos_arquivados from anon, authenticated;
comment on table public.arquivos_arquivados is 'Arquivos que o PC do Arthur baixou para a pasta do cliente (OneDrive) e apagou do Storage. 0116.';
