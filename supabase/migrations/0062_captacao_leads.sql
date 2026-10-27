-- Captação de clientes para os serviços da Prog Soluções (2026-10-27).
--
-- Pedido do dono: um painel de leads (Brasil e EUA) vindos do Google Maps
-- (google-maps-scraper-kit, CSV), com nota de quanto cada um tem chance de
-- fechar site, loja, sistema de gestão ou marca, o funil de contato, mensagens
-- prontas de WhatsApp/e-mail e um diagnóstico público para mandar ao lead.
--
-- Decisões:
-- - `dedupe_key` é o place_id do Google quando o CSV traz; senão, nome +
--   telefone. Reimportar a mesma busca atualiza os dados públicos e a nota,
--   mas NUNCA mexe em status, notas e datas de contato.
-- - `nao_contatar` existe para quem pediu para não receber contato (LGPD/
--   CAN-SPAM): o registro fica, justamente para a reimportação não trazer a
--   pessoa de volta como "novo".
-- - O diagnóstico é público por `public_token` (uuid impossível de adivinhar)
--   e lido só pela função `lead_diagnostico`, que devolve campos escolhidos:
--   a tabela continua fechada para quem não é admin.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  public_token uuid not null unique default gen_random_uuid(),
  place_id text,
  name text not null check (length(trim(name)) > 0),
  category text,
  niche text,                 -- termo da busca (ex.: "clínica odontológica")
  city text,
  state text,
  -- PT e ES reservados (pedido de 27/10): o painel já mostra o espaço; preços
  -- em euro e mensagens entram quando começarem as buscas lá.
  country text not null default 'BR' check (country in ('BR', 'US', 'PT', 'ES')),
  address text,
  phone text,
  -- Marcado pelo dono quando o número não tem WhatsApp (comum em fixo e nos EUA).
  sem_whatsapp boolean not null default false,
  email text,
  website text,
  -- checar-sites.py: fora, sem_https, sem_celular, vende_online, ok (juntos com "+")
  site_check text,
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
create index if not exists leads_regiao_idx on public.leads (country, city, niche);

-- Só o admin, como o resto do ERP
alter table public.leads enable row level security;
create policy leads_admin_all on public.leads for all using (public.is_admin()) with check (public.is_admin());

-- Modelos de mensagem: um por canal e idioma, editados pelo dono na tela.
-- O endereço na assinatura do e-mail é exigência da lei americana de e-mail
-- comercial (CAN-SPAM), junto com o "responda não" para sair da lista.
create table if not exists public.lead_templates (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('whatsapp', 'email')),
  lang text not null check (lang in ('pt', 'en')),
  subject text,
  body text not null,
  updated_at timestamptz not null default now(),
  unique (channel, lang)
);

alter table public.lead_templates enable row level security;
create policy lead_templates_admin_all on public.lead_templates for all using (public.is_admin()) with check (public.is_admin());

insert into public.lead_templates (channel, lang, subject, body) values
('whatsapp', 'pt', null,
'Oi, tudo bem? Aqui é o Arthur, da Prog Soluções.

Encontrei a {empresa} no Google Maps{elogio} e {problema}.

Eu crio {servico} para negócios como o de vocês. Montei um diagnóstico rápido e gratuito da presença online da {empresa}: {diagnostico}

Posso te mandar uma proposta sem compromisso?'),
('whatsapp', 'en', null,
'Hi! This is Arthur from Prog Soluções.

I found {empresa} on Google Maps{elogio} and {problema}.

I build {servico} for businesses like yours. I put together a quick, free review of {empresa}''s online presence: {diagnostico}

Would you like a no-strings proposal?'),
('email', 'pt', 'Uma ideia para a {empresa}',
'Olá, equipe da {empresa}!

Meu nome é Arthur, da Prog Soluções. Encontrei vocês no Google Maps{elogio} e {problema}.

Hoje a maior parte dos clientes pesquisa no celular antes de escolher. Eu crio {servico} para negócios como o de vocês, e montei um diagnóstico gratuito da presença online da {empresa}:
{diagnostico}

Alguns trabalhos meus: {portfolio}

Se fizer sentido, te mando uma proposta sem compromisso. Se não for o momento, é só responder "não" que eu não volto a escrever.

Arthur Matos
Prog Soluções
Alameda Botafogo, Quadra 36B, Lote 16-21, Setor Pedro Ludovico, Goiânia - GO, Brasil'),
('email', 'en', 'A quick idea for {empresa}',
'Hi {empresa} team,

My name is Arthur, from Prog Soluções. I found you on Google Maps{elogio} and {problema}.

Most customers check a business on their phone before choosing. I build {servico} for businesses like yours, and I put together a free review of {empresa}''s online presence:
{diagnostico}

Some of my work: {portfolio}

If it makes sense, I can send you a no-strings proposal. If now isn''t a good time, just reply "no" and I won''t reach out again.

Arthur Matos
Prog Soluções
Alameda Botafogo, Quadra 36B, Lote 16-21, Setor Pedro Ludovico, Goiânia - GO, Brazil')
on conflict (channel, lang) do nothing;

-- Diagnóstico público: o lead + a comparação com os concorrentes da mesma
-- busca (mesmo país, cidade e ramo). Só campos que já são públicos no Google.
create or replace function public.lead_diagnostico(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'name', l.name,
    'category', l.category,
    'niche', l.niche,
    'city', l.city,
    'state', l.state,
    'country', l.country,
    'website', l.website,
    'site_check', l.site_check,
    'instagram', l.instagram is not null,
    'rating', l.rating,
    'review_count', l.review_count,
    'suggested_services', l.suggested_services,
    'concorrentes', (
      select jsonb_build_object(
        'total', count(*),
        -- Site próprio e no ar. Rede social e página de agendamento não contam
        -- (mesma ideia do SITE_FRACO de src/lib/captacao.ts, versão curta).
        'com_site', count(*) filter (
          where c.website is not null
            and c.website !~* '(instagram|facebook|fb\.(com|me)|wa\.me|whatsapp|linktr\.ee|linkin\.bio|beacons\.ai|business\.site|negocio\.site|sites\.google|apointoo|calendly|booksy|doctoralia|ifood)'
            and coalesce(c.site_check, '') not like '%fora%'
        ),
        'nota_media', round(avg(c.rating), 1)
      )
      from public.leads c
      where c.id <> l.id and c.country = l.country
        and c.city is not distinct from l.city and c.niche is not distinct from l.niche
    )
  )
  from public.leads l
  where l.public_token = p_token and l.status <> 'nao_contatar';
$$;

revoke all on function public.lead_diagnostico(uuid) from public;
grant execute on function public.lead_diagnostico(uuid) to anon, authenticated;
