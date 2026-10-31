-- Pré-venda (feedback do Arthur, 31/10/2026): montar o pacote do projeto na própria pré-venda e digitar o
-- valor combinado (único e mensalidade), e saber de onde veio o próximo passo (escrito à mão ou aceito da
-- reunião). Aditivo: só colunas novas com padrão; a versão no ar continua funcionando.

alter table public.prevenda
  -- Itens do pacote: [{"tipo": "catalogo", "nome": "Site Profissional", "preco": 2997, "mensal": 149}]
  -- e referências do portfólio: [{"tipo": "portfolio", "slug": "vitaliti", "nome": "VitaliTI Soluções"}].
  -- O preço fica como estava no catálogo ao incluir (a tela mostra se o catálogo mudou depois).
  add column if not exists itens jsonb not null default '[]'::jsonb,
  -- Mensalidade combinada (o valor único combinado continua em valor_proposta).
  add column if not exists valor_mensal numeric(12, 2) check (valor_mensal is null or valor_mensal >= 0),
  -- De onde veio o próximo passo: null/"manual" = escrito à mão; "reuniao:AAAA-MM-DD" = aceito da reunião.
  add column if not exists proximo_origem text check (proximo_origem is null or char_length(proximo_origem) <= 40);

comment on column public.prevenda.itens is 'Pacote montado na pré-venda: itens do catálogo (preço cheio ao incluir) e referências do portfólio. 0115.';
comment on column public.prevenda.valor_mensal is 'Mensalidade combinada com o cliente. 0115.';
comment on column public.prevenda.proximo_origem is 'Origem do próximo passo: manual ou reuniao:AAAA-MM-DD. 0115.';
