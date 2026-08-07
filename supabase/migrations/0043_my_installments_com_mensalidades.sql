-- O cliente passa a ver as mensalidades do plano na conta dele.
--
-- `my_installments()` lia só `payment_installments`, e a mensalidade do plano
-- não mora lá: o plano nasce direto no Financeiro, uma linha por mês, e é lá
-- que o dono baixa. Resultado: quem tinha contrato de 12 × R$ 149 via o farol
-- dizer que não devia nada de hospedagem.
--
-- O corte em 1000 (`OFFSET_PARCELA_PIX`) separa as duas coisas que dividem a
-- coluna `installment_number`: abaixo dele são mensalidades do plano; acima, o
-- carnê do PIX parcelado, que já vem pela primeira metade da consulta.
drop function if exists public.my_installments();

create function public.my_installments()
returns table (
  id uuid,
  source_type text,
  number integer,
  amount numeric,
  due_date date,
  status text,
  paid_at date,
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
    p.paid_at,
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

  union all

  select
    f.id,
    'plano'::text as source_type,
    f.installment_number as number,
    f.amount,
    f.entry_date as due_date,
    case when f.status = 'Pago' then 'Recebida' else 'Pendente' end as status,
    case when f.status = 'Pago' then f.entry_date else null end as paid_at,
    'Plano: ' || s.title as origem
  from public.finance_entries f
  join public.service_orders s on s.id = f.reference_id
  where auth.uid() is not null
    and f.source = 'servico'
    and f.installment_number is not null
    and f.installment_number < 1000
    and s.status <> 'Cancelada'
    and s.customer_id in (
      select c.id from public.customers c where c.profile_id = auth.uid()
    )

  order by 5, 3;
$$;

comment on function public.my_installments() is
  'Carne do usuario logado: parcelas de venda/servico mais as mensalidades do plano, que vivem no Financeiro. Security definer.';

revoke execute on function public.my_installments() from public, anon;
grant execute on function public.my_installments() to authenticated;

NOTIFY pgrst, 'reload schema';
