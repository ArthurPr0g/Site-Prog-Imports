-- Sala de reunião da Prog Soluções, Fase 1 (pedido do Arthur, 31/10/2026).
-- Reunião de venda numa página própria: videochamada (Daily), gravação e transcrição no navegador do Arthur,
-- página do cliente por token com o aviso de gravação (LGPD) e, no fim, a negociação atualizada.
--
-- A tabela `reunioes` já existe (0076: as que a Lia marca na agenda). Aqui ela só ganha colunas (aditivo):
--   * `inicio` continua sendo o horário marcado ("agendada_para"); `status` (marcada/cancelada/realizada) continua
--     sendo o da agenda, e o estado da sala fica em `sala_status`, para não mexer no que já filtra por status.
--   * A política de admin (reunioes_admin_all, 0076) continua: o painel lê pela sessão do Arthur. A página pública
--     do cliente NÃO lê pelo navegador: passa pelo servidor (chave do atendente), que só devolve o necessário.
--   * Vídeo: fica no OneDrive do Arthur (gravado no navegador e salvo na pasta que ele escolheu); aqui só o nome
--     do arquivo. Áudio (opus de baixa taxa) no bucket privado `reunioes`.

alter table public.reunioes add column if not exists sala_token text;
alter table public.reunioes add column if not exists sala_meio text check (sala_meio is null or sala_meio in ('daily', 'meet'));
alter table public.reunioes add column if not exists sala_nome text;
alter table public.reunioes add column if not exists sala_url text;
alter table public.reunioes add column if not exists sala_expira_em timestamptz;
alter table public.reunioes add column if not exists sala_status text not null default 'agendada'
  check (sala_status in ('agendada', 'ao_vivo', 'encerrada'));
alter table public.reunioes add column if not exists consentimento_em timestamptz;
alter table public.reunioes add column if not exists inicio_em timestamptz;
alter table public.reunioes add column if not exists fim_em timestamptz;
alter table public.reunioes add column if not exists minutos_participante numeric(10, 2);
alter table public.reunioes add column if not exists transcricao text check (transcricao is null or char_length(transcricao) <= 400000);
-- [{quem: 'arthur'|'cliente', t: segundos desde o início, texto}]
alter table public.reunioes add column if not exists trechos jsonb not null default '[]'::jsonb;
alter table public.reunioes add column if not exists resumo text check (resumo is null or char_length(resumo) <= 20000);
alter table public.reunioes add column if not exists audio_path text;
alter table public.reunioes add column if not exists video_arquivo text check (video_arquivo is null or char_length(video_arquivo) <= 300);
alter table public.reunioes add column if not exists custo_usd numeric(10, 4) not null default 0;
alter table public.reunioes add column if not exists processamento text
  check (processamento is null or processamento in ('processando', 'feito', 'erro'));

create unique index if not exists reunioes_sala_token_idx on public.reunioes (sala_token) where sala_token is not null;
create index if not exists reunioes_sala_status_idx on public.reunioes (sala_status, inicio);
create index if not exists reunioes_lead_idx on public.reunioes (lead_id);

comment on column public.reunioes.sala_token is 'Token forte (32 bytes, base64url) do link público /reuniao/<token> do cliente. 0113.';
comment on column public.reunioes.sala_meio is 'daily = sala própria (Daily); meet = plano B pelo Google Meet (trava de minutos ou Daily fora). 0113.';
comment on column public.reunioes.trechos is 'Transcrição ao vivo em trechos: [{quem: arthur|cliente, t: segundos desde o início, texto}]. 0113.';
comment on column public.reunioes.video_arquivo is 'Nome do arquivo de vídeo salvo no PC do Arthur (pasta do OneDrive) ou baixado. 0113.';

-- Trechos chegam de dois lados ao mesmo tempo: o acréscimo é atômico (sem ler-e-regravar no servidor).
create or replace function public.reuniao_acrescentar_trecho(p_id uuid, p_trecho jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.reunioes
     set trechos = coalesce(trechos, '[]'::jsonb) || jsonb_build_array(p_trecho)
   where id = p_id;
$$;
revoke all on function public.reuniao_acrescentar_trecho(uuid, jsonb) from public, anon, authenticated;

-- Avisos de uso dos minutos grátis da Daily (70% e 90%), um de cada por mês: {"2026-10": {"70": iso, "90": iso}}.
alter table public.ia_config add column if not exists reunioes_avisos jsonb not null default '{}'::jsonb;

-- Áudio das reuniões: privado, só o servidor gera os links (upload e leitura assinados).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reunioes', 'reunioes', false, 104857600, array['audio/webm', 'audio/ogg', 'audio/mp4'])
on conflict (id) do nothing;
