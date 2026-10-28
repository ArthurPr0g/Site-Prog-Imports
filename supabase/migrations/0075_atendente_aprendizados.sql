-- Atendente de IA: o que a Lia aprende com as conversas (pedido do dono em 28/10/2026).
-- O relógio relê cada conversa encerrada e sugere lições (dores novas, objeções e
-- como tratar, o que funcionou, o que evitar). Só as que o Arthur aprova
-- (status 'ativo') entram nas instruções da Lia. Aditiva: não muda nada que já
-- está no ar.

create table if not exists public.ia_aprendizados (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('dor', 'objecao', 'abordagem', 'evitar')),
  -- Ramo do negócio a que a lição se aplica; null = vale para todos.
  ramo text,
  texto text not null check (char_length(texto) between 5 and 400),
  -- Trecho curto da conversa que originou a lição (sem nome nem contato).
  exemplo text,
  status text not null default 'sugerido' check (status in ('sugerido', 'ativo', 'descartado')),
  -- Quantas conversas trouxeram a mesma lição.
  vezes integer not null default 1,
  conversation_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists ia_aprendizados_status_idx on public.ia_aprendizados (status, vezes desc);

-- Quando a conversa já foi relida para aprender (null = ainda não).
alter table public.ia_conversations add column if not exists learned_at timestamptz;

alter table public.ia_aprendizados enable row level security;
create policy ia_aprendizados_admin_all on public.ia_aprendizados for all using (public.is_admin()) with check (public.is_admin());
