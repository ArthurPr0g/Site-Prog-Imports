/*
 * 0094 — Pedido do Arthur em 29/10/2026, antes do case real (sistema do Felipe, personal trainer):
 *
 * 1. Pesquisa do lead indicado: tudo o que há na internet sobre a pessoa/empresa (busca web do Claude,
 *    no servidor) + Google Maps pelo mesmo kit da captação (fila lead_search_requests, PC). Cada
 *    informação fica "a_confirmar" até a Lia confirmar com o cliente na conversa.
 *      leads.pesquisa = { resumo, itens: [{ campo, valor, fonte, situacao, correcao }], buscado_em }
 *      leads.pesquisa_status: pendente · rodando · feita · erro
 * 2. Briefing do projeto sob medida (modo projeto da Lia): leads.briefing (funções, público, perfis,
 *    identidade visual, referências, conteúdo, integrações, prazo...).
 * 3. Modelos de mensagem da Meta para o cliente (com botões): status de cada um em ia_config.modelos.
 * 4. Lembrete de reunião ao cliente (reunioes.lembrete_em) e retomada da encomenda sem resposta
 *    (encomendas.retomada_em).
 */
alter table public.leads add column if not exists pesquisa jsonb;
alter table public.leads add column if not exists pesquisa_status text
  check (pesquisa_status is null or pesquisa_status in ('pendente', 'rodando', 'feita', 'erro'));
alter table public.leads add column if not exists pesquisa_dica text check (pesquisa_dica is null or char_length(pesquisa_dica) <= 4000);
alter table public.leads add column if not exists briefing jsonb not null default '{}'::jsonb;
create index if not exists leads_pesquisa_pendente_idx on public.leads (updated_at) where pesquisa_status in ('pendente', 'rodando');
comment on column public.leads.pesquisa is 'O que a busca na internet achou do lead; cada item a_confirmar/confirmado/corrigido/descartado pela Lia. 0094.';
comment on column public.leads.briefing is 'Briefing do projeto sob medida, gravado pela Lia no modo projeto (indicação do Arthur). 0094.';

-- Busca de UMA empresa no Maps (pesquisa do lead): o worker do PC atualiza este lead em vez de importar uma lista.
alter table public.lead_search_requests add column if not exists lead_id uuid references public.leads (id) on delete cascade;

alter table public.ia_config add column if not exists modelos jsonb not null default '{}'::jsonb;
comment on column public.ia_config.modelos is 'Status na Meta de cada modelo de mensagem ao cliente (nome → APPROVED/PENDING/REJECTED/ERRO...). 0094.';

alter table public.reunioes add column if not exists lembrete_em timestamptz;
alter table public.encomendas add column if not exists retomada_em timestamptz;
