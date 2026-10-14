-- Empresa / projeto do cliente (TecnoPallet, DW Sports, VitaliTI...).
--
-- O cliente é cadastrado pela pessoa ("Wellington Cunha Bastos Filho"), mas no
-- caixa o dono pensa pelo negócio: "a parcela da TecnoPallet atrasou". Sem este
-- campo, o Painel e o Financeiro mostravam só o nome do serviço, que se repete
-- entre clientes ("Site Institucional + ERP Leve").
alter table public.customers add column if not exists company text;

comment on column public.customers.company is
  'Empresa ou projeto do cliente, como aparece no Painel antes de cada cobrança. Opcional.';
