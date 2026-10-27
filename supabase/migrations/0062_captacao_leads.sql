-- Captação de clientes para os serviços da Prog Soluções (2026-10-27).
--
-- Pedido do dono: um painel de leads (Brasil e EUA) vindos do Google Maps
-- (google-maps-scraper-kit, CSV), com nota de quanto cada um tem chance de
-- fechar site, loja, sistema de gestão ou marca, e o funil de contato.
--
-- Decisões:
-- - `dedupe_key` é o place_id do Google quando o CSV traz; senão, nome +
--   telefone. Reimportar a mesma busca atualiza os dados públicos e a nota,
--   mas NUNCA mexe em status, notas e datas de contato.
-- - `nao_contatar` existe para quem pediu para não receber contato (LGPD/
--   CAN-SPAM): o registro fica, justamente para a reimportação não trazer a
--   pessoa de volta como "novo".
-- - Mensagens de e-mail/WhatsApp ficam para depois (pedido do dono).

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  place_id text,
  name text not null check (length(trim(name)) > 0),
  category text,
  niche text,                 -- termo da busca (ex.: "clínica odontológica")
  city text,
  state text,
  country text not null default 'BR' check (country in ('BR', 'US')),
  address text,
  phone text,
  email text,
  website text,
  instagram text,
  facebook text,
  linkedin text,
  maps_url text,
  rating numeric(2,1),
  review_count integer,
  score integer not null default 0 check (score between 0 and 100),
  suggested_services text[] not null default '{}',
  reasons text[] not null default '{}',
  status text not null default 'novo'
    check (status in ('novo', 'contatado', 'respondeu', 'reuniao', 'proposta', 'fechado', 'perdido', 'nao_contatar')),
  next_contact date,
  first_contact_at timestamptz,
  replied_at timestamptz,
  closed_at timestamptz,
  notes text,
  customer_id uuid references public.customers(id) on delete set null,
  source text,                -- arquivo importado
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_status_score_idx on public.leads (status, score desc);
create index if not exists leads_next_contact_idx on public.leads (next_contact)
  where status not in ('fechado', 'perdido', 'nao_contatar');
create index if not exists leads_customer_idx on public.leads (customer_id) where customer_id is not null;

-- Só o admin, como o resto do ERP
alter table public.leads enable row level security;
create policy leads_admin_all on public.leads for all using (public.is_admin()) with check (public.is_admin());
