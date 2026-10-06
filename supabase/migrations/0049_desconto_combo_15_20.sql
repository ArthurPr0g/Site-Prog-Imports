-- Desconto dos combos (site ou loja + sistema de gestão) passa a 15% no nível
-- Essencial/Básico e Profissional/Intermediário, 20% no Premium/Avançado e 15%
-- em níveis diferentes, arredondado para baixo até terminar em 97. Mesmos
-- valores da página de planos e de src/lib/combo-servicos.ts.
--
-- Só dados. Orçamentos e prestações já lançados copiaram o valor e não mudam.

update public.internal_services as s
   set price = v.price, updated_at = now()
  from (values
    ('Combo Start (Site Essencial + Gestão Básico)', 2997),
    ('Combo Business (Site Profissional + Gestão Intermediário)', 6397),
    ('Combo Enterprise (Site Premium + Gestão Avançado)', 12097),
    ('Combo Loja Start (Loja Essencial + Gestão Básico)', 3297),
    ('Combo Loja Growth (Loja Profissional + Gestão Intermediário)', 6897),
    ('Combo Loja Enterprise (Loja Premium + Gestão Avançado)', 13197)
  ) as v(name, price)
 where s.name = v.name;
