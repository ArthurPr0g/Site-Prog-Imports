-- Endereço de remetente, para a etiqueta de transporte.
--
-- Vai para `site_settings` pelo mesmo motivo dos dados de contrato: o
-- repositório é público, e endereço com CPF/CNPJ em arquivo versionado fica
-- exposto para sempre, inclusive no histórico.
--
-- Campos separados, e não um bloco de texto: a etiqueta precisa destacar o CEP
-- e quebrar as linhas na ordem que os Correios esperam. Texto livre obrigaria a
-- adivinhar onde termina a rua e começa o bairro.
alter table public.site_settings
  add column if not exists sender_name text not null default '',
  add column if not exists sender_doc text not null default '',
  add column if not exists sender_phone text not null default '',
  add column if not exists sender_cep text not null default '',
  add column if not exists sender_address_line text not null default '',
  add column if not exists sender_address_number text not null default '',
  add column if not exists sender_complement text not null default '',
  add column if not exists sender_district text not null default '',
  add column if not exists sender_city text not null default '',
  add column if not exists sender_state text not null default '';

comment on column public.site_settings.sender_name is
  'Remetente impresso na etiqueta de transporte. Vazio impede a geração — etiqueta sem remetente volta.';

NOTIFY pgrst, 'reload schema';
