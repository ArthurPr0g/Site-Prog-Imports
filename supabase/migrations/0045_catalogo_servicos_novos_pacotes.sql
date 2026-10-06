-- Catálogo de serviços da Prog Soluções no formato novo: sites, lojas e sistema
-- de gestão em três níveis, combos com desconto, criação de marca e
-- mensalidades. É a mesma tabela publicada em portfolio-arthur-prog.vercel.app/#/planos.
--
-- Só dados, sem mudança de schema. Os serviços antigos que saíram da tabela são
-- DESATIVADOS, não apagados: orçamentos e prestações já lançados apontam para
-- eles (internal_service_id) e copiaram nome, valor e prazo, então nada do que
-- já foi fechado muda. Desativado, o serviço só some da lista de escolha.
--
-- Idempotente: inserir pelo nome evita duplicar se a migration rodar de novo.

update public.internal_services
   set active = false, updated_at = now()
 where name in ('Site Institucional', 'Sistema ERP Leve', 'Hospedagem Site Mensal');

-- Os serviços de Power BI continuam, só vão para o fim da lista.
update public.internal_services set position = 81, updated_at = now() where name = 'Dashboards Power BI';
update public.internal_services set position = 82, updated_at = now() where name = 'Mentoria - Power BI';

insert into public.internal_services (name, category, price, billing_type, lead_time_days, position, active, description)
select v.name, v.category, v.price, v.billing_type, v.lead_time_days, v.position, true, v.description
from (values
  -- Sites
  ('Site Essencial', 'Site', 1597, 'unico', 10, 11,
   'Até 5 páginas ou landing page única, modelo profissional com as cores e a logo do cliente, responsivo, botão de WhatsApp, formulário por e-mail e mapa, SEO básico e SSL. 2 rodadas de ajustes e 30 dias de suporte. Domínio .com.br grátis no 1º ano.'),
  ('Site Profissional', 'Site', 2997, 'unico', 14, 12,
   'Até 8 páginas com layout criado para a marca, animações ao rolar a página e ao passar o mouse e SEO completo. 2 rodadas de ajustes e 30 dias de suporte. Domínio .com.br grátis no 1º ano.'),
  ('Site Premium', 'Site', 5597, 'unico', 28, 13,
   'Até 15 páginas com design exclusivo e prévia aprovada antes de programar, animações avançadas e transições entre páginas, painel para editar todo o site com revisão dos textos, agendamento online ou área restrita (escolher um), SEO avançado, alta performance, acessibilidade e 1 integração com outro sistema. 3 rodadas de ajustes e 60 dias de suporte. Domínio .com.br grátis no 1º ano.'),

  -- Lojas
  ('Loja Essencial', 'E-commerce', 1997, 'unico', 14, 21,
   'Até 50 produtos sem variações (os 20 primeiros cadastrados pela Prog Soluções), carrinho com finalização pelo WhatsApp, frete por tabela fixa ou Melhor Envio e painel de pedidos e produtos. 2 rodadas de ajustes e 30 dias de suporte. Domínio .com.br grátis no 1º ano.'),
  ('Loja Profissional', 'E-commerce', 3597, 'unico', 28, 22,
   'Até 300 produtos com variações (tamanho, cor), boleto, parcelamento e cupons de desconto, frete grátis por valor ou região, retirada na loja e cálculo na hora, busca, filtros, avaliações e animações, área do cliente com e-mails automáticos, controle de estoque e relatório de vendas. 2 rodadas de ajustes e 60 dias de suporte. Domínio .com.br grátis no 1º ano.'),
  ('Loja Premium', 'E-commerce', 6997, 'unico', 28, 23,
   'Produtos ilimitados com página completa de gestão, design exclusivo e banners animados sob medida, favoritos, carrinho e busca inteligente, assinatura ou recorrência, rastreio do pedido por etapas, painel de vendas, dashboard e automações. 3 rodadas de ajustes e 90 dias de suporte. Domínio .com.br grátis no 1º ano.'),

  -- Sistema de gestão (ERP)
  ('Sistema de Gestão Básico', 'Sistema de gestão', 1997, 'unico', 14, 31,
   'Até 5 usuários com 2 perfis (administrador e operador), cadastro de clientes, fornecedores e produtos ou serviços, orçamentos e pedidos com PDF, estoque com alerta de estoque baixo, contas a pagar e a receber, fluxo de caixa e painel de indicadores. Backups diários, 1h de treinamento e 30 dias de suporte.'),
  ('Sistema de Gestão Intermediário', 'Sistema de gestão', 4597, 'unico', 28, 32,
   'Até 15 usuários com permissões, emissão de NF-e, NFC-e ou NFS-e (API fiscal cobrada à parte, cerca de R$ 100 a 200 por mês), Pix e boleto automáticos pelo Asaas com parcelamento, compras, comissões de vendedores e integração com a loja virtual, relatórios com filtros e exportação em Excel e PDF e registro de quem alterou o quê. 2 sessões de treinamento, manual e 60 dias de suporte.'),
  ('Sistema de Gestão Avançado', 'Sistema de gestão', 9597, 'unico', 52, 33,
   'Valor a partir de. Usuários ilimitados com permissões detalhadas, estoque por lote e validade ou por unidade, mensalidades e recorrência, contratos em PDF, trocas e devoluções, DRE simples, até 3 módulos sob medida (ex.: ordens de serviço, agenda, frota, várias empresas), relatórios do jeito do cliente e histórico completo de alterações. Treinamento por equipe e 90 dias de suporte.'),

  -- Combos: o sistema de gestão fica dentro do site, com o mesmo login
  ('Combo Start (Site Essencial + Gestão Básico)', 'Combo', 3197, 'unico', 18, 41,
   'Site Essencial + Sistema de Gestão Básico integrados no mesmo site e no mesmo login; só administradores veem o botão Site ⇄ Gestão. Desconto de combo já aplicado (separados: R$ 3.594). Domínio .com.br grátis no 1º ano.'),
  ('Combo Business (Site Profissional + Gestão Intermediário)', 'Combo', 6597, 'unico', 32, 42,
   'Site Profissional + Sistema de Gestão Intermediário integrados no mesmo site e no mesmo login; só administradores veem o botão Site ⇄ Gestão. Desconto de combo já aplicado (separados: R$ 7.594). Domínio .com.br grátis no 1º ano.'),
  ('Combo Enterprise (Site Premium + Gestão Avançado)', 'Combo', 12897, 'unico', 60, 43,
   'Valor a partir de. Site Premium + Sistema de Gestão Avançado integrados no mesmo site e no mesmo login; só administradores veem o botão Site ⇄ Gestão. Desconto de combo já aplicado (separados: R$ 15.194). Domínio .com.br grátis no 1º ano.'),
  ('Combo Loja Start (Loja Essencial + Gestão Básico)', 'Combo', 3497, 'unico', 20, 44,
   'Loja Essencial + Sistema de Gestão Básico integrados: cada pedido da loja vira venda no sistema, baixa o estoque e lança o valor no financeiro. Mesmo login, botão Site ⇄ Gestão só para administradores. Desconto de combo já aplicado (separados: R$ 3.994). Domínio .com.br grátis no 1º ano.'),
  ('Combo Loja Growth (Loja Profissional + Gestão Intermediário)', 'Combo', 7197, 'unico', 40, 45,
   'Loja Profissional + Sistema de Gestão Intermediário integrados: cada pedido da loja vira venda no sistema, baixa o estoque e lança o valor no financeiro. Mesmo login, botão Site ⇄ Gestão só para administradores. Desconto de combo já aplicado (separados: R$ 8.194). Domínio .com.br grátis no 1º ano.'),
  ('Combo Loja Enterprise (Loja Premium + Gestão Avançado)', 'Combo', 14097, 'unico', 65, 46,
   'Valor a partir de. Loja Premium + Sistema de Gestão Avançado integrados: cada pedido da loja vira venda no sistema, baixa o estoque e lança o valor no financeiro. Mesmo login, botão Site ⇄ Gestão só para administradores. Desconto de combo já aplicado (separados: R$ 16.594). Domínio .com.br grátis no 1º ano.'),

  -- Marca
  ('Logo Essencial', 'Marca', 497, 'unico', 7, 51,
   '2 propostas de logo criadas do zero, 2 rodadas de ajustes, versões horizontal, vertical e ícone, paleta de cores e fontes da marca, arquivos PNG, SVG e PDF (fundo claro e escuro), favicon e foto de perfil para redes sociais.'),
  ('Identidade Visual Completa', 'Marca', 1297, 'unico', 14, 52,
   'Tudo do Logo Essencial com 3 propostas e 3 rodadas de ajustes, manual da marca em PDF, cartão de visita, assinatura de e-mail, kit para redes sociais (perfil, capa e 5 modelos de post/story), elementos gráficos e padrões da marca, tudo aplicado no site ou na loja. Obrigatória quando o cliente não tem logo nem identidade visual.'),

  -- Mensalidades: hospedagem, banco de dados, backups, segurança e suporte
  ('Mensalidade Site', 'Mensalidade', 149, 'mensal', 0, 61,
   'Hospedagem, banco de dados, SSL, backups, atualizações de segurança, monitoramento e pequenos ajustes no mês.'),
  ('Mensalidade Loja', 'Mensalidade', 199, 'mensal', 0, 62,
   'Hospedagem da loja, banco de dados, SSL, backups, atualizações de segurança, monitoramento e pequenos ajustes no mês.'),
  ('Mensalidade Gestão Básico', 'Mensalidade', 199, 'mensal', 0, 63,
   'Hospedagem do sistema, banco de dados, backups diários, atualizações de segurança, monitoramento e suporte.'),
  ('Mensalidade Gestão Intermediário', 'Mensalidade', 249, 'mensal', 0, 64,
   'Hospedagem do sistema, banco de dados, backups diários, atualizações de segurança, monitoramento e suporte. A API de nota fiscal é cobrada à parte.'),
  ('Mensalidade Gestão Avançado', 'Mensalidade', 349, 'mensal', 0, 65,
   'Hospedagem do sistema, banco de dados, backups diários, atualizações de segurança, monitoramento e suporte. A API de nota fiscal é cobrada à parte.'),
  ('Mensalidade Combo Start', 'Mensalidade', 289, 'mensal', 0, 66,
   'Uma mensalidade só para site e sistema de gestão, com desconto (separadas: R$ 348).'),
  ('Mensalidade Combo Business', 'Mensalidade', 329, 'mensal', 0, 67,
   'Uma mensalidade só para site e sistema de gestão, com desconto (separadas: R$ 398).'),
  ('Mensalidade Combo Enterprise', 'Mensalidade', 419, 'mensal', 0, 68,
   'Uma mensalidade só para site e sistema de gestão, com desconto (separadas: R$ 498).'),
  ('Mensalidade Combo Loja Start', 'Mensalidade', 329, 'mensal', 0, 69,
   'Uma mensalidade só para loja e sistema de gestão, com desconto (separadas: R$ 398).'),
  ('Mensalidade Combo Loja Growth', 'Mensalidade', 379, 'mensal', 0, 70,
   'Uma mensalidade só para loja e sistema de gestão, com desconto (separadas: R$ 448).'),
  ('Mensalidade Combo Loja Enterprise', 'Mensalidade', 459, 'mensal', 0, 71,
   'Uma mensalidade só para loja e sistema de gestão, com desconto (separadas: R$ 548).')
) as v(name, category, price, billing_type, lead_time_days, position, description)
where not exists (select 1 from public.internal_services s where s.name = v.name);
