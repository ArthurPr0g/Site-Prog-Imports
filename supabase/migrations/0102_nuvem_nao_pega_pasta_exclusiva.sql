/*
 * 0102 — Ajuste pedido pelo cliente (pasta exclusiva no PC do Arthur) só o executor local pega; a nuvem e o
 * chat ficam com os demais pedidos. Mesmo corpo da 0101, com a condição a mais.
 */
create or replace function public.ideias_pegar(p_token text, p_executor text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
       -- Ajuste de cliente (pasta exclusiva no PC) só o executor local faz (0102).
       and (p_executor = 'local' or i.pasta_exclusiva is null)
       and (i.status = 'pendente'
            or (i.status = 'parcial' and p_executor in ('local', 'chat'))
            or (i.status = 'em_execucao' and i.pego_em < now() - interval '3 hours'))
    returning i.id, i.titulo, i.texto, i.origem, i.criado_em, i.falta, i.resultado, i.pasta_exclusiva, i.conversation_id, i.rodada_id
  )
  select coalesce(jsonb_agg(to_jsonb(p) order by p.criado_em), '[]'::jsonb) into v from p;
  return jsonb_build_object('ok', true, 'prompts', v, 'pc_ligado', p_executor <> 'nuvem');
end;
$function$;
