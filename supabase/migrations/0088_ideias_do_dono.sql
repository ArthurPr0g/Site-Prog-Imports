/*
 * 0088 — Ideias e prompts do Arthur pelo WhatsApp da Lia (pedido de 29/10/2026).
 *
 * O Arthur manda texto ou áudio do número dele (ia_config.owner_whatsapp) para o número da Lia:
 *   - começa com "Claude" ou "prompt" → vira PROMPT para o Claude Code (fila: pendente → entregue → feito);
 *   - o resto (menos "relatório", que já tem resposta própria) → vira IDEIA.
 * O áudio é transcrito antes (lib/atendente/transcricao.ts, precisa de TRANSCRICAO_API_KEY).
 *
 * Quem lê:
 *   - a página Ideias do Hub pessoal (hub, estático) chama ideias_listar / ideia_salvar com o código
 *     de ideias_acesso.codigo_hub (guardado no navegador do Arthur);
 *   - o gancho do Claude Code (UserPromptSubmit) chama ideias_prompts_pendentes / ideia_prompt_concluir
 *     com ideias_acesso.token_claude (guardado só no PC, fora do repositório).
 * A tabela não tem política de RLS: ninguém lê direto pela API, só por essas funções.
 * Excluir pela página só arquiva.
 */

create table if not exists public.ideias (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'ideia' check (tipo in ('ideia', 'prompt')),
  texto text not null check (char_length(btrim(texto)) between 1 and 8000),
  origem text not null default 'whatsapp' check (origem in ('whatsapp', 'whatsapp_audio', 'hub')),
  status text not null default 'nova'
    check (status in ('nova', 'andamento', 'feita', 'pendente', 'entregue', 'feito', 'arquivada')),
  tags text[] not null default '{}',
  resultado text check (resultado is null or char_length(resultado) <= 4000),
  external_id text unique,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  entregue_em timestamptz
);
create index if not exists ideias_status_idx on public.ideias (tipo, status, criado_em desc);
comment on table public.ideias is 'Ideias e prompts que o Arthur manda pelo WhatsApp da Lia (texto ou áudio transcrito). Lidos pela página Ideias do Hub e pelo gancho do Claude Code. 0088.';

create table if not exists public.ideias_acesso (
  id boolean primary key default true check (id),
  codigo_hub text not null,
  token_claude text not null
);
insert into public.ideias_acesso (codigo_hub, token_claude)
values (upper(substr(md5(gen_random_uuid()::text), 1, 4) || '-' || substr(md5(gen_random_uuid()::text), 1, 4)),
        encode(gen_random_bytes(24), 'hex'))
on conflict (id) do nothing;
comment on table public.ideias_acesso is 'Código da página Ideias do Hub e token do gancho do Claude Code. 0088.';

alter table public.ideias enable row level security;
alter table public.ideias_acesso enable row level security;

create or replace function public.ideias_listar(p_codigo text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.ideias_acesso a where a.codigo_hub = upper(btrim(coalesce(p_codigo, '')))) then
    return jsonb_build_object('ok', false, 'motivo', 'codigo_invalido');
  end if;
  return jsonb_build_object('ok', true, 'ideias', coalesce((
    select jsonb_agg(to_jsonb(i) - 'external_id' order by i.criado_em desc)
      from public.ideias i where i.status <> 'arquivada'), '[]'::jsonb));
end;
$$;

/* Cria (p_id null) ou edita uma ideia/prompt pela página do Hub. p_status 'arquivada' = excluir. */
create or replace function public.ideia_salvar(p_codigo text, p_id uuid, p_tipo text, p_texto text, p_status text, p_tags text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.ideias_acesso a where a.codigo_hub = upper(btrim(coalesce(p_codigo, '')))) then
    return jsonb_build_object('ok', false, 'motivo', 'codigo_invalido');
  end if;
  if coalesce(p_tipo, '') not in ('ideia', 'prompt') then return jsonb_build_object('ok', false, 'motivo', 'tipo_invalido'); end if;
  if char_length(btrim(coalesce(p_texto, ''))) not between 1 and 8000 then return jsonb_build_object('ok', false, 'motivo', 'texto_invalido'); end if;
  if coalesce(p_status, '') not in ('nova', 'andamento', 'feita', 'pendente', 'entregue', 'feito', 'arquivada') then
    return jsonb_build_object('ok', false, 'motivo', 'status_invalido'); end if;
  if p_id is null then
    insert into public.ideias (tipo, texto, origem, status, tags)
    values (p_tipo, btrim(p_texto), 'hub', p_status, coalesce(p_tags, '{}'))
    returning id into v_id;
  else
    update public.ideias set tipo = p_tipo, texto = btrim(p_texto), status = p_status, tags = coalesce(p_tags, '{}'), atualizado_em = now()
     where id = p_id returning id into v_id;
    if v_id is null then return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado'); end if;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

/* Gancho do Claude Code: devolve os prompts pendentes e já os marca como entregues (não repete). */
create or replace function public.ideias_prompts_pendentes(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  if p_token is null or not exists (select 1 from public.ideias_acesso a where a.token_claude = p_token) then
    return jsonb_build_object('ok', false, 'motivo', 'token_invalido');
  end if;
  with p as (
    update public.ideias set status = 'entregue', entregue_em = now(), atualizado_em = now()
     where tipo = 'prompt' and status = 'pendente'
    returning id, texto, origem, criado_em
  )
  select coalesce(jsonb_agg(to_jsonb(p) order by p.criado_em), '[]'::jsonb) into v from p;
  return jsonb_build_object('ok', true, 'prompts', v);
end;
$$;

/* O Claude Code avisa que terminou um prompt (com um resumo curto do que fez). */
create or replace function public.ideia_prompt_concluir(p_token text, p_id uuid, p_resultado text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_token is null or not exists (select 1 from public.ideias_acesso a where a.token_claude = p_token) then
    return jsonb_build_object('ok', false, 'motivo', 'token_invalido');
  end if;
  update public.ideias set status = 'feito', resultado = left(btrim(coalesce(p_resultado, '')), 4000), atualizado_em = now()
   where id = p_id and tipo = 'prompt';
  return jsonb_build_object('ok', found);
end;
$$;

revoke execute on function public.ideias_listar(text) from public;
revoke execute on function public.ideia_salvar(text, uuid, text, text, text, text[]) from public;
revoke execute on function public.ideias_prompts_pendentes(text) from public;
revoke execute on function public.ideia_prompt_concluir(text, uuid, text) from public;
grant execute on function public.ideias_listar(text) to anon, authenticated;
grant execute on function public.ideia_salvar(text, uuid, text, text, text, text[]) to anon, authenticated;
grant execute on function public.ideias_prompts_pendentes(text) to anon, authenticated;
grant execute on function public.ideia_prompt_concluir(text, uuid, text) to anon, authenticated;
