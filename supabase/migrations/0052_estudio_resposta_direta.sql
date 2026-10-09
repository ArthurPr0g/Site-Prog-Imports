-- A resposta de direct que acompanha a peça.
--
-- Peça com chamada "Comente QUERO" cria uma dívida: alguém tem de mandar o
-- link no direct de cada pessoa que comentou. A API até faz isso sozinha
-- (private reply), mas depende de App Review e verificação de negócio — e
-- até lá o envio é manual.
--
-- Manual não precisa ser improvisado. A mensagem mora aqui, junto da peça que
-- a prometeu, pronta para copiar. Coluna própria e não uma chave dentro de
-- `conteudo`: `conteudo` é o que vai desenhado na arte, e isto é operação.
-- Misturar os dois faria um campo de recado aparecer no formulário do
-- desenho no dia em que alguém iterasse as chaves.

alter table public.studio_pieces
  add column if not exists resposta_direta text not null default '';

comment on column public.studio_pieces.resposta_direta is
  'Mensagem pronta para enviar no direct de quem comentou a palavra-chave da peca. Envio manual ate a API de private reply ser liberada.';

NOTIFY pgrst, 'reload schema';
