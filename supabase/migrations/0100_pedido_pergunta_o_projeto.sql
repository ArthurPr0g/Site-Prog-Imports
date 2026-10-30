/*
 * 0100 — Pedidos "Claude, ..." pelo WhatsApp: quando não dá para saber em qual projeto mexer, a Lia pergunta
 * ao Arthur (botões) antes de pôr na fila (pedido de 30/10/2026: o pedido da "imagem de prévia do link" foi
 * feito na loja, mas era a prévia dos links dos avisos). Enquanto espera a resposta: status aguardando_projeto
 * (o executor só pega 'pendente'). O projeto escolhido vai em ideias.projeto e no começo do texto do pedido.
 */
alter table public.ideias add column if not exists projeto text check (projeto is null or char_length(projeto) <= 200);
alter table public.ideias drop constraint if exists ideias_status_check;
alter table public.ideias add constraint ideias_status_check check (
  status in ('nova', 'andamento', 'feita', 'pendente', 'aguardando_projeto', 'entregue', 'em_execucao', 'parcial', 'feito', 'arquivada')
);
