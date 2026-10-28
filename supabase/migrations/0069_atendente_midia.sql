-- Atendente: mídia nas mensagens do WhatsApp (2026-10-28).
--
-- O cliente pode mandar áudio, imagem, PDF, vídeo, localização ou contato. O
-- corpo (body) continua sendo o texto que a IA lê (legenda, transcrição do
-- áudio ou uma descrição); a mídia em si fica na Meta por 30 dias e é baixada
-- pelo id quando a IA precisa ver (imagem e PDF vão direto para o Claude).
alter table public.ia_messages
  add column if not exists media_type text
    check (media_type in ('image', 'document', 'audio', 'video', 'sticker')),
  add column if not exists media_id text,
  add column if not exists media_mime text,
  add column if not exists media_name text;
