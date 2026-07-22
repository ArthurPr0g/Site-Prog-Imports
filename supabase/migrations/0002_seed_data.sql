-- ============ BRANDS ============
insert into public.brands (name) values
  ('Apple'), ('Alienware'), ('ASUS'), ('Acer'), ('Lenovo'),
  ('LG'), ('Samsung'), ('Keychron'), ('Logitech'), ('Dell')
on conflict (name) do nothing;

-- ============ CATEGORIES ============
insert into public.categories (name, glyph, position) values
  ('MacBook', 'MB', 1),
  ('iPhone', 'IP', 2),
  ('iPad / Tablet', 'iP', 3),
  ('Notebook Gamer', 'NG', 4),
  ('Notebook Trabalho', 'NT', 5),
  ('Notebook Estudos', 'NE', 6),
  ('Notebooks para IA', 'IA', 7),
  ('Monitores', 'MO', 8),
  ('Periféricos', 'PF', 9),
  ('Peças e upgrades', 'PU', 10)
on conflict (name) do nothing;

-- ============ COLLECTIONS ============
insert into public.collections (name) values
  ('Lançamentos'), ('Promoções'), ('Mais vendidos')
on conflict (name) do nothing;

-- ============ PRODUCTS ============
insert into public.products (name, sku, brand_id, category_id, price, promo_price, stock, active, description, rating, review_count)
values
(
  'iPhone 16 Pro Max 256GB Titânio', 'IP16PM-256',
  (select id from public.brands where name = 'Apple'),
  (select id from public.categories where name = 'iPhone'),
  9899, 8999, 7, true,
  'O iPhone mais avançado de todos os tempos, importado com procedência e garantia. Titânio de grau aeroespacial, sistema de câmeras de 48MP com zoom óptico 5x e o chip A18 Pro que entrega desempenho de ponta para jogos, edição de vídeo e inteligência artificial on-device. Tela Super Retina XDR de 6,9" com ProMotion 120Hz.',
  4.8, 41
),
(
  'MacBook Pro 14" M4 Pro 24GB/512GB', 'MBP14-M4P',
  (select id from public.brands where name = 'Apple'),
  (select id from public.categories where name = 'MacBook'),
  16499, null, 4, true,
  'Potência profissional para criadores, desenvolvedores e empresários. O chip M4 Pro entrega desempenho excepcional de CPU e GPU com eficiência energética incomparável. Tela Liquid Retina XDR de 14,2" com brilho de até 1600 nits e até 22 horas de bateria em uso típico.',
  4.9, 33
),
(
  'Alienware Area-51 16" RTX 5080 · 32GB · 2TB', 'AW51-5080',
  (select id from public.brands where name = 'Alienware'),
  (select id from public.categories where name = 'Notebook Gamer'),
  27499, 24999, 2, true,
  'O Alienware Area-51 16" é o notebook gamer definitivo — um modelo exclusivo do mercado americano que a Prog Imports traz direto dos EUA para você. Equipado com a nova NVIDIA GeForce RTX 5080 e processador Intel Core Ultra 9, ele entrega performance de desktop em um chassi portátil com o lendário design Legend 3. A tela QHD+ de 16" com 240Hz e 100% DCI-P3 garante imagens fluidas e cores precisas tanto para jogos competitivos quanto para criação de conteúdo. O sistema de refrigeração Cryo-tech com câmara de vapor mantém o desempenho máximo mesmo em sessões longas. Com 32GB de memória DDR5 e SSD de 2TB, é a máquina ideal para gamers exigentes, criadores de conteúdo e profissionais que trabalham com IA.',
  4.9, 23
),
(
  'iPad Pro 13" M4 256GB Wi-Fi', 'IPD13-M4',
  (select id from public.brands where name = 'Apple'),
  (select id from public.categories where name = 'iPad / Tablet'),
  10499, null, 9, true,
  'O iPad mais fino já criado, com o revolucionário chip M4. Tela Ultra Retina XDR com tecnologia Tandem OLED, brilho excepcional e cores vibrantes. Compatível com Apple Pencil Pro e Magic Keyboard para transformar produtividade e criatividade.',
  4.8, 19
),
(
  'ASUS ROG Strix G16 RTX 4070 16GB', 'ROG16-4070',
  (select id from public.brands where name = 'ASUS'),
  (select id from public.categories where name = 'Notebook Gamer'),
  10999, 9799, 6, true,
  'Desempenho gamer de alto nível com a placa de vídeo NVIDIA GeForce RTX 4070, processador Intel Core i9 de última geração e tela de 240Hz. Sistema de refrigeração ROG Intelligent Cooling mantém temperaturas baixas mesmo em sessões intensas de jogo.',
  4.7, 28
),
(
  'Monitor LG UltraGear 27" QHD 240Hz', 'LG27-240',
  (select id from public.brands where name = 'LG'),
  (select id from public.categories where name = 'Monitores'),
  2899, null, 12, true,
  'Monitor gamer QHD de 27" com taxa de atualização de 240Hz e tempo de resposta de 1ms. Compatível com NVIDIA G-Sync e AMD FreeSync Premium para jogos ultra fluidos e sem tearing. Painel Nano IPS com cobertura de 98% DCI-P3.',
  4.7, 52
),
(
  'Teclado Keychron Q1 Pro Mecânico', 'KC-Q1P',
  (select id from public.brands where name = 'Keychron'),
  (select id from public.categories where name = 'Periféricos'),
  1299, null, 3, true,
  'Teclado mecânico premium com corpo em alumínio CNC, conectividade sem fio Bluetooth 5.1 e cabo USB-C destacável. Switches hot-swappable e iluminação RGB por tecla totalmente customizável via QMK/VIA.',
  4.9, 17
),
(
  'SSD Samsung 990 Pro 2TB NVMe', 'SS990-2T',
  (select id from public.brands where name = 'Samsung'),
  (select id from public.categories where name = 'Peças e upgrades'),
  1449, 1199, 21, true,
  'SSD NVMe PCIe Gen4 com velocidades de leitura de até 7.450MB/s. Ideal para upgrade de notebooks e desktops, com dissipador de calor integrado e tecnologia de proteção térmica dinâmica para desempenho sustentado.',
  4.8, 64
),
(
  'Lenovo ThinkPad X1 Carbon Gen 12', 'TPX1C-G12',
  (select id from public.brands where name = 'Lenovo'),
  (select id from public.categories where name = 'Notebook Trabalho'),
  13999, null, 8, true,
  'O clássico dos notebooks corporativos, agora com processadores Intel Core Ultra e até 30% mais leve. Chassi em fibra de carbono com certificação militar de resistência, teclado premiado e até 24 horas de bateria para o profissional que não pode parar.',
  4.8, 21
),
(
  'Acer Aspire 5 Intel Core i5 13ª Geração', 'ASP5-I5G13',
  (select id from public.brands where name = 'Acer'),
  (select id from public.categories where name = 'Notebook Estudos'),
  4299, null, 15, true,
  'Notebook versátil para estudos e uso diário, com processador Intel Core i5 de 13ª geração, tela Full HD antirreflexo e bateria de longa duração. Leve, silencioso e pronto para acompanhar sua rotina acadêmica.',
  4.6, 38
),
(
  'Dell Precision 5680 Mobile Workstation', 'DP5680-WS',
  (select id from public.brands where name = 'Dell'),
  (select id from public.categories where name = 'Notebooks para IA'),
  22999, null, 3, true,
  'Workstation móvel de alta performance para machine learning, ciência de dados e renderização 3D. Processador Intel Core i9 HX, GPU NVIDIA RTX profissional com suporte CUDA e até 64GB de memória ECC para cargas de trabalho intensas.',
  4.9, 12
)
on conflict (sku) do nothing;

-- ============ PRODUCT COLLECTIONS ============
insert into public.product_collections (product_id, collection_id)
select p.id, c.id from public.products p, public.collections c
where (p.sku, c.name) in (
  ('IP16PM-256', 'Promoções'), ('IP16PM-256', 'Mais vendidos'),
  ('MBP14-M4P', 'Lançamentos'), ('MBP14-M4P', 'Mais vendidos'),
  ('AW51-5080', 'Lançamentos'),
  ('IPD13-M4', 'Lançamentos'),
  ('ROG16-4070', 'Promoções'), ('ROG16-4070', 'Mais vendidos'),
  ('LG27-240', 'Mais vendidos'),
  ('SS990-2T', 'Promoções'),
  ('TPX1C-G12', 'Lançamentos'),
  ('DP5680-WS', 'Lançamentos')
)
on conflict do nothing;

-- ============ PRODUCT IMAGES ============
insert into public.product_images (product_id, label, position)
select p.id, img.label, img.pos
from public.products p
join (values
  ('IP16PM-256', 'iphone 16 pro max frontal', 0),
  ('IP16PM-256', 'iphone 16 pro max traseira', 1),
  ('IP16PM-256', 'iphone 16 pro max câmeras', 2),
  ('IP16PM-256', 'iphone 16 pro max na caixa', 3),
  ('IP16PM-256', 'iphone 16 pro max cores', 4),
  ('MBP14-M4P', 'macbook pro 14 m4 fechado', 0),
  ('MBP14-M4P', 'macbook pro 14 m4 aberto', 1),
  ('MBP14-M4P', 'macbook pro 14 m4 teclado', 2),
  ('MBP14-M4P', 'macbook pro 14 m4 portas laterais', 3),
  ('MBP14-M4P', 'macbook pro 14 m4 tela liquid retina', 4),
  ('AW51-5080', 'alienware area-51 frontal', 0),
  ('AW51-5080', 'alienware area-51 aberto', 1),
  ('AW51-5080', 'alienware area-51 teclado rgb', 2),
  ('AW51-5080', 'alienware area-51 traseira', 3),
  ('AW51-5080', 'alienware area-51 lateral portas', 4),
  ('IPD13-M4', 'ipad pro 13 m4 frontal', 0),
  ('IPD13-M4', 'ipad pro 13 m4 com apple pencil', 1),
  ('IPD13-M4', 'ipad pro 13 m4 com magic keyboard', 2),
  ('IPD13-M4', 'ipad pro 13 m4 traseira', 3),
  ('IPD13-M4', 'ipad pro 13 m4 lateral fino', 4),
  ('ROG16-4070', 'asus rog strix g16 frontal', 0),
  ('ROG16-4070', 'asus rog strix g16 aberto', 1),
  ('ROG16-4070', 'asus rog strix g16 teclado rgb', 2),
  ('ROG16-4070', 'asus rog strix g16 traseira', 3),
  ('ROG16-4070', 'asus rog strix g16 portas', 4),
  ('LG27-240', 'monitor lg ultragear frontal', 0),
  ('LG27-240', 'monitor lg ultragear lateral fino', 1),
  ('LG27-240', 'monitor lg ultragear traseira suporte', 2),
  ('LG27-240', 'monitor lg ultragear conexões', 3),
  ('LG27-240', 'monitor lg ultragear em uso gamer', 4),
  ('KC-Q1P', 'teclado keychron q1 pro frontal', 0),
  ('KC-Q1P', 'teclado keychron q1 pro lateral alumínio', 1),
  ('KC-Q1P', 'teclado keychron q1 pro switches', 2),
  ('KC-Q1P', 'teclado keychron q1 pro rgb aceso', 3),
  ('KC-Q1P', 'teclado keychron q1 pro cabo usb-c', 4),
  ('SS990-2T', 'ssd samsung 990 pro frontal', 0),
  ('SS990-2T', 'ssd samsung 990 pro dissipador', 1),
  ('SS990-2T', 'ssd samsung 990 pro caixa', 2),
  ('SS990-2T', 'ssd samsung 990 pro conector nvme', 3),
  ('SS990-2T', 'ssd samsung 990 pro instalado', 4),
  ('TPX1C-G12', 'lenovo thinkpad x1 carbon frontal', 0),
  ('TPX1C-G12', 'lenovo thinkpad x1 carbon aberto', 1),
  ('TPX1C-G12', 'lenovo thinkpad x1 carbon teclado', 2),
  ('TPX1C-G12', 'lenovo thinkpad x1 carbon fibra de carbono', 3),
  ('TPX1C-G12', 'lenovo thinkpad x1 carbon portas', 4),
  ('ASP5-I5G13', 'acer aspire 5 frontal', 0),
  ('ASP5-I5G13', 'acer aspire 5 aberto', 1),
  ('ASP5-I5G13', 'acer aspire 5 teclado', 2),
  ('ASP5-I5G13', 'acer aspire 5 tela full hd', 3),
  ('ASP5-I5G13', 'acer aspire 5 portas', 4),
  ('DP5680-WS', 'dell precision 5680 frontal', 0),
  ('DP5680-WS', 'dell precision 5680 aberto', 1),
  ('DP5680-WS', 'dell precision 5680 teclado', 2),
  ('DP5680-WS', 'dell precision 5680 lateral portas', 3),
  ('DP5680-WS', 'dell precision 5680 workstation em uso', 4)
) as img(sku, label, pos) on p.sku = img.sku;

-- ============ PRODUCT SPECS ============
insert into public.product_specs (product_id, k, v, position)
select p.id, s.k, s.v, s.pos
from public.products p
join (values
  ('IP16PM-256', 'Tela', 'Super Retina XDR 6,9" ProMotion 120Hz', 0),
  ('IP16PM-256', 'Chip', 'Apple A18 Pro', 1),
  ('IP16PM-256', 'Câmera', 'Sistema triplo 48MP + zoom óptico 5x', 2),
  ('IP16PM-256', 'Armazenamento', '256GB', 3),
  ('IP16PM-256', 'Bateria', 'Até 33h de reprodução de vídeo', 4),
  ('IP16PM-256', 'Material', 'Titânio grau 5', 5),
  ('IP16PM-256', 'Conectividade', '5G, Wi-Fi 7, USB-C', 6),
  ('IP16PM-256', 'Sistema', 'iOS 18', 7),
  ('IP16PM-256', 'Garantia', '12 meses Prog Imports + Apple', 8),
  ('MBP14-M4P', 'Chip', 'Apple M4 Pro (14-core CPU, 20-core GPU)', 0),
  ('MBP14-M4P', 'Memória', '24GB unificada', 1),
  ('MBP14-M4P', 'Armazenamento', 'SSD 512GB', 2),
  ('MBP14-M4P', 'Tela', 'Liquid Retina XDR 14,2" 120Hz', 3),
  ('MBP14-M4P', 'Bateria', 'Até 22 horas', 4),
  ('MBP14-M4P', 'Conectividade', '3x Thunderbolt 5, HDMI, SDXC, Wi-Fi 6E', 5),
  ('MBP14-M4P', 'Sistema', 'macOS Sequoia', 6),
  ('MBP14-M4P', 'Garantia', '12 meses Prog Imports + AppleCare', 7),
  ('AW51-5080', 'Processador', 'Intel Core Ultra 9 275HX (24 núcleos, até 5.4GHz)', 0),
  ('AW51-5080', 'Placa de vídeo', 'NVIDIA GeForce RTX 5080 16GB GDDR7', 1),
  ('AW51-5080', 'Memória', '32GB DDR5 6400MT/s (2x16GB, expansível até 64GB)', 2),
  ('AW51-5080', 'Armazenamento', 'SSD 2TB NVMe PCIe Gen5', 3),
  ('AW51-5080', 'Tela', '16" QHD+ (2560x1600) 240Hz, 100% DCI-P3, G-Sync', 4),
  ('AW51-5080', 'Teclado', 'Mecânico Cherry MX ultra low-profile, RGB por tecla', 5),
  ('AW51-5080', 'Refrigeração', 'Alienware Cryo-tech com câmara de vapor', 6),
  ('AW51-5080', 'Conectividade', 'Wi-Fi 7, Bluetooth 5.4, Thunderbolt 5, HDMI 2.1', 7),
  ('AW51-5080', 'Sistema', 'Windows 11 Pro (em português)', 8),
  ('AW51-5080', 'Garantia', '12 meses Prog Imports + suporte pós-venda', 9),
  ('IPD13-M4', 'Chip', 'Apple M4', 0),
  ('IPD13-M4', 'Tela', 'Ultra Retina XDR 13" Tandem OLED', 1),
  ('IPD13-M4', 'Armazenamento', '256GB', 2),
  ('IPD13-M4', 'Conectividade', 'Wi-Fi 6E, USB-C Thunderbolt', 3),
  ('IPD13-M4', 'Acessórios compatíveis', 'Apple Pencil Pro, Magic Keyboard', 4),
  ('IPD13-M4', 'Garantia', '12 meses Prog Imports + Apple', 5),
  ('ROG16-4070', 'Processador', 'Intel Core i9-14900HX', 0),
  ('ROG16-4070', 'Placa de vídeo', 'NVIDIA GeForce RTX 4070 8GB', 1),
  ('ROG16-4070', 'Memória', '16GB DDR5', 2),
  ('ROG16-4070', 'Armazenamento', 'SSD 1TB NVMe', 3),
  ('ROG16-4070', 'Tela', '16" QHD+ 240Hz', 4),
  ('ROG16-4070', 'Refrigeração', 'ROG Intelligent Cooling', 5),
  ('ROG16-4070', 'Sistema', 'Windows 11 Home', 6),
  ('ROG16-4070', 'Garantia', '12 meses Prog Imports', 7),
  ('LG27-240', 'Tamanho', '27" QHD (2560x1440)', 0),
  ('LG27-240', 'Taxa de atualização', '240Hz', 1),
  ('LG27-240', 'Tempo de resposta', '1ms (GtG)', 2),
  ('LG27-240', 'Painel', 'Nano IPS 98% DCI-P3', 3),
  ('LG27-240', 'Sincronização', 'NVIDIA G-Sync / AMD FreeSync Premium', 4),
  ('LG27-240', 'Garantia', '12 meses Prog Imports', 5),
  ('KC-Q1P', 'Layout', 'ANSI 75%', 0),
  ('KC-Q1P', 'Switches', 'Gateron Pro hot-swappable', 1),
  ('KC-Q1P', 'Corpo', 'Alumínio CNC', 2),
  ('KC-Q1P', 'Conectividade', 'Bluetooth 5.1 / USB-C com fio', 3),
  ('KC-Q1P', 'Iluminação', 'RGB por tecla, custom via QMK/VIA', 4),
  ('SS990-2T', 'Interface', 'PCIe Gen4 NVMe M.2', 0),
  ('SS990-2T', 'Capacidade', '2TB', 1),
  ('SS990-2T', 'Leitura sequencial', 'até 7.450MB/s', 2),
  ('SS990-2T', 'Escrita sequencial', 'até 6.900MB/s', 3),
  ('SS990-2T', 'Garantia', '5 anos do fabricante', 4),
  ('TPX1C-G12', 'Processador', 'Intel Core Ultra 7', 0),
  ('TPX1C-G12', 'Memória', '16GB LPDDR5x', 1),
  ('TPX1C-G12', 'Armazenamento', 'SSD 512GB NVMe', 2),
  ('TPX1C-G12', 'Tela', '14" 2.8K OLED', 3),
  ('TPX1C-G12', 'Chassi', 'Fibra de carbono, certificação militar MIL-STD-810H', 4),
  ('TPX1C-G12', 'Bateria', 'Até 24 horas', 5),
  ('TPX1C-G12', 'Garantia', '12 meses Prog Imports', 6),
  ('ASP5-I5G13', 'Processador', 'Intel Core i5 13ª geração', 0),
  ('ASP5-I5G13', 'Memória', '8GB DDR4', 1),
  ('ASP5-I5G13', 'Armazenamento', 'SSD 512GB NVMe', 2),
  ('ASP5-I5G13', 'Tela', '15,6" Full HD antirreflexo', 3),
  ('ASP5-I5G13', 'Garantia', '12 meses Prog Imports', 4),
  ('DP5680-WS', 'Processador', 'Intel Core i9 HX', 0),
  ('DP5680-WS', 'Placa de vídeo', 'NVIDIA RTX profissional (CUDA)', 1),
  ('DP5680-WS', 'Memória', '64GB DDR5 ECC', 2),
  ('DP5680-WS', 'Armazenamento', 'SSD 2TB NVMe', 3),
  ('DP5680-WS', 'Tela', '16" 4K OLED touch', 4),
  ('DP5680-WS', 'Certificações', 'ISV certified (Autodesk, Adobe)', 5),
  ('DP5680-WS', 'Garantia', '12 meses Prog Imports', 6)
) as s(sku, k, v, pos) on p.sku = s.sku;

-- ============ RELATED PRODUCTS ============
insert into public.product_related (product_id, related_id)
select p1.id, p2.id from public.products p1, public.products p2
where (p1.sku, p2.sku) in (
  ('AW51-5080', 'ROG16-4070'), ('AW51-5080', 'LG27-240'), ('AW51-5080', 'KC-Q1P'), ('AW51-5080', 'SS990-2T'),
  ('ROG16-4070', 'AW51-5080'), ('ROG16-4070', 'LG27-240'), ('ROG16-4070', 'KC-Q1P'), ('ROG16-4070', 'SS990-2T'),
  ('MBP14-M4P', 'IPD13-M4'), ('MBP14-M4P', 'IP16PM-256'), ('MBP14-M4P', 'TPX1C-G12'),
  ('IP16PM-256', 'IPD13-M4'), ('IP16PM-256', 'MBP14-M4P')
)
on conflict do nothing;

-- ============ REVIEWS ============
insert into public.reviews (product_id, author_name, rating, text)
select p.id, r.author, r.rating, r.text
from public.products p
join (values
  ('AW51-5080', 'Pedro H.', 5, 'Máquina absurda. Roda tudo no ultra em QHD acima de 200fps. A importação foi acompanhada passo a passo pelo site, transparência total.'),
  ('AW51-5080', 'Marcos V.', 5, 'Comprei para trabalhar com IA e renderização. A RTX 5080 mobile surpreende. Chegou em 18 dias, lacrado e com nota.'),
  ('AW51-5080', 'Thiago R.', 4, 'Notebook impecável, atendimento nota 10. Só achei o carregador grande, mas é o preço da potência. Recomendo a Prog.'),
  ('IP16PM-256', 'Amanda S.', 5, 'Tinha receio de comprar importado, mas a Prog me passou segurança o tempo todo. iPhone original, com nota e garantia.'),
  ('IP16PM-256', 'Rafael M.', 5, 'Câmera impressionante e a bateria dura o dia todo. Chegou muito bem embalado.'),
  ('MBP14-M4P', 'Rafael M.', 5, 'Atendimento impecável do início ao fim. Acompanhei cada etapa da importação e o MacBook chegou lacrado, antes do prazo.'),
  ('MBP14-M4P', 'Camila F.', 5, 'Performance excelente para edição de vídeo. Silencioso mesmo sob carga pesada.'),
  ('ROG16-4070', 'Lucas T.', 5, 'Ótimo custo-benefício para quem quer RTX sem pagar preço de importado exclusivo.'),
  ('ROG16-4070', 'Bruno A.', 4, 'Muito bom, só a bateria que não dura tanto em uso intenso — mas é esperado num notebook gamer.'),
  ('LG27-240', 'Diego M.', 5, 'Cores excelentes e a fluidez em 240Hz faz muita diferença em jogos competitivos.'),
  ('KC-Q1P', 'Felipe N.', 5, 'Acabamento de alumínio impecável, som "thocky" excelente. Melhor teclado que já tive.'),
  ('SS990-2T', 'Gustavo R.', 5, 'Velocidade absurda, instalei no meu notebook e o boot ficou quase instantâneo.'),
  ('TPX1C-G12', 'Juliana P.', 5, 'Perfeito para trabalho remoto. Leve, bateria dura o dia inteiro e a tela é linda.'),
  ('ASP5-I5G13', 'Vinícius C.', 4, 'Ótimo custo-benefício para a faculdade. Roda tudo que preciso sem travar.'),
  ('DP5680-WS', 'Renata L.', 5, 'Uso para treinar modelos e renderizar em 3D — potência de sobra e certificações que precisava para o trabalho.')
) as r(sku, author, rating, text) on p.sku = r.sku;

-- ============ COUPONS ============
insert into public.coupons (code, pct, active, uses) values
  ('PROG10', 10, true, 132),
  ('BEMVINDO', 5, true, 89),
  ('GAMER15', 15, false, 24)
on conflict (code) do nothing;

-- ============ BANNERS ============
insert into public.banners (position, tag, title, subtitle, image_label, product_id) values
  (1, 'Novo · Direto dos EUA', 'iPhone 16 Pro Max', 'O iPhone mais avançado de todos os tempos, importado com procedência e garantia. Titânio, câmera de 48MP e o chip A18 Pro.', 'iphone 16 pro max hero', (select id from public.products where sku = 'IP16PM-256')),
  (2, 'Exclusivo Estados Unidos', 'Alienware Area-51 16"', 'O notebook gamer definitivo, exclusivo do mercado americano. RTX 5080, tela QHD+ 240Hz e refrigeração Cryo-tech.', 'alienware area-51 hero', (select id from public.products where sku = 'AW51-5080')),
  (3, 'Performance profissional', 'MacBook Pro M4 Pro', 'Potência para criadores, devs e empresários. Chip M4 Pro, tela Liquid Retina XDR e até 22h de bateria.', 'macbook pro hero', (select id from public.products where sku = 'MBP14-M4P'));

-- ============ SERVICES ============
insert into public.services (name, price_label, glyph, description, position) values
  ('Limpeza preventiva', 'a partir de R$ 149', 'LP', 'Limpeza interna completa com troca de pasta térmica.', 1),
  ('Troca de SSD', 'a partir de R$ 99', 'SD', 'Upgrade de armazenamento com clonagem de dados.', 2),
  ('Upgrade de RAM', 'a partir de R$ 89', 'RM', 'Mais memória para multitarefa e jogos.', 3),
  ('Formatação', 'a partir de R$ 129', 'FM', 'Sistema limpo, rápido e com backup dos seus arquivos.', 4),
  ('Manutenção especializada', 'sob consulta', 'MT', 'Diagnóstico e reparo por técnicos experientes.', 5);

-- ============ TESTIMONIALS ============
insert into public.testimonials (name, text, bought, position) values
  ('Rafael M.', 'Atendimento impecável do início ao fim. Acompanhei cada etapa da importação e o MacBook chegou lacrado, antes do prazo. Virei cliente fiel.', 'Comprou MacBook Pro M4', 1),
  ('Lucas T.', 'Consegui um modelo que não existe no Brasil por um preço muito melhor que qualquer importadora. Transparência total no rastreamento.', 'Comprou Alienware Area-51', 2),
  ('Amanda S.', 'Tinha receio de comprar importado, mas a Prog me passou segurança o tempo todo. iPhone original, com nota e garantia. Recomendo demais!', 'Comprou iPhone 16 Pro', 3);
