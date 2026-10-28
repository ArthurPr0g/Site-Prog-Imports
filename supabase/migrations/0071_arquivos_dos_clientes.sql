-- Arquivos dos clientes fechados (2026-10-28).
--
-- Pedido do dono: cada cliente que fechar ganha uma pasta no OneDrive
-- ("Empresa - Responsável"), e o que ele mandar pelo WhatsApp vai para lá.
-- A Meta só guarda a mídia por 30 dias, então o relógio do atendente copia os
-- arquivos da conversa de quem fechou para o bucket privado `clientes`; uma
-- tarefa no PC do Arthur baixa para o OneDrive e marca synced_at.

-- Nome do responsável (a Lia registra no fechamento; o painel também pode).
alter table public.leads add column if not exists responsible_name text;

-- Cópia guardada da mídia ('expirado' quando a Meta já apagou) e quando foi para o OneDrive.
alter table public.ia_messages
  add column if not exists storage_path text,
  add column if not exists synced_at timestamptz;

create index if not exists ia_messages_arquivos_pendentes_idx
  on public.ia_messages (created_at) where media_id is not null and synced_at is null;

-- Bucket privado: sem policies, só a chave secreta do servidor lê e grava.
insert into storage.buckets (id, name, public, file_size_limit)
values ('clientes', 'clientes', false, 104857600)
on conflict (id) do nothing;
