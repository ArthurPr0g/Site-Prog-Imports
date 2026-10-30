/*
 * 0101 — Ajustes pedidos pelo cliente à Lia (ideia do Arthur, 30/10/2026): "o cliente pede pequenos ajustes no
 * projeto dele (print ou explicação); a Lia entende e, se for fácil e sem dúvida, já faz no projeto daquele
 * cliente. Cada cliente só pode pedir ajustes no próprio projeto."
 *
 *  projetos.pasta / site_url: onde está o código do projeto do cliente e o endereço publicado.
 *  ideias: pedido vindo do cliente (origem 'cliente'), com a conversa e a rodada para avisar e fechar,
 *  e pasta_exclusiva — o executor roda o Claude Code SÓ nessa pasta, sem acesso às demais.
 *  ideias_pegar passa a devolver pasta_exclusiva, conversation_id e rodada_id.
 */
alter table public.projetos add column if not exists pasta text check (pasta is null or char_length(pasta) <= 500);
alter table public.projetos add column if not exists site_url text check (site_url is null or char_length(site_url) <= 500);

alter table public.ideias add column if not exists conversation_id uuid references public.ia_conversations (id) on delete set null;
alter table public.ideias add column if not exists rodada_id uuid references public.rodadas (id) on delete set null;
alter table public.ideias add column if not exists pasta_exclusiva text check (pasta_exclusiva is null or char_length(pasta_exclusiva) <= 500);
alter table public.ideias drop constraint if exists ideias_origem_check;
alter table public.ideias add constraint ideias_origem_check check (origem in ('whatsapp', 'whatsapp_audio', 'hub', 'cliente'));

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
       and (i.status = 'pendente'
            or (i.status = 'parcial' and p_executor in ('local', 'chat'))
            or (i.status = 'em_execucao' and i.pego_em < now() - interval '3 hours'))
    returning i.id, i.titulo, i.texto, i.origem, i.criado_em, i.falta, i.resultado, i.pasta_exclusiva, i.conversation_id, i.rodada_id
  )
  select coalesce(jsonb_agg(to_jsonb(p) order by p.criado_em), '[]'::jsonb) into v from p;
  return jsonb_build_object('ok', true, 'prompts', v, 'pc_ligado', p_executor <> 'nuvem');
end;
$function$;
