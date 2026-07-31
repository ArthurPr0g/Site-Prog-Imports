-- M1 do ERP: clientes desacoplados do login + parâmetros do sistema.
--
-- profiles existe e continua sendo "quem tem conta no site" (id referencia
-- auth.users). O ERP precisa de cliente que nunca vai logar: quem comprou pelo
-- WhatsApp, trouxe produto para troca ou contratou um serviço. Por isso uma
-- tabela própria, com vínculo OPCIONAL para profiles quando as duas coisas
-- forem a mesma pessoa.
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  doc text,                         -- CPF ou CNPJ
  cep text,
  address_line text,
  address_number text,
  complement text,
  district text,
  city text,
  state text,
  notes text,
  -- Preenchido quando o cliente do ERP e a conta do site são confirmadamente a
  -- mesma pessoa. Nulo é o caso normal (cliente que só existe no ERP).
  profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Um perfil do site não pode estar vinculado a dois clientes do ERP.
create unique index if not exists customers_profile_id_key
  on public.customers (profile_id) where profile_id is not null;

-- Busca por e-mail é o caminho da detecção de duplicata no cadastro do site.
create index if not exists customers_email_idx on public.customers (lower(email));
create index if not exists customers_name_idx on public.customers (lower(name));

alter table public.customers enable row level security;

-- Só o admin enxerga e mexe: são dados de terceiros (nome, CPF, endereço),
-- nada disso pode vazar para o cliente logado na loja.
drop policy if exists customers_admin_all on public.customers;
create policy customers_admin_all on public.customers
  for all using (public.is_admin()) with check (public.is_admin());

-- Os perfis que já existem viram clientes do ERP, já vinculados.
insert into public.customers (name, email, phone, profile_id)
select coalesce(nullif(p.name, ''), p.email, 'Sem nome'), p.email, p.phone, p.id
from public.profiles p
where not exists (select 1 from public.customers c where c.profile_id = p.id);

-- Parâmetros do sistema. site_settings já existe com uma linha única
-- (id boolean), então os campos novos entram nela em vez de criar outra tabela.
alter table public.site_settings
  add column if not exists usd_rate numeric(10,4),
  add column if not exists default_delivery_time text;

comment on column public.site_settings.usd_rate is
  'Cotação oficial do dólar. Fonte única de verdade dos orçamentos — nunca digitada no formulário do orçamento.';
comment on column public.site_settings.default_delivery_time is
  'Prazo de entrega padrão, pré-preenchido em novos orçamentos.';

NOTIFY pgrst, 'reload schema';
