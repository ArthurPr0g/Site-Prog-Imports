/*
 * 0098 — Dúvidas da Lia antes de chamar o indicado (pedido do Arthur em 30/10/2026): ela interpreta o pedido
 * e, se faltar algo essencial (tipo de projeto, objetivo, o que não dizer...), pergunta ao Arthur uma dúvida
 * por vez, com botões e a opção de escrever. As respostas entram nas instruções antes da confirmação.
 *   duvidas = [{ pergunta, opcoes: [..], resposta }]
 */
alter table public.encomendas add column if not exists duvidas jsonb;
alter table public.encomendas drop constraint if exists encomendas_status_check;
alter table public.encomendas add constraint encomendas_status_check check (
  status in ('aguardando_instrucao', 'aguardando_contato', 'aguardando_resposta', 'aguardando_confirmacao', 'aguardando_modelo', 'contatado', 'cancelada')
);
