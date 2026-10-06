-- Novo pacote de marca para quem já tem logo: a identidade visual é montada a
-- partir dele, mais barata que a completa (que cria o logo do zero). É o mesmo
-- valor da página de planos (portfolio-arthur-prog.vercel.app/#/planos).
--
-- Só dados. Idempotente: inserir pelo nome evita duplicar.

update public.internal_services set position = 53, updated_at = now() where name = 'Identidade Visual Completa';

insert into public.internal_services (name, category, price, billing_type, lead_time_days, position, active, description)
select 'Identidade a partir do Logo', 'Marca', 797, 'unico', 10, 52, true,
       'Para quem já tem logo: o logo atual revisado e vetorizado se precisar, paleta de cores e fontes da marca, manual da marca em PDF, cartão de visita, assinatura de e-mail, kit para redes sociais (perfil, capa e 5 modelos de post/story), tudo aplicado no site ou na loja. Obrigatória quando o cliente tem só o logo, sem identidade visual.'
where not exists (select 1 from public.internal_services where name = 'Identidade a partir do Logo');
