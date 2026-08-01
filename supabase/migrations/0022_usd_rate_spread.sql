-- Taxa que a Prog paga por dólar comprado, somada à cotação de mercado.
-- Fica configurável porque é custo de operação: muda de corretora, de meio de
-- pagamento e ao longo do tempo. Cravar 0,10 no código obrigaria deploy para
-- ajustar um número que é decisão comercial.
alter table public.site_settings
  add column if not exists usd_rate_spread numeric(6,4) not null default 0.10;

comment on column public.site_settings.usd_rate_spread is
  'Acréscimo por dólar sobre a cotação de mercado (taxa paga na compra da moeda). Somado ao buscar a cotação automática.';

NOTIFY pgrst, 'reload schema';
