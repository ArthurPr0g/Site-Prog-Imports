-- Mensalidade do combo passa a ser a maior das duas (a outra sai), em vez da
-- soma com 15% de desconto. É a mesma regra do orçamento de serviço (fica só a
-- mensalidade mais cara) e da página de planos.
--
-- Só dados. Orçamentos e prestações já lançados copiaram o valor e não mudam.

update public.internal_services as s
   set price = v.price,
       description = v.description,
       updated_at = now()
  from (values
    ('Mensalidade Combo Start', 199, 'Uma mensalidade só para site e sistema de gestão: vale a maior das duas (separadas: R$ 348).'),
    ('Mensalidade Combo Business', 249, 'Uma mensalidade só para site e sistema de gestão: vale a maior das duas (separadas: R$ 398).'),
    ('Mensalidade Combo Enterprise', 349, 'Uma mensalidade só para site e sistema de gestão: vale a maior das duas (separadas: R$ 498).'),
    ('Mensalidade Combo Loja Start', 199, 'Uma mensalidade só para loja e sistema de gestão: vale a maior das duas (separadas: R$ 398).'),
    ('Mensalidade Combo Loja Growth', 249, 'Uma mensalidade só para loja e sistema de gestão: vale a maior das duas (separadas: R$ 448).'),
    ('Mensalidade Combo Loja Enterprise', 349, 'Uma mensalidade só para loja e sistema de gestão: vale a maior das duas (separadas: R$ 548).')
  ) as v(name, price, description)
 where s.name = v.name;
