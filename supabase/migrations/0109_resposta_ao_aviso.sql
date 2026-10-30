-- Responder um aviso de pedido continua o pedido (pedido do Arthur, 30/10/2026): quando o Claude não
-- conseguiu resolver e trouxe opções, o Arthur responde aquela mensagem no WhatsApp (texto ou áudio) e a
-- resposta vira a continuação do mesmo pedido na fila. O aviso guarda qual pedido ele fecha.
alter table public.ia_avisos add column if not exists ideia_id uuid references public.ideias(id) on delete set null;
create index if not exists ia_avisos_external_id_idx on public.ia_avisos (external_id) where external_id is not null;
