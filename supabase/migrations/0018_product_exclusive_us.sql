-- Exclusividade do produto no mercado americano, marcada por produto.
--
-- Antes o selo "EXCLUSIVO EUA" na página do produto vinha de uma heurística:
-- o nome conter "exclusiv" OU a categoria ser "Notebook Gamer". Na prática
-- isso marcava todo notebook gamer como exclusivo, inclusive modelos que o
-- Brasil também vende — uma afirmação comercial forte, inferida por adivinhação.
--
-- Padrão `false` de propósito: é melhor deixar de exibir o selo até alguém
-- confirmar do que continuar afirmando exclusividade onde ela não existe.
alter table public.products
  add column if not exists exclusive_us boolean not null default false;

comment on column public.products.exclusive_us is
  'Marcado no admin: produto não é vendido oficialmente no Brasil. Controla o selo EXCLUSIVO EUA.';

NOTIFY pgrst, 'reload schema';
