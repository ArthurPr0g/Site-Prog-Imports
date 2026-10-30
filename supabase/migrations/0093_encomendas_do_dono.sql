/*
 * 0093 — "Lia, faça todo o projeto" (pedido do Arthur em 29/10/2026).
 *
 * O Arthur manda pelo WhatsApp da Lia um CONTATO (cartão de contato ou número no texto) e uma explicação
 * começando com "Lia," (texto ou áudio). A Lia cria o lead, abre a conversa com essa pessoa, guarda a
 * explicação como orientação interna (o cliente não vê) e chama o cliente para a descoberta completa.
 *
 * Primeira mensagem para quem nunca falou com a Lia só sai por modelo aprovado pela Meta
 * (ia_config.encomenda_template_status). Enquanto o modelo não estiver aprovado, a encomenda espera
 * em 'aguardando_modelo' e o relógio envia quando aprovar.
 *
 *   status: aguardando_instrucao (veio só o contato) · aguardando_contato (veio só a explicação) ·
 *           aguardando_modelo · contatado · cancelada
 */
create table if not exists public.encomendas (
  id uuid primary key default gen_random_uuid(),
  nome text,
  telefone text check (telefone is null or telefone ~ '^[0-9]{10,15}$'),
  instrucoes text check (instrucoes is null or char_length(instrucoes) <= 8000),
  assunto text check (assunto is null or char_length(assunto) <= 120),
  status text not null default 'aguardando_instrucao'
    check (status in ('aguardando_instrucao', 'aguardando_contato', 'aguardando_modelo', 'contatado', 'cancelada')),
  lead_id uuid references public.leads (id) on delete set null,
  conversation_id uuid references public.ia_conversations (id) on delete set null,
  erro text,
  criado_em timestamptz not null default now(),
  contatado_em timestamptz
);
create index if not exists encomendas_status_idx on public.encomendas (status, criado_em desc);
alter table public.encomendas enable row level security;
create policy encomendas_admin_all on public.encomendas for all using (public.is_admin()) with check (public.is_admin());
comment on table public.encomendas is 'Pedidos do Arthur pelo WhatsApp: "Lia, faça todo o projeto" com o contato do cliente; a Lia chama e faz a descoberta. 0093.';

alter table public.ia_config add column if not exists encomenda_template_status text;
comment on column public.ia_config.encomenda_template_status is 'Status na Meta do modelo primeiro_contato_projeto (primeira mensagem da Lia a quem o Arthur indicou). 0093.';
