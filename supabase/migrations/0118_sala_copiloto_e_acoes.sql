-- Sala de reunião, Fase 2 e 3 (pedido do Arthur, 31/10/2026): copiloto com balões, botões de ação, anotações do
-- Arthur, trechos guardados quando a transcrição bate no limite grátis da Groq e o custo da IA por reunião.
-- Aditivo: só colunas e funções novas, com padrão; a versão no ar continua funcionando.
-- Numeração: aplicada no banco como "0117_sala_copiloto_e_acoes" ao mesmo tempo que a 0117 da central de decisões
-- (outro pedido); o arquivo ficou 0118 para não repetir o número.

-- Balões do copiloto (só o Arthur vê): [{id, tipo, chave, titulo, texto, link, ref, em, dispensado}].
alter table public.reunioes add column if not exists copiloto jsonb not null default '[]'::jsonb;
-- Ações tomadas na sala (cobrança do sinal, proposta, desconto, próxima reunião, case, fechou): [{em, tipo, texto, ok}].
alter table public.reunioes add column if not exists acoes jsonb not null default '[]'::jsonb;
-- Trechos que a Groq recusou por limite (429): [{t, path, energia}] no bucket "reunioes"; transcritos no fim.
alter table public.reunioes add column if not exists trechos_pendentes jsonb not null default '[]'::jsonb;
-- Anotações do Arthur durante a reunião (entram no relato da negociação ao encerrar).
alter table public.reunioes add column if not exists anotacoes text check (anotacoes is null or char_length(anotacoes) <= 20000);

comment on column public.reunioes.copiloto is 'Balões do copiloto da sala (só o Arthur vê); chave única por balão, dispensados ficam marcados. 0117.';
comment on column public.reunioes.acoes is 'Registro das ações tomadas na sala (botões da coluna Ações). 0117.';
comment on column public.reunioes.trechos_pendentes is 'Trechos de áudio guardados no Storage quando a transcrição bateu no limite (429); transcritos ao encerrar. 0117.';

-- Custo da IA por reunião (copiloto e processamento): a soma da reunião deixa de depender da hora.
alter table public.ia_usage add column if not exists reuniao_id uuid references public.reunioes (id) on delete set null;
create index if not exists ia_usage_reuniao_idx on public.ia_usage (reuniao_id) where reuniao_id is not null;

-- Acréscimos atômicos (o navegador do Arthur e o servidor gravam ao mesmo tempo). Só o servidor chama.
create or replace function public.reuniao_registrar_acao(p_id uuid, p_acao jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.reunioes
     set acoes = coalesce(acoes, '[]'::jsonb) || jsonb_build_array(p_acao)
   where id = p_id;
$$;
revoke all on function public.reuniao_registrar_acao(uuid, jsonb) from public, anon, authenticated;

create or replace function public.reuniao_guardar_pendente(p_id uuid, p_item jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.reunioes
     set trechos_pendentes = coalesce(trechos_pendentes, '[]'::jsonb) || jsonb_build_array(p_item)
   where id = p_id;
$$;
revoke all on function public.reuniao_guardar_pendente(uuid, jsonb) from public, anon, authenticated;
