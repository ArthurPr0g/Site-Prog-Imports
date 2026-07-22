# Handoff: E-commerce Prog Imports

## Overview
E-commerce completo para a **Prog Imports**, importadora de tecnologia premium (foco: EUA). Quatro superfícies: **loja (home)**, **página de produto**, **área do cliente com rastreamento de pedidos em timeline** e **painel administrativo**. Público: gamers, profissionais de TI, clientes Apple, criadores de conteúdo (homens 18–45). A venda hoje fecha via **WhatsApp** — o checkout gera uma mensagem pré-preenchida para o número da loja.

## About the Design Files
Os arquivos `.dc.html` neste pacote são **referências de design criadas em HTML** — protótipos navegáveis que mostram aparência e comportamento pretendidos, **não código de produção para copiar diretamente**. A tarefa é **recriar estes designs no ambiente do codebase alvo** (Next.js/React, Vue, etc.) usando seus padrões e bibliotecas. Se ainda não existe codebase, recomenda-se Next.js + Tailwind + Prisma/Postgres (produtos, pedidos, clientes, cupons precisam de banco real) — mas a escolha é livre. Abra os arquivos no navegador para navegar no protótipo; o código-fonte de cada um contém todos os valores exatos (o markup está dentro de `<x-dc>`, a lógica em uma classe JS no final do arquivo).

## Fidelity
**High-fidelity (hifi).** Cores, tipografia, espaçamentos, raios, sombras e microinterações são finais e devem ser recriados fielmente. As **imagens de produtos são placeholders** (padrão listrado com rótulo monospace `[ foto: … ]`) — substituir por fotos reais. Dados (produtos, preços, pedidos, clientes, depoimentos) são exemplos realistas que viram registros de banco.

## Design Tokens

### Cores
| Token | Valor | Uso |
|---|---|---|
| Fundo página | `#0a0a0c` | body |
| Fundo card | `#111114` | cards, tabelas, sidebar-cards |
| Fundo card escuro | `#0d0d11` | sidebar admin, footer |
| Fundo input | `#0a0a0c` ou `#151518` | inputs, chips |
| Borda padrão | `#1f1f26` / `#26262b` | cards / inputs |
| Borda hover | `#2e2e36` ou `rgba(242,135,5,.4–.55)` | |
| Divisor de linha | `#17171b` / `#1c1c21` | linhas de tabela / header |
| Texto principal | `#f4f4f5` | |
| Texto secundário | `#a8a8b0` | |
| Texto terciário | `#7a7a84` | |
| Texto apagado | `#5b5b63` | placeholders, monospace |
| **Accent (laranja)** | `#F28705` | CTAs, badges, indicadores, links hover — usar com parcimônia |
| Sucesso | `#4ade80` | status Pago/Entregue/Ativo |
| Info | `#60a5fa` | status Enviado/Em transporte |
| Alerta | `#d9a441` | Aguardando pagamento |
| Erro | `#e05555` | Cancelado, estoque baixo, excluir |

Badges de status: `background: rgba(cor,.1)`, `border: 1px solid rgba(cor,.35)`, texto na cor cheia, `border-radius: 99px`.

### Tipografia
- **Display/headings**: `Space Grotesk` 700, letter-spacing `-.02em` (H1 26–56px, H2 28–36px, preços 18–38px)
- **Corpo/UI**: `Manrope` 400–800 (corpo 13–15.5px; labels 11–12px, weight 700–800, uppercase, letter-spacing `.08–.14em`)
- **Monospace** (SKU, rótulos de placeholder, código de rastreio): fonte mono do sistema, 10–14px
- Google Fonts: `Space+Grotesk:wght@400;500;600;700` e `Manrope:wght@400;500;600;700;800`

### Geometria
- Radius: botões/inputs `12px`, cards `18–22px`, seções hero/institucional `28px`, pills/badges/botões-ícone `99px`
- Container: `max-width: 1280px` (loja), `1180px` (área do cliente); padding lateral `24px`
- Sombras: CTA laranja `0 8px 28–32px rgba(242,135,5,.3–.35)` (hover: mais forte + `translateY(-2px)`); cards hover `0 24px 48px rgba(0,0,0,.45)`; modais `0 40px 100px rgba(0,0,0,.7)`
- Header fixo: `position: sticky`, `background: rgba(10,10,12,.82)`, `backdrop-filter: blur(18px)`, borda inferior `#1c1c21`

### Animações
- Transições padrão: `all .2–.3s`; cards hover `translateY(-3 a -5px)`
- Hero: crossfade/slide-up `.7s ease` a cada troca (autoplay 6s), glow radial laranja pulsando (`heroGlow` 7s)
- Marquee de marcas: translateX infinito 26s, mask-image fade nas bordas
- Etapa atual da timeline: `pulse` box-shadow laranja 2s infinito
- Toast: fade+rise `.3s`, some após 2.4s
- Drawer do carrinho: `transform .4s cubic-bezier(.22,1,.36,1)`

## Screens / Views

### 1. Home (`Prog Imports - Home.dc.html`)
1. **Barra promo** — fundo `#F28705`, texto preto 13px/700: "FRETE GRÁTIS em compras acima de R$ 5.000 · Importados direto dos EUA · Parcele em até 12x"
2. **Header sticky** — logo (52px), nav (MacBooks, iPhones, Notebooks Gamer, Monitores, Serviços), busca central pill com **sugestões ao digitar** (dropdown com nome/categoria/preço; clicar adiciona ao carrinho no protótipo — no real, navega ao produto), botões Entrar / Favoritos (badge contador) / Carrinho (badge contador)
3. **Hero carrossel** — card 28px radius, min-height 520px, grid 2 colunas; 3 slides (iPhone 16 Pro Max, Alienware Area-51 exclusivo EUA, MacBook Pro M4): tag pill laranja, título 56px, subtítulo, CTA "Comprar agora" + preço/parcelamento; dots animados (ativo vira barra 28px); autoplay 6s
4. **Marquee de marcas** — APPLE, ALIENWARE, ASUS ROG, ACER, LENOVO, LG, SAMSUNG, LOGITECH, DELL em `#3c3c44`
5. **Categorias** — grid auto-fill minmax(190px,1fr); 9 cards: MacBook, iPad/Tablet, Notebooks Gamer, Notebook Trabalho, Notebook Estudos, Notebooks para IA, Monitores, Periféricos, Serviços; chip-glyph laranja + nome + contagem; hover: borda laranja + lift
6. **Produtos em destaque** — filtros pill (Todos, Lançamentos, Promoções, Mais vendidos) + grid minmax(280px,1fr); card: imagem 210px com badge promo e coração de favoritar, categoria uppercase, nome, preço riscado (se promo), preço Space Grotesk 22px, "ou 12x de X sem juros", botão "Adicionar ao carrinho" (cinza → laranja no hover)
7. **Institucional** — card gradiente com 6 diferenciais numerados (01–06): Importação legalizada, Garantia real, Exclusivos dos EUA, Atendimento personalizado, Suporte pós-venda, Qualidade garantida
8. **Serviços** — 5 cards: Limpeza preventiva (R$ 149), Troca de SSD (R$ 99), Upgrade de RAM (R$ 89), Formatação (R$ 129), Manutenção especializada (sob consulta)
9. **Depoimentos** — 3 cards com 5 estrelas laranja, texto, avatar-inicial; link `@Prog.imports ↗` para o Instagram
10. **Newsletter** — card com glow, input + botão "Cadastrar"; sucesso troca por pill de confirmação
11. **Footer** — 4 colunas: logo+descrição, Institucional, Contato (WhatsApp (62) 98213-3188, Instagram @Prog.imports), Pagamento (chips Pix/Visa/Mastercard/Boleto/12x)
12. **Carrinho lateral (drawer)** — 420px, desliza da direita com overlay blur; itens com qty +/−, remover; cupom (**PROG10 = 10%**); CEP → frete (R$ 49,90; **grátis ≥ R$ 5.000**); subtotal/desconto/frete/total; CTA "Finalizar pelo WhatsApp" → `wa.me/5562982133188?text=` com lista de itens e total
13. **Toast** — confirmações (item adicionado etc.)

### 2. Página de produto (`Prog Imports - Produto.dc.html`)
Exemplo: Alienware Area-51 16". Breadcrumb; grid 1.1fr/.9fr:
- **Galeria**: imagem principal 460px com **zoom que segue o mouse** (`scale(1.8)`, transform-origin = posição do cursor) + badge "EXCLUSIVO EUA"; 5 thumbnails (ativa com borda laranja)
- **Compra**: categoria/marca, título 34px, rating (4.9 · 23 avaliações) + SKU; card de preço (de R$ 27.499 por **R$ 24.999**, badge −9%, 12x R$ 2.083,25, preço Pix); seletor de quantidade, CTA "Comprar agora" (WhatsApp com produto/qtd/total), coração favoritar; 4 bullets de confiança (exclusivo EUA, garantia 12 meses, rastreamento por etapas, frete grátis segurado)
- **Abas**: Descrição (rich text), Especificações (tabela chave/valor com 10 linhas), Avaliações (3 cards)
- **Relacionados**: 4 cards compactos
- Requisito do cliente: produtos reais devem ter **≥ 5 imagens**

### 3. Área do cliente (`Prog Imports - Area do Cliente.dc.html`)
Menu lateral: Resumo, Meus pedidos, Favoritos, Endereço, Minha conta.
- **Resumo**: saudação; 4 KPIs (Pedidos 3, Em andamento 1 — borda laranja, Entregues 2, Favoritos); **card do pedido em andamento** com barra de progresso segmentada em 10 etapas e botão "Rastrear pedido"; lista de últimos pedidos (clicáveis)
- **Meus pedidos**: cards com thumb, nº/data, itens, total/pagamento, badge de status, "Ver detalhes"
- **Detalhe do pedido — TIMELINE DE RASTREAMENTO** (peça central): 10 etapas verticais:
  1. Pedido realizado · 2. Pagamento aprovado · 3. Produto reservado · 4. Produto em preparação · 5. Transporte internacional · 6. Desembaraço aduaneiro · 7. Recebido no Brasil · 8. Enviado à transportadora · 9. Em rota de entrega · 10. Entregue
  - Etapa **concluída**: dot laranja preenchido com ✓, conector laranja
  - Etapa **atual**: dot outline laranja com animação pulse, conector em gradiente
  - Etapa **pendente**: dot/texto apagados (`#5b5b63`), conector cinza
  - Cada etapa: data/hora; caixas de info adicional quando aplicável (ex.: "Voo MIA → GRU…", "Etapa aplicável a produtos importados — 3 a 7 dias úteis")
  - **Código de rastreio** em chip monospace tracejado + link "Ver na transportadora ↗"
  - Sidebar: itens do pedido, total, endereço de entrega, botão "Falar com o suporte" (WhatsApp)
  - Etapas 5–7 aplicam-se apenas a pedidos importados
- **Favoritos**: grid de cards com remover (♥) e link ao produto
- **Endereço**: formulário (rua/nº, complemento, bairro, cidade/UF, CEP) + salvar
- **Minha conta**: dados pessoais + alterar senha (atual, nova, confirmar; valida igualdade)

### 4. Painel admin (`Prog Imports - Admin.dc.html`)
**Acesso restrito à administração** (exigir autenticação/role no sistema real). Sidebar fixa (logo + tag ADMIN) com 9 seções:
- **Dashboard**: 4 KPIs (Vendas do mês, Pedidos, Produtos ativos, Clientes) com deltas verdes; Mais vendidos (ranking com barras de progresso laranja); Estoque baixo (badge vermelho, itens ≤ 6 un.); Pedidos recentes (tabela)
- **Produtos**: tabela (nome, SKU, categoria, marca, preço, estoque com cor por nível ≤3 vermelho / ≤6 âmbar / verde, toggle Ativo/Inativo — linha inativa com opacity .45, Editar, Excluir). Botão **+ Novo produto** → modal: nome, SKU, marca, categoria (select), coleção (select), preço, preço promocional, estoque, descrição, dropzone "até 8 imagens"
- **Pedidos**: tabela com **select de status inline** (Aguardando pagamento / Pago / Enviado / Entregue / Cancelado — cores por status). Botão **+ Lançar pedido** → modal (vendas fechadas no WhatsApp): cliente, itens dinâmicos (produto+qtd, adicionar/remover), status inicial, total automático; pedido entra no topo
- **Clientes**: tabela (avatar-inicial, e-mail, cidade, nº pedidos, total gasto)
- **Cupons**: form de criação (código, %) + lista com usos, toggle Ativo/Pausado, excluir
- **Catálogo**: 3 colunas CRUD (Coleções, Categorias, Marcas) — input + adicionar, lista com excluir
- **Banners**: 3 cards editáveis (thumb placeholder + inputs de tag/título/subtítulo) que alimentam o hero da home
- **Serviços** e **Depoimentos**: adicionar/remover
- Tabelas largas ficam em wrapper `overflow-x: auto` com `min-width` interna (720–940px)

## Interactions & Behavior (regras de negócio)
- **Cupom**: `PROG10` → 10% sobre o subtotal; inválido mostra erro vermelho
- **Frete**: R$ 49,90 fixo no protótipo; **grátis quando subtotal − desconto ≥ R$ 5.000** (implementar cálculo real por CEP)
- **Checkout**: monta mensagem WhatsApp (`https://wa.me/5562982133188?text=…`) com lista de itens e total
- **Parcelamento**: sempre exibir "12x de (preço/12) sem juros"
- **Busca**: filtra por nome+categoria, máx. 5 sugestões, estado vazio "Nenhum produto encontrado"
- **Favoritos/carrinho**: badges numéricos no header; persistir por usuário no sistema real
- **Status de pedido** (admin ⇄ cliente): os 5 status do admin mapeiam para as 10 etapas da timeline do cliente (ex.: Pago ≈ etapas 2–4; Enviado ≈ 5–9; Entregue = 10). O ideal é o admin atualizar a **etapa da timeline** e o status agregado derivar dela.
- Moeda: `toLocaleString('pt-BR', {style:'currency', currency:'BRL'})`; datas dd/mm/aaaa; todo o copy em pt-BR

## State Management (mínimo p/ produção)
- Catálogo: produtos (nome, SKU, marca, categoria, coleções[], preço, preço promo, estoque, ativo, descrição, especificações[], imagens[≥5], relacionados[])
- Pedidos: cliente, itens[], total, pagamento, status, etapa da timeline (0–10) + histórico de eventos com timestamp/nota, código de rastreio, endereço
- Clientes: dados pessoais, endereço, favoritos[], senha (auth)
- Cupons (código, %, ativo, usos), banners, serviços, depoimentos
- Carrinho: local até o login; cupom e CEP aplicados

## Assets
- `assets/logo.png` — logo Prog Imports (globo dourado + wordmark), fundo transparente, usada no header (52px), footer (64px) e admin (44px)
- Todas as imagens de produto/banner são **placeholders** a substituir por fotos reais

## Screenshots
A pasta `screenshots/` contém capturas de referência do protótipo renderizado:
- `01–03-home.png` — hero, grid de produtos, carrinho lateral aberto
- `01–02-produto.png` — página de produto e aba de especificações
- `01–03-cliente.png` — resumo da conta e detalhe do pedido com timeline de rastreamento
- `01–04-admin.png` — dashboard, produtos, pedidos e modal "Lançar pedido"

## Files
- `Prog Imports - Home.dc.html` — home completa + carrinho drawer + busca
- `Prog Imports - Produto.dc.html` — página de produto (galeria/zoom/abas/relacionados)
- `Prog Imports - Area do Cliente.dc.html` — área logada + timeline de rastreamento
- `Prog Imports - Admin.dc.html` — painel administrativo (9 seções)
- `assets/logo.png`
