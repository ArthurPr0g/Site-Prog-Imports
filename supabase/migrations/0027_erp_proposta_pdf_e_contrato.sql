-- PDF de proposta com contrato embutido.

-- Anexar o contrato é decisão por orçamento: o modelo é de site institucional
-- e não faz sentido numa mentoria ou num dashboard.
alter table public.service_quotes
  add column if not exists include_contract boolean not null default false;

-- Muda uma linha da Cláusula 2: com domínio ele entra nos itens INCLUSOS; sem
-- domínio, na lista do que NÃO está incluso. É a única diferença entre os dois
-- modelos de contrato do dono (os .docx "com domínio" e "sem domínio"), por
-- isso um documento só resolve.
alter table public.service_quotes
  add column if not exists client_has_domain boolean not null default false;

comment on column public.service_quotes.client_has_domain is
  'Cliente já tem domínio próprio. Move "Domínio" de incluso para não incluso na Cláusula 2.';

-- Dados do contratado para o contrato. Ficam no BANCO e não no código porque o
-- repositório é público: CPF em arquivo versionado vira dado pessoal exposto
-- para sempre, inclusive no histórico do git.
alter table public.site_settings
  add column if not exists contractor_name text not null default '';
alter table public.site_settings
  add column if not exists contractor_doc text not null default '';
alter table public.site_settings
  add column if not exists contractor_role text not null default '';
alter table public.site_settings
  add column if not exists contract_forum text not null default '';

comment on column public.site_settings.contractor_doc is
  'CPF/CNPJ de quem presta o serviço. Dado pessoal: nunca mover para o código, o repositório é público.';

NOTIFY pgrst, 'reload schema';
