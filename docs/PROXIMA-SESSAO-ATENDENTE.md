# Próxima sessão: publicar a Lia, os gráficos e as técnicas de venda

Para o Claude que abrir esta pasta (sessão do Arthur na pasta Prog Soluções). Tudo foi feito e
testado localmente em 28/10/2026 numa sessão sem acesso ao banco da Prog. Faça na ordem.

## Estado
- 4 commits locais em `main`, sem push (`git log origin/main..HEAD`): atendente de IA (Lia), gráficos
  do Relatório, técnicas de venda da Lia e este roteiro. **Não dê push antes do passo 1**: a
  Captação lê `lead_seller_kits.kind` (migration 0067) e quebraria em produção.
- Detalhes: `docs/ATENDENTE-IA.md` (roteiro completo), `docs/ERP.md` ("Captação: atendente de IA"),
  `docs/CAPTACAO-BACKLOG.md` (itens IA1–IA8), `docs/LIA-METODOS-DE-VENDA.md`.

## Passos
1. **Banco:** `apply_migration` de `supabase/migrations/0067_captacao_atendente_ia.sql` (nome
   `captacao_atendente_ia`) no MCP `supabase-arthurmatos003`, project ref `oduimaztcoxbvtlsjjcy`.
   Depois `get_advisors` (security).
2. **Segredos que o Claude pode gerar sozinho** (valores aleatórios longos):
   - `ATENDENTE_TICK_SECRET` → também no Vault: `select vault.create_secret('<valor>', 'atendente_tick_secret');`
   - `WHATSAPP_VERIFY_TOKEN`.
3. **Chave do Supabase só do atendente:** abrir para o Arthur
   https://supabase.com/dashboard/project/oduimaztcoxbvtlsjjcy/settings/api-keys → "Create new secret key"
   (nome `atendente`) → `ATENDENTE_SUPABASE_KEY`.
4. **Push** (`git push`) → acompanhar o deploy na Vercel até READY.
5. **Meta (com o Arthur, login dele):** app com WhatsApp, número 62 99636-8281, código por SMS,
   token permanente de usuário do sistema, App Secret, Phone Number ID; webhook
   `https://www.prog-imports.com/api/whatsapp/webhook` com o `WHATSAPP_VERIFY_TOKEN` do passo 2,
   assinar `messages`, publicar o app. Passo a passo no `ATENDENTE-IA.md`.
6. **Gmail:** o Arthur escolhe a conta e cria a senha de app (https://myaccount.google.com/apppasswords).
7. **Vercel (Production):** `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`,
   `WHATSAPP_VERIFY_TOKEN`, `ATENDENTE_SUPABASE_KEY`, `ATENDENTE_TICK_SECRET`, `SMTP_HOST=smtp.gmail.com`,
   `SMTP_PORT=465`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. Redeploy.
8. **Painel:** Captação › Vendedores › "Link da atendente de IA" › gerar. Atendimento › Configuração:
   e-mail do Arthur, conferir teto/desconto › ligar.
9. **Teste real:** o Arthur manda do WhatsApp dele "Oi, Lia! Vi o diagnóstico de <empresa da lista da IA>
   e quero conversar." Conferir resposta, etapa, placar e custo. Simular objeção de preço e pedido de desconto.
10. **Celular:** aba Atendimento e aba Relatório no Android e no iPhone (guia `TESTES-CELULAR.md`), pelo
    acesso do Arthur. Atualizar o backlog (IA1–IA6) e trazer qualquer correção para
    `3 - Ferramentas\prog-modulos` (repo ArthurPr0g/prog-modulos).
