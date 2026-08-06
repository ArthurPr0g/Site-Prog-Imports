-- Assinatura digitalizada do contratado, para sair impressa no contrato.
--
-- Bucket PRIVADO, ao contrário dos de imagem do site. Uma assinatura é o que
-- valida um documento em nome de alguém: com o arquivo em mãos, qualquer pessoa
-- monta um contrato que parece assinado. Os outros buckets são públicos porque
-- foto de produto existe para ser vista; este existe para ser usado por uma
-- pessoa só.
--
-- Pelo mesmo motivo o arquivo não vai para o repositório: ele é público, e
-- imagem versionada fica no histórico para sempre, mesmo depois de removida.
insert into storage.buckets (id, name, public)
values ('signatures', 'signatures', false)
on conflict (id) do nothing;

-- Sem policy de leitura pública: quem lê é o servidor, com a sessão do admin,
-- na hora de gerar o PDF.
drop policy if exists "signatures_admin_read" on storage.objects;
create policy "signatures_admin_read" on storage.objects
  for select using (bucket_id = 'signatures' and public.is_admin());

drop policy if exists "signatures_admin_write" on storage.objects;
create policy "signatures_admin_write" on storage.objects
  for insert with check (bucket_id = 'signatures' and public.is_admin());

drop policy if exists "signatures_admin_update" on storage.objects;
create policy "signatures_admin_update" on storage.objects
  for update using (bucket_id = 'signatures' and public.is_admin());

drop policy if exists "signatures_admin_delete" on storage.objects;
create policy "signatures_admin_delete" on storage.objects
  for delete using (bucket_id = 'signatures' and public.is_admin());

-- Guarda o CAMINHO, não a URL: em bucket privado não existe URL permanente, e a
-- assinada expira. O caminho é o que sobrevive.
alter table public.site_settings
  add column if not exists signature_path text not null default '';

comment on column public.site_settings.signature_path is
  'Caminho da assinatura no bucket privado signatures. Vazio = contrato sai com linha em branco para assinar à mão.';

NOTIFY pgrst, 'reload schema';
