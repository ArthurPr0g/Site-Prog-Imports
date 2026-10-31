-- Pré-venda da Prog Soluções (pedido do Arthur, 31/10/2026): acompanhar o "projeto antes de ser projeto"
-- (briefing, identidade, protótipo, proposta e o que falta do cliente) sem abrir nada no Pós-venda antes
-- do sinal. Uma linha por lead, só com o que o Arthur marca e digita na tela /admin/pre-venda; o resto
-- (etapa, datas, conversa da Lia, reuniões, cobranças) continua vindo das tabelas de sempre.
-- Aditivo: tabela nova, nada muda no que já está no ar.

create table if not exists public.prevenda (
  lead_id uuid primary key references public.leads (id) on delete cascade,
  -- Passos marcados à mão: {"identidade": {"estado": "feito"|"andamento"|"pendente", "em": "AAAA-MM-DD"}}.
  -- Passo ausente = vale o que os dados dizem sozinhos.
  passos jsonb not null default '{}'::jsonb,
  -- O que falta o cliente mandar: [{"texto": "Logo", "feito": false}].
  pendencias jsonb not null default '[]'::jsonb,
  -- Próximo passo explícito (quando vazio, a tela usa o da última reunião registrada).
  proximo_passo text check (proximo_passo is null or char_length(proximo_passo) <= 500),
  proximo_responsavel text check (proximo_responsavel is null or char_length(proximo_responsavel) <= 80),
  proximo_prazo date,
  -- Pasta no PC do Arthur (o site não lê o disco: fica como texto de referência) e links da pré-venda.
  pasta text check (pasta is null or char_length(pasta) <= 300),
  briefing_url text check (briefing_url is null or char_length(briefing_url) <= 1000),
  design_system_url text check (design_system_url is null or char_length(design_system_url) <= 1000),
  prototipo_url text check (prototipo_url is null or char_length(prototipo_url) <= 1000),
  proposta_url text check (proposta_url is null or char_length(proposta_url) <= 1000),
  -- Valores: o preço cheio sai do catálogo na hora; aqui só o combinado.
  desconto numeric(12, 2) check (desconto is null or desconto >= 0),
  valor_proposta numeric(12, 2) check (valor_proposta is null or valor_proposta >= 0),
  proposta_enviada_em timestamptz,
  prazo_prometido date,
  observacoes text check (observacoes is null or char_length(observacoes) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.prevenda is 'Acompanhamento da pré-venda por lead (passos marcados à mão, pendências do cliente, links, desconto e proposta). Tela /admin/pre-venda. 0114.';

-- Só o admin lê e grava (sessão do Arthur), no padrão das tabelas do painel.
alter table public.prevenda enable row level security;
create policy prevenda_admin_all on public.prevenda for all using (public.is_admin()) with check (public.is_admin());
