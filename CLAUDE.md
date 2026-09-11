# Prog Imports — guia de retomada

Se você é uma sessão nova (ou a pasta local sumiu), comece por aqui. O projeto
vive inteiro online; a pasta local é só uma cópia de trabalho.

## Onde mora cada coisa

| Serviço | Identificação |
|---|---|
| **GitHub** | `ArthurPr0g/Site-Prog-Imports` (público), branch `main` |
| **Vercel** | time `prog-solucoes` (`team_nUo1775WlCyMWyIjxwOLKfbY`), projeto `site-prog-imports` (`prj_xhsJiM89TbsTaQISlYrLTJr3Aopi`) |
| **Domínios** | `prog-imports.com`, `www.prog-imports.com` |
| **Supabase** | projeto `prog-imports`, ref `oduimaztcoxbvtlsjjcy`, região `sa-east-1` |
| **Pasta local** | `C:\Apps\1 - Dev\Prog Soluções\Prog Imports\site-prog-imports` |
| **Admin do site** | login `progimports01@gmail.com`, **só pelo Google** (senha removida em 2026-09-11; se precisar de senha, use "Send password recovery" no painel da Supabase). É a antiga conta demo `admin@progimports.com` com o login trocado; o campo `profiles.email` ainda mostra o valor antigo. |

## Leia antes de mexer

- `README.md` — stack, rotas, variáveis de ambiente, regras de negócio da loja
- `docs/ERP.md` — estado dos módulos do ERP (`/admin`), decisões já tomadas e o que falta

## Como o deploy funciona

- Push em `main` → a Vercel publica em produção automaticamente. Não existe
  ambiente de homologação: todo push em `main` vai para o ar.
- Não há CLI da Vercel vinculada; use o conector da Vercel (deploys, logs de
  build e runtime) ou `vercel link` + `vercel env pull` se precisar.

## Banco de dados (migrations)

- Toda mudança de schema: criar `supabase/migrations/NNNN_descricao.sql` com o
  próximo número (a última é `0043`) **e** aplicar no projeto pelo conector da
  Supabase (`apply_migration`) com o mesmo nome. As duas coisas no mesmo commit.
- Histórico divergente (conferido em 2026-09-11): os nomes registrados na
  Supabase não batem 1:1 com os arquivos até a `0033` — várias migrations antigas
  foram aplicadas por SQL direto ou agrupadas. O **estado** do banco confere com
  os arquivos. A `0039_my_installments_com_paid_at` existe só no banco e foi
  substituída pela `0043`. Não rode `supabase db push` contra este projeto.

## Retomar do zero (sem pasta local)

```bash
git clone https://github.com/ArthurPr0g/Site-Prog-Imports.git site-prog-imports
```

`.env.local` não vai para o git. Para rodar localmente, recrie a partir do
`README.md`: URL e chave pública da Supabase saem do conector
(`get_project_url` / `get_publishable_keys`); `ANTHROPIC_API_KEY` só é necessária
para o assistente de compras (`/api/assistant`).
