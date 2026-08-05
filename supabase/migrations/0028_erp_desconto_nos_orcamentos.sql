-- Desconto nos orçamentos, em porcentagem ou em reais, com o motivo que sai no
-- PDF ao lado da linha.

-- LOJA: incide sobre o preço de venda, então derruba lucro e margem — que é
-- justamente o que o dono precisa ver antes de conceder. O custo com o
-- fornecedor não muda; o desconto sai do bolso da Prog.
alter table public.store_quotes
  add column if not exists discount_type text not null default 'valor'
    check (discount_type in ('percentual', 'valor'));
alter table public.store_quotes
  add column if not exists discount_value numeric(12,2) not null default 0
    check (discount_value >= 0);
alter table public.store_quotes
  add column if not exists discount_note text not null default '';

comment on column public.store_quotes.discount_value is
  'Em discount_type=percentual, de 0 a 100. Em valor, reais. O limite real é aplicado no cálculo.';

-- SERVIÇOS: incide sobre o valor único (o trabalho). A mensalidade não entra:
-- ela é preço de tabela recorrente, e descontá-la mudaria o contrato mensal
-- inteiro. Para dar desconto na mensalidade, o valor do próprio item já é
-- editável na proposta.
alter table public.service_quotes
  add column if not exists discount_type text not null default 'valor'
    check (discount_type in ('percentual', 'valor'));
alter table public.service_quotes
  add column if not exists discount_value numeric(12,2) not null default 0
    check (discount_value >= 0);
alter table public.service_quotes
  add column if not exists discount_note text not null default '';

-- A PRESTAÇÃO também guarda o desconto, herdado do orçamento na conversão.
--
-- Sem isto o desconto se perderia: `total_amount` da prestação é recalculado a
-- partir dos itens a cada salvamento, e os itens vêm com o valor cheio. Editar
-- a prestação depois devolveria o preço sem desconto, e o Financeiro passaria a
-- esperar mais dinheiro do que foi combinado com o cliente.
alter table public.service_orders
  add column if not exists discount_type text not null default 'valor'
    check (discount_type in ('percentual', 'valor'));
alter table public.service_orders
  add column if not exists discount_value numeric(12,2) not null default 0
    check (discount_value >= 0);
alter table public.service_orders
  add column if not exists discount_note text not null default '';

comment on column public.service_orders.discount_value is
  'Incide sobre total_amount (o trabalho), nunca sobre monthly_amount.';

NOTIFY pgrst, 'reload schema';
