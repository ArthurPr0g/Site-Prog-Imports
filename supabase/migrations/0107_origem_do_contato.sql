/*
 * 0107 — Contato novo que chama a Lia sem o Arthur ter mandado antes (pedido do Arthur em 30/10/2026).
 * O webhook cria o lead (source 'whatsapp_direto') e a Lia pergunta como a pessoa chegou, com opções.
 * A resposta fica em leads.origem_contato:
 *   indicacao_arthur | site_loja | sistema | cliente | instagram_anuncio | outro
 * Aditiva.
 */
alter table public.leads add column if not exists origem_contato text
  check (origem_contato is null or origem_contato in ('indicacao_arthur', 'site_loja', 'sistema', 'cliente', 'instagram_anuncio', 'outro'));
comment on column public.leads.origem_contato is 'Como o contato que chamou primeiro disse que chegou (0107). Preenchido pela Lia (registrar_origem).';
