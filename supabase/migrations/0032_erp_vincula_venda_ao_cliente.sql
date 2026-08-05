-- Liga a venda ao cliente do ERP.
--
-- Até aqui `orders.customer_id` apontava para `profiles` (quem tem conta no
-- site) e os orçamentos/prestações para `customers` (o cadastro do ERP, que
-- inclui quem comprou pelo WhatsApp e nunca vai logar). Eram dois mundos, e por
-- isso a venda gerada de orçamento nascia sem vínculo nenhum.
--
-- Sem esta coluna não existe histórico do cliente: metade dos registros
-- apontaria para um lado e metade para o outro.
alter table public.orders
  add column if not exists erp_customer_id uuid references public.customers(id) on delete set null;

create index if not exists orders_erp_customer_idx on public.orders (erp_customer_id);

-- Backfill do que dá para deduzir: venda com conta do site cujo profile já está
-- vinculado a um cliente do ERP.
update public.orders o
set erp_customer_id = c.id
from public.customers c
where o.customer_id is not null
  and c.profile_id = o.customer_id
  and o.erp_customer_id is null;

comment on column public.orders.erp_customer_id is
  'Cliente do ERP (customers). Convive com customer_id, que aponta para profiles — quem tem conta no site.';

NOTIFY pgrst, 'reload schema';
