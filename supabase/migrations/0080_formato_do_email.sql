-- Formato do e-mail de 1º contato da Lia (28/10/2026): o teste da versão bonita
-- (HTML) caiu no spam na conta nova do Gmail. 'html' = bonita + texto puro junto;
-- 'texto' = só texto, com cara de e-mail pessoal. O dono escolhe depois do teste. Aditiva.

alter table public.ia_config add column if not exists email_formato text not null default 'html'
  check (email_formato in ('html', 'texto'));
