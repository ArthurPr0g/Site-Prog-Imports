-- Gasto com IA somado no banco (28/10/2026). Somar linha por linha no código
-- parava em 1.000 linhas (limite da API do Supabase): com ~30 chamadas por
-- conversa, o teto do mês deixaria de valer depois de umas 33 conversas.
-- security_invoker: a visão respeita o RLS de quem consulta (admin ou a chave do atendente).

create or replace view public.ia_gasto_por_conversa with (security_invoker = true) as
select conversation_id, sum(cost_usd)::numeric(12, 4) as custo_usd, count(*)::int as chamadas
from public.ia_usage
where conversation_id is not null
group by conversation_id;

create or replace view public.ia_gasto_por_mes with (security_invoker = true) as
select date_trunc('month', created_at at time zone 'UTC') as mes, sum(cost_usd)::numeric(12, 4) as custo_usd, count(*)::int as chamadas
from public.ia_usage
group by 1;
