-- Atendente: escolhe o modelo da IA pelo momento da conversa (2026-10-28).
-- Pedido do dono: não gastar API à toa. Com auto_model ligado, o modelo da
-- configuração (model) fica para os momentos que decidem a venda (preço,
-- objeção, desconto, prazo, fechamento); a descoberta vai num modelo médio e
-- as confirmações curtas ("ok", "obrigado") num modelo leve.
alter table public.ia_config
  add column if not exists auto_model boolean not null default true;
