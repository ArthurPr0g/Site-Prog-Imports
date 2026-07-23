-- Lista de destaques (bullets) editável por produto, exibida na página do produto.
alter table public.products
  add column if not exists highlights text[] not null default array[
    'Modelo exclusivo do mercado americano — não vendido no Brasil',
    'Garantia de 12 meses + suporte pós-venda Prog Imports',
    'Rastreamento completo da importação, etapa por etapa',
    'Frete grátis — envio segurado para todo o Brasil'
  ];
