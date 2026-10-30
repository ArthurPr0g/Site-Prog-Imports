/*
 * 0095 — 30/10/2026, antes do case real do Felipe:
 * 1. "Lia, faça todo o projeto" passa a pedir um toque de confirmação do Arthur antes de chamar o
 *    cliente (botões "Pode chamar" / "Cancelar"): status aguardando_confirmacao.
 * 2. Custo da IA por venda: cada gasto em ia_usage diz a finalidade (atendimento, pesquisa,
 *    organizar ideia, aprender...) e o lead, para somar quanto custou cada venda.
 * 3. Relógio da pesquisa do lead (busca web demora mais que o relógio de 1 min aguenta): rota
 *    própria /api/atendente/pesquisa a cada 2 min, mesmo segredo do relógio.
 */
alter table public.encomendas drop constraint if exists encomendas_status_check;
alter table public.encomendas add constraint encomendas_status_check check (
  status in ('aguardando_instrucao', 'aguardando_contato', 'aguardando_confirmacao', 'aguardando_modelo', 'contatado', 'cancelada')
);

alter table public.ia_usage add column if not exists finalidade text;
alter table public.ia_usage add column if not exists lead_id uuid references public.leads (id) on delete set null;
create index if not exists ia_usage_lead_idx on public.ia_usage (lead_id) where lead_id is not null;
create index if not exists ia_usage_conversa_idx on public.ia_usage (conversation_id) where conversation_id is not null;
comment on column public.ia_usage.finalidade is 'Para que foi o gasto: atendimento, pesquisa_lead, assunto_encomenda, organizar_ideia, aprender... 0095.';

do $$
begin
  perform cron.unschedule('atendente-pesquisa') where exists (select 1 from cron.job where jobname = 'atendente-pesquisa');
  perform cron.schedule(
    'atendente-pesquisa',
    '*/2 * * * *',
    $cron$
      select net.http_post(
        url := 'https://www.prog-imports.com/api/atendente/pesquisa',
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'authorization', 'Bearer ' || coalesce(
            (select decrypted_secret from vault.decrypted_secrets where name = 'atendente_tick_secret'), '')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 5000
      );
    $cron$
  );
end $$;
