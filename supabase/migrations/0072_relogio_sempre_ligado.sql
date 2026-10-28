-- O relógio do atendente passa a rodar sempre (2026-10-28): além da Lia, ele
-- guarda os arquivos dos clientes fechados (0071), o que vale mesmo com a
-- atendente desligada. A rota /api/atendente/tick já não responde nem manda
-- e-mail quando ia_config.active = false.
do $$
begin
  perform cron.unschedule('atendente-tick') where exists (select 1 from cron.job where jobname = 'atendente-tick');
  perform cron.schedule(
    'atendente-tick',
    '* * * * *',
    $cron$
      select net.http_post(
        url := 'https://www.prog-imports.com/api/atendente/tick',
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'authorization', 'Bearer ' || coalesce(
            (select decrypted_secret from vault.decrypted_secrets where name = 'atendente_tick_secret'), '')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 55000
      );
    $cron$
  );
end $$;
