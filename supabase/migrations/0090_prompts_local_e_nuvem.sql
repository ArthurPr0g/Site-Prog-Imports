/*
 * 0090 — Prompts do Arthur executados sem ele mandar nada no chat (pedido de 29/10/2026).
 *
 * Três executores pegam da mesma fila (public.ideias, tipo 'prompt'):
 *   'local'  tarefa agendada do Windows no PC (a cada 10 min): faz tudo; também termina os 'parcial'.
 *            Cada rodada grava ideias_acesso.local_visto_em (a "pulsação" do PC).
 *   'nuvem'  rotina agendada na nuvem da Anthropic: só age quando o PC está sem pulsação há 20 min;
 *            faz o que dá pelo GitHub e, se faltar algo que só o PC faz, marca 'parcial' com o que falta.
 *   'chat'   o gancho UserPromptSubmit (sessão aberta no PC) continua pegando o que estiver na fila.
 * Pegar é atômico (update ... returning): o prompt vira 'em_execucao' com o executor, e ninguém mais pega.
 * Um 'em_execucao' parado há 3 h volta a ser pegável (executor caiu no meio).
 *
 *   status novos: 'em_execucao', 'parcial'.   colunas novas: executor, pego_em, falta.
 */
alter table public.ideias drop constraint if exists ideias_status_check;
alter table public.ideias add constraint ideias_status_check
  check (status in ('nova', 'andamento', 'feita', 'pendente', 'entregue', 'em_execucao', 'parcial', 'feito', 'arquivada'));
alter table public.ideias drop constraint if exists ideias_resultado_check;
alter table public.ideias add constraint ideias_resultado_check check (resultado is null or char_length(resultado) <= 12000);
alter table public.ideias add column if not exists executor text check (executor is null or executor in ('local', 'nuvem', 'chat'));
alter table public.ideias add column if not exists pego_em timestamptz;
alter table public.ideias add column if not exists falta text check (falta is null or char_length(falta) <= 8000);
alter table public.ideias_acesso add column if not exists local_visto_em timestamptz;

comment on column public.ideias.executor is 'Quem pegou o prompt por último: local (tarefa do PC), nuvem (rotina agendada) ou chat (gancho). 0090.';
comment on column public.ideias.falta is 'O que a nuvem não conseguiu fazer e ficou para o PC (status parcial). 0090.';
comment on column public.ideias_acesso.local_visto_em is 'Última rodada da tarefa agendada do PC: com menos de 20 min, a nuvem não pega prompts. 0090.';

/* Pega os prompts para um executor e já os marca como 'em_execucao'. */
create or replace function public.ideias_pegar(p_token text, p_executor text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  if p_token is null or not exists (select 1 from public.ideias_acesso a where a.token_claude = p_token) then
    return jsonb_build_object('ok', false, 'motivo', 'token_invalido');
  end if;
  if coalesce(p_executor, '') not in ('local', 'nuvem', 'chat') then
    return jsonb_build_object('ok', false, 'motivo', 'executor_invalido');
  end if;
  if p_executor = 'local' then
    update public.ideias_acesso set local_visto_em = now() where id;
  elsif p_executor = 'nuvem' and exists (select 1 from public.ideias_acesso a where a.local_visto_em > now() - interval '20 minutes') then
    return jsonb_build_object('ok', true, 'prompts', '[]'::jsonb, 'pc_ligado', true);
  end if;
  with p as (
    update public.ideias i set status = 'em_execucao', executor = p_executor, pego_em = now(), atualizado_em = now()
     where i.tipo = 'prompt'
       and (i.status = 'pendente'
            or (i.status = 'parcial' and p_executor in ('local', 'chat'))
            or (i.status = 'em_execucao' and i.pego_em < now() - interval '3 hours'))
    returning i.id, i.titulo, i.texto, i.origem, i.criado_em, i.falta, i.resultado
  )
  select coalesce(jsonb_agg(to_jsonb(p) order by p.criado_em), '[]'::jsonb) into v from p;
  return jsonb_build_object('ok', true, 'prompts', v, 'pc_ligado', p_executor <> 'nuvem');
end;
$$;

/* A nuvem fez uma parte: guarda o que fez e o que falta para o PC terminar. */
create or replace function public.ideia_prompt_parcial(p_token text, p_id uuid, p_resultado text, p_falta text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_token is null or not exists (select 1 from public.ideias_acesso a where a.token_claude = p_token) then
    return jsonb_build_object('ok', false, 'motivo', 'token_invalido');
  end if;
  update public.ideias
     set status = 'parcial',
         resultado = left(concat_ws(E'\n\n', resultado, nullif(btrim(coalesce(p_resultado, '')), '')), 12000),
         falta = left(btrim(coalesce(p_falta, '')), 8000),
         atualizado_em = now()
   where id = p_id and tipo = 'prompt';
  return jsonb_build_object('ok', found);
end;
$$;

/* Concluir passa a somar ao que já foi feito (a nuvem pode ter feito uma parte antes) e limpa o 'falta'. */
create or replace function public.ideia_prompt_concluir(p_token text, p_id uuid, p_resultado text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_token is null or not exists (select 1 from public.ideias_acesso a where a.token_claude = p_token) then
    return jsonb_build_object('ok', false, 'motivo', 'token_invalido');
  end if;
  update public.ideias
     set status = 'feito',
         resultado = left(concat_ws(E'\n\n', resultado, nullif(btrim(coalesce(p_resultado, '')), '')), 12000),
         falta = null,
         atualizado_em = now()
   where id = p_id and tipo = 'prompt';
  return jsonb_build_object('ok', found);
end;
$$;

/* O gancho do chat usa a mesma trava (executor 'chat'). Mantém o nome antigo para o script atual. */
create or replace function public.ideias_prompts_pendentes(p_token text)
returns jsonb language sql security definer set search_path = '' as $$
  select public.ideias_pegar(p_token, 'chat');
$$;

/* A página Ideias aceita os estados novos ao editar. */
create or replace function public.ideia_salvar(p_codigo text, p_id uuid, p_tipo text, p_texto text, p_status text, p_tags text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.ideias_acesso a where a.codigo_hub = upper(btrim(coalesce(p_codigo, '')))) then
    return jsonb_build_object('ok', false, 'motivo', 'codigo_invalido');
  end if;
  if coalesce(p_tipo, '') not in ('ideia', 'prompt') then return jsonb_build_object('ok', false, 'motivo', 'tipo_invalido'); end if;
  if char_length(btrim(coalesce(p_texto, ''))) not between 1 and 8000 then return jsonb_build_object('ok', false, 'motivo', 'texto_invalido'); end if;
  if coalesce(p_status, '') not in ('nova', 'andamento', 'feita', 'pendente', 'entregue', 'em_execucao', 'parcial', 'feito', 'arquivada') then
    return jsonb_build_object('ok', false, 'motivo', 'status_invalido'); end if;
  if p_id is null then
    insert into public.ideias (tipo, texto, origem, status, tags)
    values (p_tipo, btrim(p_texto), 'hub', p_status, coalesce(p_tags, '{}'))
    returning id into v_id;
  else
    update public.ideias set tipo = p_tipo, texto = btrim(p_texto), status = p_status, tags = coalesce(p_tags, '{}'),
           executor = case when p_status = 'pendente' then null else executor end, atualizado_em = now()
     where id = p_id returning id into v_id;
    if v_id is null then return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado'); end if;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke execute on function public.ideias_pegar(text, text) from public;
revoke execute on function public.ideia_prompt_parcial(text, uuid, text, text) from public;
grant execute on function public.ideias_pegar(text, text) to anon, authenticated;
grant execute on function public.ideia_prompt_parcial(text, uuid, text, text) to anon, authenticated;
