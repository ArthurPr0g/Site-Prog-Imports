/*
 * 0105 — Melhorias pedidas pelo Arthur em 30/10/2026 (todas aditivas):
 *  - Bom dia às 8h: ia_config.bom_dia_em (dia em que já saiu).
 *  - Alarme de saúde: batidas dos dois relógios (tick_em, pesquisa_em) e ia_config.saude (o que já foi
 *    avisado e desde quando cada modelo está pendente), para não repetir o mesmo alarme.
 *  - Pós-entrega: projetos.pos_entrega (acompanhamentos de 7/30/90 dias, avaliação, portfólio, manutenção)
 *    e ia_config.link_avaliacao_google (link "avaliar no Google" da Prog, se houver).
 *  - Ensaio semanal da Lia: tabela ensaios_lia (uma linha por perfil de cliente simulado) e
 *    ia_config.ensaio_em (segunda-feira em que a rodada começou).
 */
alter table public.ia_config
  add column if not exists bom_dia_em date,
  add column if not exists tick_em timestamptz,
  add column if not exists pesquisa_em timestamptz,
  add column if not exists saude jsonb not null default '{}'::jsonb,
  add column if not exists link_avaliacao_google text,
  add column if not exists ensaio_em date;

alter table public.projetos add column if not exists pos_entrega jsonb not null default '{}'::jsonb;
comment on column public.projetos.pos_entrega is 'Pós-entrega automático (0105): {d7,d30,d90: ISO do envio, portfolio: sim|nao, avaliou: bool, depoimento, quer_manutencao: bool}.';

create table if not exists public.ensaios_lia (
  id uuid primary key default gen_random_uuid(),
  rodada date not null,
  perfil text not null,
  conversation_id uuid references public.ia_conversations(id) on delete set null,
  status text not null default 'pendente' check (status in ('pendente', 'conversando', 'avaliado', 'erro')),
  turnos int not null default 0,
  nota int check (nota between 0 and 10),
  aprovado boolean,
  problemas jsonb not null default '[]'::jsonb,
  resumo text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (rodada, perfil)
);
alter table public.ensaios_lia enable row level security;
drop policy if exists ensaios_lia_admin on public.ensaios_lia;
create policy ensaios_lia_admin on public.ensaios_lia for all to authenticated using (public.is_admin()) with check (public.is_admin());
comment on table public.ensaios_lia is 'Ensaio semanal da Lia (0105): conversas simuladas com perfis difíceis e a nota de um avaliador.';
