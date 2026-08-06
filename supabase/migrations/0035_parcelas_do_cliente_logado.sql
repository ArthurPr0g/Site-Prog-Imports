-- O cliente passa a enxergar o próprio carnê na área da conta.
--
-- `payment_installments` é admin-only, e continua: a tabela guarda o carnê de
-- todo mundo, e uma policy de leitura ali seria uma superfície nova para errar.
-- Em vez disso, uma função `security definer` responde só o que é do usuário
-- logado — a mesma escolha já feita em `ready_stock_counts()`.
--
-- Por que uma função e não uma policy: a policy precisaria consultar `orders`,
-- `customers` e `service_orders`, e as três têm RLS própria. Subconsulta dentro
-- de policy respeita a RLS da tabela consultada, então a policy simplesmente não
-- veria nada e o cliente ficaria sem carnê, sem erro nenhum aparecendo.
--
-- O vínculo é buscado pelos DOIS lados: `orders.customer_id` (conta do site) e
-- `orders.erp_customer_id` (cadastro do ERP). Venda de PIX parcelado costuma
-- nascer no gerenciamento, ligada só ao segundo — checar apenas o primeiro
-- deixaria de fora justamente as vendas que têm carnê.
--
-- Fica de fora o que não é cobrança viva: parcela cancelada, venda cancelada e
-- prestação cancelada.
create or replace function public.my_installments()
returns table (
  id uuid,
  source_type text,
  number integer,
  amount numeric,
  due_date date,
  status text,
  origem text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.source_type,
    p.number,
    p.amount,
    p.due_date,
    p.status,
    case
      when p.source_type = 'venda' then 'Pedido #' || o.order_number::text
      else s.title
    end as origem
  from public.payment_installments p
  left join public.orders o
    on p.source_type = 'venda' and o.id = p.source_id
  left join public.service_orders s
    on p.source_type = 'servico' and s.id = p.source_id
  where auth.uid() is not null
    and p.status <> 'Cancelada'
    and (
      (
        p.source_type = 'venda'
        and o.status <> 'Cancelado'
        and (
          o.customer_id = auth.uid()
          or o.erp_customer_id in (
            select c.id from public.customers c where c.profile_id = auth.uid()
          )
        )
      )
      or (
        p.source_type = 'servico'
        and s.status <> 'Cancelada'
        and s.customer_id in (
          select c.id from public.customers c where c.profile_id = auth.uid()
        )
      )
    )
  order by p.due_date, p.number;
$$;

comment on function public.my_installments() is
  'Carnê do usuário logado (vendas e prestações, pelos dois vínculos de cliente). Security definer: payment_installments continua admin-only.';

-- Sem sessão não há o que devolver, então nem oferece a função ao anônimo.
revoke execute on function public.my_installments() from public, anon;
grant execute on function public.my_installments() to authenticated;

NOTIFY pgrst, 'reload schema';
