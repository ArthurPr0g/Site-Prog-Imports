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

-- Modelos de mensagem: um por canal, idioma, etapa da sequência de retorno
-- (0 = primeiro contato, 1 = dia 3, 2 = dia 7, 3 = dia 14) e variante do teste
-- A/B (B é opcional: sem B, todo lead recebe A). Editados pelo dono na tela.
-- O endereço na assinatura do e-mail é exigência da lei americana de e-mail
-- comercial (CAN-SPAM), junto com o "responda não" para sair da lista.
create table if not exists public.lead_templates (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('whatsapp', 'email')),
  lang text not null check (lang in ('pt', 'en')),
  subject text,
  body text not null,
  step integer not null default 0 check (step between 0 and 3),
  variant text not null default 'A' check (variant in ('A', 'B')),
  updated_at timestamptz not null default now(),
  unique (channel, lang, step, variant)
);

alter table public.lead_templates enable row level security;
create policy lead_templates_admin_all on public.lead_templates for all using (public.is_admin()) with check (public.is_admin());

insert into public.lead_templates (channel, lang, subject, body) values
('whatsapp', 'pt', null,
'Oi, tudo bem? Meu nome é {remetente}, sou da Prog Soluções.

Encontrei o perfil de vocês no Google Maps{elogio} e {problema}.

Eu crio {servico} para negócios como o de vocês. Montei um diagnóstico rápido e gratuito da presença online de vocês: {diagnostico}

Posso te mandar uma proposta sem compromisso?'),
('whatsapp', 'en', null,
'Hi! This is {remetente} from Prog Soluções.

I found {empresa} on Google Maps{elogio} and {problema}.

I build {servico} for businesses like yours. I put together a quick, free review of {empresa}''s online presence: {diagnostico}

Would you like a no-strings proposal?'),
('email', 'pt', '{empresa}: uma ideia para o site de vocês',
'Olá! Tudo bem?

Meu nome é {remetente}, sou da Prog Soluções. Encontrei o perfil de vocês no Google Maps{elogio} e {problema}.

Hoje a maior parte dos clientes pesquisa no celular antes de escolher. Eu crio {servico} para negócios como o de vocês, e montei um diagnóstico gratuito da presença online de vocês:
{diagnostico}

Alguns trabalhos meus: {portfolio}

Se fizer sentido, te mando uma proposta sem compromisso. Se não for o momento, é só responder "não" que eu não volto a escrever.

{assinatura}
Prog Soluções
Alameda Botafogo, Quadra 36B, Lote 16-21, Setor Pedro Ludovico, Goiânia - GO, Brasil'),
('email', 'en', 'A quick idea for {empresa}',
'Hi {empresa} team,

My name is {remetente}, from Prog Soluções. I found you on Google Maps{elogio} and {problema}.

Most customers check a business on their phone before choosing. I build {servico} for businesses like yours, and I put together a free review of {empresa}''s online presence:
{diagnostico}

Some of my work: {portfolio}

If it makes sense, I can send you a no-strings proposal. If now isn''t a good time, just reply "no" and I won''t reach out again.

{assinatura}
Prog Soluções
Alameda Botafogo, Quadra 36B, Lote 16-21, Setor Pedro Ludovico, Goiânia - GO, Brazil')
on conflict (channel, lang, step, variant) do nothing;

-- Sequência de retorno (dias 3, 7 e 14), variante A.
insert into public.lead_templates (step, channel, lang, subject, body) values
(1, 'whatsapp', 'pt', null,
'Oi! Passando só para saber se você conseguiu ver o diagnóstico que montei para vocês: {diagnostico}

Se fizer sentido, te mando uma proposta sem compromisso.'),
(1, 'whatsapp', 'en', null,
'Hi! Just checking whether you had a chance to see the review for {empresa}: {diagnostico}

If it makes sense, I can send you a no-strings proposal.'),
(1, 'email', 'pt', 'Re: {empresa}: uma ideia para o site de vocês',
'Olá!

Passando só para saber se você viu o diagnóstico que montei para vocês:
{diagnostico}

Se fizer sentido, te mando uma proposta sem compromisso. Se não for o momento, é só responder "não".

{assinatura}
Prog Soluções
Alameda Botafogo, Quadra 36B, Lote 16-21, Setor Pedro Ludovico, Goiânia - GO, Brasil'),
(1, 'email', 'en', 'Re: A quick idea for {empresa}',
'Hi!

Just checking whether you saw the review I put together for {empresa}:
{diagnostico}

If it makes sense, I can send you a no-strings proposal. If now isn''t a good time, just reply "no".

{assinatura}
Prog Soluções
Alameda Botafogo, Quadra 36B, Lote 16-21, Setor Pedro Ludovico, Goiânia - GO, Brazil'),
(2, 'whatsapp', 'pt', null,
'Oi! Separei alguns trabalhos que fiz para negócios parecidos com o de vocês: {portfolio}

Quer que eu monte uma proposta para vocês?'),
(2, 'whatsapp', 'en', null,
'Hi! Here are a few projects I did for businesses like {empresa}: {portfolio}

Would you like me to put together a proposal for you?'),
(2, 'email', 'pt', '{empresa}: alguns exemplos do meu trabalho',
'Olá!

Separei alguns trabalhos que fiz para negócios parecidos com o de vocês:
{portfolio}

Eu crio {servico} e cuido de tudo: hospedagem, segurança e ajustes do dia a dia. Se quiser, monto uma proposta para vocês.

Se não for o momento, é só responder "não" que eu não volto a escrever.

{assinatura}
Prog Soluções
Alameda Botafogo, Quadra 36B, Lote 16-21, Setor Pedro Ludovico, Goiânia - GO, Brasil'),
(2, 'email', 'en', 'A few examples for {empresa}',
'Hi!

Here are a few projects I did for businesses like {empresa}:
{portfolio}

I build {servico} and take care of everything: hosting, security and day-to-day updates. I''d be happy to put together a proposal for you.

If now isn''t a good time, just reply "no" and I won''t reach out again.

{assinatura}
Prog Soluções
Alameda Botafogo, Quadra 36B, Lote 16-21, Setor Pedro Ludovico, Goiânia - GO, Brazil'),
(3, 'whatsapp', 'pt', null,
'Oi! Esta é minha última mensagem, não quero ser insistente. Se um dia quiserem {servico}, é só me chamar por aqui. Sucesso!'),
(3, 'whatsapp', 'en', null,
'Hi! This is my last message, I don''t want to be pushy. If you ever want {servico} for {empresa}, just message me here. All the best!'),
(3, 'email', 'pt', '{empresa}: minha última mensagem',
'Olá!

Esta é minha última mensagem, não quero ser insistente. Se um dia quiserem {servico}, é só responder este e-mail.

Sucesso!

{assinatura}
Prog Soluções
Alameda Botafogo, Quadra 36B, Lote 16-21, Setor Pedro Ludovico, Goiânia - GO, Brasil'),
(3, 'email', 'en', 'Last note about {empresa}',
'Hi!

This is my last note, I don''t want to be pushy. If you ever want {servico} for {empresa}, just reply to this email.

All the best!

{assinatura}
Prog Soluções
Alameda Botafogo, Quadra 36B, Lote 16-21, Setor Pedro Ludovico, Goiânia - GO, Brazil')
on conflict (channel, lang, step, variant) do nothing;

-- ===== Melhorias do backlog (docs/CAPTACAO-BACKLOG.md, 27/10/2026) =====

alter table public.leads
  -- Último contato (primeiro ou retorno): conta os contatos do dia no modo foco.
  add column if not exists last_contact_at timestamptz,
  -- Etapa da sequência já enviada: 0 = nada, 1 = primeiro contato, 2 = dia 3,
  -- 3 = dia 7, 4 = dia 14 (fim).
  add column if not exists followup_step integer not null default 0 check (followup_step between 0 and 4),
  -- Variante do teste A/B usada no primeiro contato.
  add column if not exists ab_variant text check (ab_variant in ('A', 'B')),
  -- Aberturas do diagnóstico (sem contar o dono nem robôs de prévia de link).
  add column if not exists diag_views integer not null default 0,
  add column if not exists diag_first_view_at timestamptz,
  add column if not exists diag_last_view_at timestamptz,
  -- Coordenadas (do link do Maps) para o mapa.
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6),
  -- Print do site no celular (Storage, bucket diagnosticos).
  add column if not exists screenshot_url text,
  -- Orçamento criado pela "Proposta em um clique".
  add column if not exists quote_id uuid references public.service_quotes(id) on delete set null,
  -- Checklist de descoberta (decisor, dores, urgência...): chaves em
  -- src/lib/checklist-descoberta.ts. Preenchido pelo vendedor ou pelo dono.
  add column if not exists discovery jsonb not null default '{}',
  add column if not exists discovery_by text,
  add column if not exists discovery_at timestamptz;

create index if not exists leads_quentes_idx on public.leads (diag_last_view_at desc) where diag_views > 0;

-- Registra uma abertura do diagnóstico. Chamada pela página pública (anônimo),
-- que já filtra o dono e os robôs; aqui só soma.
create or replace function public.lead_registrar_visita(p_token uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.leads
  set diag_views = diag_views + 1,
      diag_first_view_at = coalesce(diag_first_view_at, now()),
      diag_last_view_at = now()
  where public_token = p_token and status <> 'nao_contatar';
$$;

revoke all on function public.lead_registrar_visita(uuid) from public;
grant execute on function public.lead_registrar_visita(uuid) to anon, authenticated;

-- Pedidos de busca feitos no painel (inclusive pelo celular). O programa no PC
-- do dono (scripts/captacao/worker.ts) pega os pendentes, busca e importa.
create table if not exists public.lead_search_requests (
  id uuid primary key default gen_random_uuid(),
  niche text not null check (length(trim(niche)) > 0),
  city text not null check (length(trim(city)) > 0),   -- "Cidade, UF"
  country text not null default 'BR' check (country in ('BR', 'US')),
  status text not null default 'pendente' check (status in ('pendente', 'rodando', 'feito', 'erro')),
  message text,
  new_leads integer,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index if not exists lead_search_requests_status_idx on public.lead_search_requests (status, created_at);

alter table public.lead_search_requests enable row level security;
create policy lead_search_requests_admin_all on public.lead_search_requests for all using (public.is_admin()) with check (public.is_admin());

-- Prints do site no celular: leitura pública (vão no diagnóstico), escrita só
-- pela chave secreta do programa no PC (que ignora o RLS).
insert into storage.buckets (id, name, public)
values ('diagnosticos', 'diagnosticos', true)
on conflict (id) do nothing;

-- ===== Página do vendedor (27/10/2026) =====
-- O dono gera um link com até 20 leads para um vendedor (ex.: Felipe). A
-- página /vendedor/<token> mostra contatos, análise, oportunidades com preço,
-- roteiro de venda e mensagens no nome do vendedor; o que ele registra volta
-- para o lead (etapa e anotação com o nome dele). Tudo pelas funções abaixo:
-- quem tem o link não lê nem escreve nas tabelas diretamente.

create table if not exists public.lead_seller_kits (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  seller_name text not null check (length(trim(seller_name)) > 0),
  seller_whatsapp text,       -- só dígitos, com DDI (ex.: 5562999999999)
  seller_email text,
  instructions text,          -- recado do dono no topo da página
  -- Catálogo de serviços no momento do envio (simulador e "o que inclui").
  catalog jsonb not null default '[]',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Retrato de cada lead no momento do envio: serviços com descrição e preço do
-- catálogo (o vendedor vende pelo preço que recebeu, mesmo se o catálogo mudar).
create table if not exists public.lead_kit_items (
  kit_id uuid not null references public.lead_seller_kits(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  position integer not null default 0,
  currency text not null default 'BRL' check (currency in ('BRL', 'USD')),
  one_time numeric(12,2) not null default 0,
  monthly numeric(12,2) not null default 0,
  combo boolean not null default false,
  services jsonb not null default '[]',   -- [{nome, descricao, preco, mensal}]
  primary key (kit_id, lead_id)
);
create index if not exists lead_kit_items_lead_idx on public.lead_kit_items (lead_id);

alter table public.lead_seller_kits enable row level security;
alter table public.lead_kit_items enable row level security;
create policy lead_seller_kits_admin_all on public.lead_seller_kits for all using (public.is_admin()) with check (public.is_admin());
create policy lead_kit_items_admin_all on public.lead_kit_items for all using (public.is_admin()) with check (public.is_admin());

-- Tudo que a página do vendedor precisa, num JSON só. Link desativado = null.
create or replace function public.lead_kit(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'seller_name', k.seller_name,
    'seller_whatsapp', k.seller_whatsapp,
    'seller_email', k.seller_email,
    'instructions', k.instructions,
    'catalog', k.catalog,
    'created_at', k.created_at,
    'templates', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'channel', t.channel, 'lang', t.lang, 'step', t.step, 'variant', t.variant, 'subject', t.subject, 'body', t.body
      )), '[]') from public.lead_templates t
    ),
    'leads', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'public_token', l.public_token, 'name', l.name, 'category', l.category, 'niche', l.niche,
        'city', l.city, 'state', l.state, 'country', l.country, 'address', l.address, 'phone', l.phone,
        'sem_whatsapp', l.sem_whatsapp, 'email', l.email, 'website', l.website, 'site_check', l.site_check,
        'instagram', l.instagram, 'facebook', l.facebook, 'maps_url', l.maps_url, 'rating', l.rating,
        'review_count', l.review_count, 'score', l.score, 'reasons', l.reasons,
        'suggested_services', l.suggested_services, 'status', l.status, 'notes', l.notes,
        'first_contact_at', l.first_contact_at, 'followup_step', l.followup_step, 'ab_variant', l.ab_variant,
        'diag_views', l.diag_views, 'diag_last_view_at', l.diag_last_view_at, 'screenshot_url', l.screenshot_url,
        'discovery', l.discovery, 'discovery_at', l.discovery_at,
        'currency', i.currency, 'one_time', i.one_time, 'monthly', i.monthly, 'combo', i.combo, 'services', i.services
      ) order by i.position), '[]')
      from public.lead_kit_items i join public.leads l on l.id = i.lead_id
      where i.kit_id = k.id
    )
  )
  from public.lead_seller_kits k
  where k.token = p_token and k.active;
$$;

-- O vendedor registra o andamento de um lead do link dele: etapa, anotação
-- (com o nome dele e a data) e, ao mandar mensagem, qual etapa da sequência
-- saiu (0 = primeiro contato, 1–3 = retornos dos dias 3, 7 e 14). Mesmas
-- regras de datas do painel.
create or replace function public.lead_kit_atualizar(
  p_token uuid,
  p_lead uuid,
  p_status text default null,
  p_nota text default null,
  p_etapa integer default null
)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_kit public.lead_seller_kits;
  v_lead public.leads;
  v_agora timestamptz := now();
  v_nota text := nullif(trim(coalesce(p_nota, '')), '');
begin
  select * into v_kit from public.lead_seller_kits where token = p_token and active;
  if not found then return 'Link desativado.'; end if;
  if not exists (select 1 from public.lead_kit_items where kit_id = v_kit.id and lead_id = p_lead) then
    return 'Lead fora deste link.';
  end if;
  if p_status is not null and p_status not in ('contatado', 'respondeu', 'reuniao', 'proposta', 'perdido', 'nao_contatar') then
    return 'Etapa inválida.';
  end if;
  select * into v_lead from public.leads where id = p_lead for update;

  if p_etapa is not null and (p_etapa < 0 or p_etapa > 3) then return 'Etapa da sequência inválida.'; end if;

  update public.leads set
    -- Mandar retorno não tira o lead de "respondeu" ou adiante.
    status = case
      when p_status = 'contatado' and status in ('respondeu', 'reuniao', 'proposta', 'fechado') then status
      else coalesce(p_status, status) end,
    first_contact_at = case when p_status is not null and first_contact_at is null then v_agora else first_contact_at end,
    last_contact_at = case when p_status = 'contatado' then v_agora else last_contact_at end,
    followup_step = case
      when p_etapa is not null then greatest(followup_step, p_etapa + 1)
      when p_status = 'contatado' and followup_step = 0 then 1
      else followup_step end,
    -- Próximo retorno: dias 3, 7 e 14 contados do primeiro contato.
    next_contact = case
      when p_status in ('perdido', 'nao_contatar') then null
      when p_status = 'contatado' then
        case coalesce(p_etapa, case when followup_step = 0 then 0 end)
          when 0 then (coalesce(first_contact_at, v_agora) + interval '3 days')::date
          when 1 then (coalesce(first_contact_at, v_agora) + interval '7 days')::date
          when 2 then (coalesce(first_contact_at, v_agora) + interval '14 days')::date
          when 3 then null
          else next_contact end
      else next_contact end,
    replied_at = case when p_status in ('respondeu', 'reuniao', 'proposta') and replied_at is null then v_agora else replied_at end,
    notes = case when v_nota is null then notes
      else concat_ws(E'\n', notes, '[' || v_kit.seller_name || ' ' || to_char(v_agora at time zone 'America/Sao_Paulo', 'DD/MM') || '] ' || v_nota) end,
    updated_at = v_agora
  where id = p_lead;
  return 'ok';
end;
$$;

-- Checklist de descoberta salvo pelo vendedor (substitui o anterior inteiro).
create or replace function public.lead_kit_descoberta(p_token uuid, p_lead uuid, p_dados jsonb)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_kit public.lead_seller_kits;
begin
  select * into v_kit from public.lead_seller_kits where token = p_token and active;
  if not found then return 'Link desativado.'; end if;
  if not exists (select 1 from public.lead_kit_items where kit_id = v_kit.id and lead_id = p_lead) then
    return 'Lead fora deste link.';
  end if;
  if jsonb_typeof(p_dados) <> 'object' or length(p_dados::text) > 20000 then return 'Checklist inválido.'; end if;
  update public.leads
  set discovery = p_dados, discovery_by = v_kit.seller_name, discovery_at = now(), updated_at = now()
  where id = p_lead;
  return 'ok';
end;
$$;

revoke all on function public.lead_kit_descoberta(uuid, uuid, jsonb) from public;
grant execute on function public.lead_kit_descoberta(uuid, uuid, jsonb) to anon, authenticated;

revoke all on function public.lead_kit(uuid) from public;
revoke all on function public.lead_kit_atualizar(uuid, uuid, text, text, integer) from public;
grant execute on function public.lead_kit(uuid) to anon, authenticated;
grant execute on function public.lead_kit_atualizar(uuid, uuid, text, text, integer) to anon, authenticated;

-- Diagnóstico público: o lead + a comparação com os concorrentes da mesma
-- busca (mesmo país, cidade e ramo). Só campos que já são públicos no Google.
create or replace function public.lead_diagnostico(p_token uuid, p_kit uuid default null)
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
    'screenshot_url', l.screenshot_url,
    'vendedor', (
      select jsonb_build_object('nome', k.seller_name, 'whatsapp', k.seller_whatsapp)
      from public.lead_seller_kits k join public.lead_kit_items i on i.kit_id = k.id
      where p_kit is not null and k.token = p_kit and k.active and i.lead_id = l.id
    ),
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
            and coalesce(c.site_check, '') not like '%parado%'
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

revoke all on function public.lead_diagnostico(uuid, uuid) from public;
grant execute on function public.lead_diagnostico(uuid, uuid) to anon, authenticated;
