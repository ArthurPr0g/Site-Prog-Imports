-- Gasto por agente (pedido do Arthur, 30/10/2026): cada execução do Claude Code (PC) grava o custo que o
-- `claude -p --output-format json` informa (total_cost_usd) e os tokens. No PC o Claude roda pela assinatura,
-- então esse valor é o EQUIVALENTE em preço de API (não é cobrado à parte); a Lia continua em ia_usage (API real).
alter table public.ideias add column if not exists custo_usd numeric(12, 6);
alter table public.ideias add column if not exists tokens_entrada bigint;
alter table public.ideias add column if not exists tokens_saida bigint;
alter table public.ideias add column if not exists duracao_ms bigint;

/* O executor manda o custo depois de concluir. Soma, porque um pedido pode rodar em duas partes (nuvem + PC). */
create or replace function public.ideia_prompt_custo(p_token text, p_id uuid, p_custo_usd numeric, p_tokens_entrada bigint, p_tokens_saida bigint, p_duracao_ms bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_token is null or not exists (select 1 from public.ideias_acesso a where a.token_claude = p_token) then
    return jsonb_build_object('ok', false, 'motivo', 'token_invalido');
  end if;
  update public.ideias
     set custo_usd = coalesce(custo_usd, 0) + greatest(coalesce(p_custo_usd, 0), 0),
         tokens_entrada = coalesce(tokens_entrada, 0) + greatest(coalesce(p_tokens_entrada, 0), 0),
         tokens_saida = coalesce(tokens_saida, 0) + greatest(coalesce(p_tokens_saida, 0), 0),
         duracao_ms = coalesce(duracao_ms, 0) + greatest(coalesce(p_duracao_ms, 0), 0)
   where id = p_id and tipo = 'prompt';
  return jsonb_build_object('ok', found);
end;
$$;
revoke execute on function public.ideia_prompt_custo(text, uuid, numeric, bigint, bigint, bigint) from public;
grant execute on function public.ideia_prompt_custo(text, uuid, numeric, bigint, bigint, bigint) to anon, authenticated;
