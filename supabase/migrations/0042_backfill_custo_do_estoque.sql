-- Move o custo dos itens de estoque que já existem para a data da compra.
--
-- Sem este backfill a mudança tiraria despesa do caixa sem repor: a venda de um
-- item de estoque deixa de lançar custo (agora quem lança é a entrada), mas os
-- itens cadastrados antes desta migração nunca geraram despesa nenhuma. O
-- resultado seria lucro inflado, em silêncio — o pior tipo de erro contábil.

-- 1. Cada item de estoque com valor pago vira uma despesa, na data de entrada.
insert into public.finance_entries (kind, description, amount, entry_date, status, source, reference_id)
select
  'despesa',
  'Compra de estoque: ' || s.name,
  s.paid_amount,
  coalesce(s.entry_date, s.purchase_date, s.created_at::date),
  'Pago',
  'estoque',
  s.id
from public.stock_items s
where s.paid_amount > 0
  and not exists (
    select 1 from public.finance_entries f
    where f.source = 'estoque' and f.reference_id = s.id
  );

-- 2. A despesa da venda passa a cobrir só o que NÃO veio do estoque. Zerou,
--    a linha sai; sobrou algo (venda mista, com item de estoque e encomenda),
--    o valor é corrigido.
with custo_fora_do_estoque as (
  select o.id as order_id,
         coalesce(sum(case when oi.stock_item_id is null then oi.unit_cost * oi.qty else 0 end), 0) as custo
  from public.orders o
  left join public.order_items oi on oi.order_id = o.id
  group by o.id
)
delete from public.finance_entries f
using custo_fora_do_estoque c
where f.source = 'venda'
  and f.kind = 'despesa'
  and f.reference_id = c.order_id
  and c.custo <= 0;

with custo_fora_do_estoque as (
  select o.id as order_id,
         coalesce(sum(case when oi.stock_item_id is null then oi.unit_cost * oi.qty else 0 end), 0) as custo
  from public.orders o
  left join public.order_items oi on oi.order_id = o.id
  group by o.id
)
update public.finance_entries f
set amount = c.custo, updated_at = now()
from custo_fora_do_estoque c
where f.source = 'venda'
  and f.kind = 'despesa'
  and f.reference_id = c.order_id
  and c.custo > 0
  and f.amount <> c.custo;
