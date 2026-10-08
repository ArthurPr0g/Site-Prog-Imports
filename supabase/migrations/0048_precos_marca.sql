-- Novos preços de marca: Logo Essencial R$ 497, Identidade a partir do Logo
-- R$ 597 e Identidade Visual Completa R$ 997 (o combo dos dois, mais barato
-- que separados: R$ 1.094). Mesmos valores da página de planos.
--
-- Só dados. Orçamentos e prestações já lançados copiaram o valor e não mudam.

update public.internal_services set price = 497, updated_at = now() where name = 'Logo Essencial';
update public.internal_services set price = 597, updated_at = now() where name = 'Identidade a partir do Logo';
update public.internal_services
   set price = 997,
       description = 'Combo Logo Essencial + Identidade (separados: R$ 1.094). Logo criado do zero com 3 propostas e 3 rodadas de ajustes, manual da marca em PDF, cartão de visita, assinatura de e-mail, kit para redes sociais (perfil, capa e 5 modelos de post/story), elementos gráficos e padrões da marca, tudo aplicado no site ou na loja. Obrigatória quando o cliente não tem logo nem identidade visual.',
       updated_at = now()
 where name = 'Identidade Visual Completa';
