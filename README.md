# Prog Imports — E-commerce

E-commerce completo da **Prog Imports**, importadora de tecnologia premium (foco: EUA). Implementado a partir do handoff de design em `project/design_handoff_prog_imports/` (ver `chats/chat1.md` para o histórico de decisões).

## Stack

- **Next.js 16** (App Router, Server Actions, Turbopack) + TypeScript
- **Tailwind CSS v4** (tokens de design via `@theme` em `src/app/globals.css`)
- **Supabase** — Postgres (schema em `supabase/migrations/`), Auth (email/senha), Storage (bucket `product-images`), RLS em todas as tabelas
- Deploy alvo: **Vercel**

## Superfícies implementadas

1. **Home** (`/`) — hero carrossel, categorias, produtos com filtro de coleção, institucional, serviços, depoimentos, newsletter, carrinho lateral com cupom + frete, checkout via WhatsApp
2. **Produto** (`/produto/[sku]`) — galeria com zoom, abas (descrição/especificações/avaliações), relacionados, compra via WhatsApp
3. **Área do cliente** (`/conta/*`) — resumo, pedidos, **timeline de rastreamento de 10 etapas**, favoritos, endereço, dados da conta
4. **Painel admin** (`/admin/*`, role-gated) — dashboard, produtos (CRUD), pedidos (status inline + lançar pedido), clientes, cupons, catálogo (categorias/marcas/coleções), banners, serviços, depoimentos

## Rodando localmente

```bash
npm install
npm run dev
```

### Variáveis de ambiente (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_WHATSAPP_NUMBER=5562982133188
NEXT_PUBLIC_INSTAGRAM_HANDLE=Prog.imports
NEXT_PUBLIC_FRETE_GRATIS_MIN=5000
NEXT_PUBLIC_FRETE_PADRAO=49.90
ANTHROPIC_API_KEY=
META_APP_ID=
META_APP_SECRET=
INSTAGRAM_CONTA_ID=
INSTAGRAM_TOKEN=
```

### Identidade da loja (opcional)

Definidas em `src/lib/brand.ts`, todas com o valor da Prog Imports como padrão —
sem nenhuma delas, o site se comporta como sempre. Servem para que uma loja nova
seja configuração em vez de fork.

```
NEXT_PUBLIC_BRAND_NAME=            # padrão: Prog Imports
NEXT_PUBLIC_BRAND_SHORT_NAME=      # padrão: Prog
NEXT_PUBLIC_BRAND_TAGLINE=         # padrão: Tecnologia Importada Premium
NEXT_PUBLIC_BRAND_DESCRIPTION=     # padrão: descrição institucional atual
NEXT_PUBLIC_BRAND_ACCENT=          # padrão: #F28705 — só hexadecimal
```

`NEXT_PUBLIC_BRAND_ACCENT` vira a custom property `--brand-accent` no `<html>`, e
o token `--color-accent` do tema aponta para ela. Valor fora do formato
hexadecimal é ignorado e cai no padrão. Como são lidas no servidor, mudar a cor
não exige rebuild — basta redeploy.

`ANTHROPIC_API_KEY` alimenta o assistente de compras (`/api/assistant`) e é a única variável **sem** o prefixo `NEXT_PUBLIC_` — ela nunca deve chegar ao browser. Sem ela a rota responde 503 e o chat flutuante mostra "Assistente indisponível no momento"; o resto do site continua funcionando normalmente.

As quatro variáveis do Meta ligam o Estúdio ao Instagram da loja e também nunca levam `NEXT_PUBLIC_`. `META_APP_ID` e `META_APP_SECRET` saem do app em developers.facebook.com (Configurações → Informação básica) e servem para trocar o token curto do Graph API Explorer por um de 60 dias; `INSTAGRAM_CONTA_ID` e `INSTAGRAM_TOKEN` são o resultado dessa troca e saem prontos na tela `/admin/estudio/instagram`. Sem as duas últimas, o Estúdio continua desenhando e exportando normalmente — só o botão de publicar fica escondido, com um atalho para a tela de configuração.

O token vence em 60 dias. Quando vencer, a publicação falha com a mensagem da própria Meta; refazer é repetir o passo da tela de configuração com um token novo do Explorer.

O projeto Supabase já está criado e as migrations (`supabase/migrations/*.sql`) já foram aplicadas nele diretamente via MCP — não é necessário rodar `supabase db push` a menos que você aponte para um novo projeto.

### Contas

Contas e senhas são gerenciadas no painel da Supabase (Authentication → Users).
Não registre credenciais neste arquivo: o repositório é público.

## Estrutura

```
src/
  app/                 rotas (App Router) + server actions em app/actions/
  components/          ui/ (base), home/, product/, cart/, account/, admin/, layout/
  lib/
    data/              queries server-side por domínio (catalog, content, orders, admin)
    supabase/          clients (browser/server/middleware) + tipos gerados do schema
    cart-context.tsx   carrinho client-side (localStorage), cupom, frete, WhatsApp checkout
    constants.ts        tokens de negócio (status, etapas da timeline, frete)
supabase/migrations/    schema SQL + seed de dados de exemplo
project/                bundle de design original (referência, não é código de produção)
```

## Regras de negócio

- Cupom `PROG10` = 10% (validado contra a tabela `coupons`); frete grátis quando `subtotal − desconto ≥ R$ 5.000`
- Checkout monta uma mensagem pré-formatada e abre `wa.me/<número>`
- Status do pedido no admin (5 valores) mapeia para a etapa da timeline do cliente (0–10) via `STATUS_TO_STAGE` em `src/lib/constants.ts`
- Imagens de produto são **placeholders** (padrão listrado + rótulo) — a tabela `product_images` já suporta `url` para quando fotos reais forem enviadas ao bucket `product-images`

## Limitações conhecidas / próximos passos

- O upload de imagens no modal de produto do admin é visual (dropzone), ainda não grava arquivos no Storage
- Favoritos usam `localStorage` durante navegação anônima e a tabela `favorites` do banco depois de logado — não há sincronização automática entre os dois ao fazer login
- Cadastro de cliente depende da configuração de confirmação de e-mail do projeto Supabase (contas demo já vêm confirmadas)
