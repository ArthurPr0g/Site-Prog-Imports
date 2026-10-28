# Atendente de IA (Lia): como ligar

Pedido do dono em 28/10/2026: uma IA que atende os leads da Captação no WhatsApp, do primeiro
contato ao fechamento, com cada conversa e a etapa do lead no painel, e que só chama o Arthur
quando precisa. A IA concorre com o Felipe: cada lead vai para um ou para o outro, e o placar
mostra quem converte mais. Regras e decisões: `docs/ERP.md`, seção "Captação: atendente de IA".

Número da IA: **62 99636-8281** (chip novo da Vivo, sem WhatsApp instalado).

## O que custa

| Item | Custo |
|---|---|
| WhatsApp Cloud API (Meta) | 1.000 mensagens de atendimento grátis por mês por número (regra de 01/10/2026). Da 1.001ª em diante a Meta cobra; sem cartão cadastrado, as extras não saem. |
| Claude (Anthropic) | Pago por uso, com teto mensal no painel (padrão US$ 30). Passou do teto, a IA para e avisa. Teste local: cerca de US$ 0,008 por resposta no Opus 5.5 com cache. |
| E-mail | Grátis numa conta Gmail com senha de app (limite do Gmail: cerca de 500 por dia; o painel manda no máximo 15 primeiros contatos por dia). |
| Supabase, Vercel | Os que já existem. |

## Passo a passo (uma vez)

### 1. Banco
1. Aplicar `supabase/migrations/0067_captacao_atendente_ia.sql` (MCP `supabase-arthurmatos003`,
   project ref `oduimaztcoxbvtlsjjcy`) e rodar `get_advisors`.
2. Criar o segredo do relógio no Vault (SQL editor do Supabase, **não** vai para o git):
   `select vault.create_secret('<valor gerado>', 'atendente_tick_secret');`
   O mesmo valor vai na Vercel como `ATENDENTE_TICK_SECRET`.
3. Criar uma chave secreta só do atendente: Supabase > Project Settings > API Keys >
   Secret keys > "Create new secret key" (nome `atendente`). Vai na Vercel como
   `ATENDENTE_SUPABASE_KEY`. Dá para revogar sozinha, sem mexer nas outras.

### 2. WhatsApp (Meta)
1. developers.facebook.com > Meus apps > Criar app > caso de uso **WhatsApp** (empresa: o
   portfólio da Prog Soluções).
2. WhatsApp > Configuração da API > **Adicionar número de telefone**: 62 99636-8281, nome de
   exibição "Prog Soluções", código por SMS. O chip não pode estar com WhatsApp instalado.
3. Copiar o **ID do número de telefone** → `WHATSAPP_PHONE_NUMBER_ID`.
4. Token permanente: Configurações do negócio > Usuários > Usuários do sistema > Adicionar
   (Admin) > Gerar token para o app, com `whatsapp_business_messaging` e
   `whatsapp_business_management` → `WHATSAPP_TOKEN`.
5. App > Configurações > Básico > **Chave secreta do app** → `WHATSAPP_APP_SECRET`.
6. WhatsApp > Configuração > Webhook: URL `https://www.prog-imports.com/api/whatsapp/webhook`,
   token de verificação = um texto qualquer que também vai em `WHATSAPP_VERIFY_TOKEN`.
   Depois, assinar o campo **messages**.
7. Publicar o app (modo Ao vivo): em modo de desenvolvimento só chegam mensagens de números de teste.
8. (Opcional, para passar de 1.000 mensagens no mês) cadastrar forma de pagamento na conta do WhatsApp.

### 3. E-mail
Conta Gmail com verificação em 2 etapas ligada > Conta Google > Segurança > **Senhas de app** >
criar ("Atendente"). Na Vercel: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`,
`SMTP_USER=<o gmail>`, `SMTP_PASS=<senha de app>`, `SMTP_FROM=<o gmail>`.

### 4. Vercel (projeto do site)
Variáveis novas (Production): `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
`WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `ATENDENTE_SUPABASE_KEY`,
`ATENDENTE_TICK_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
`ANTHROPIC_API_KEY` já existe (assistente da loja). Depois, um novo deploy.

### 5. Painel
1. Captação > Vendedores > marcar **Link da atendente de IA** > gerar (só leads com e-mail).
2. Captação > Atendimento > Configuração: seu e-mail (avisos), teto, desconto máximo (10%),
   tempo do "superior" (6 min), e-mails por dia (15) > marcar **Atendente ligada** > Salvar.
3. Testar: use **Testar a Lia** no próprio painel (simulador: nada sai pelo WhatsApp).
   Do seu WhatsApp (62 98213-3188) não dá mais para testar como cliente: desde 28/10/2026
   esse número é o do dono e só abre a janela dos avisos.

### 6. Avisos no seu WhatsApp (28/10/2026)
- O número da Lia avisa o 62 98213-3188 (`ia_config.owner_whatsapp`) quando um cliente
  pede você, a venda fecha, chega pedido de desconto, a Lia marca reunião ou o vendedor
  marca "Reunião marcada"/"Quer proposta".
- Texto livre só sai até 24 h depois da sua última mensagem para o número da Lia. Fora
  disso vai pelo modelo `aviso_ao_arthur`, que o relógio cria sozinho na Meta (categoria
  utilidade) e acompanha a aprovação; o status aparece em Atendimento. Enquanto não for
  aprovado, mande um "oi" para o número da Lia: abre 24 h de avisos.

### 7. Google Agenda (reuniões que a Lia marca)
1. console.cloud.google.com > projeto novo (ex.: "Prog Soluções") > APIs e serviços >
   ativar **Google Calendar API**.
2. Tela de consentimento OAuth: tipo **Externo**, só o seu e-mail como usuário de teste e,
   no fim, **Publicar o app** (em "Teste" o Google derruba a conexão a cada 7 dias).
   Escopo: `.../auth/calendar.events`.
3. Credenciais > Criar ID do cliente OAuth > **Aplicativo da Web** > URI de redirecionamento
   `https://www.prog-imports.com/api/google/retorno`.
4. Vercel (Production): `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` > novo deploy.
5. Captação > Atendimento > **Conectar minha agenda** > escolher a conta da agenda.
Sem isso, a Lia marca a reunião no sistema (evitando só as que ela mesma marcou) e te
avisa para criar o evento.

## Como funciona

- **Primeiro contato por e-mail** (política do WhatsApp: a empresa não pode mandar a 1ª
  mensagem para quem não deu o número). Dias úteis, 8h–18h, até o limite do dia, um por
  minuto. O e-mail leva o diagnóstico e o botão "Falar no WhatsApp" com o texto pronto.
  Retornos por e-mail nos dias 3, 7 e 14 para quem não respondeu. Respostas ao e-mail
  chegam no seu e-mail (Reply-To).
- **WhatsApp**: o lead escreve, o webhook grava, reconhece o lead pelo texto do botão (ou pelo
  telefone do Maps), sobe a etapa para "Respondeu" e a Lia responde em ~10 s.
- **Ferramentas da Lia**: `calcular_preco` (o mesmo simulador do Felipe, com combos),
  `registrar_descoberta` (checklist), `mudar_etapa`, `pedir_desconto_extra`,
  `chamar_arthur`, `atualizar_resumo`. Ela nunca fala preço sem a ferramenta.
- **Desconto extra** (regra do dono): só quando o cliente pede e ela julga necessário; até o
  máximo configurado; ela diz que vai ver com o superior. Você recebe e-mail e o pedido aparece
  no topo da aba Atendimento com **Liberar agora / Negar** e contagem regressiva. Sem resposta
  no tempo configurado, libera sozinha. O relógio (pg_cron a cada minuto → `/api/atendente/tick`)
  faz a Lia voltar ao cliente.
- **Você assume quando quiser**: responder pelo painel passa a conversa para você (a Lia fica
  calada até "Devolver para a IA"). Ela chama você em: venda fechada, reunião marcada, pedido
  fora do catálogo, pergunta fora do guia, cliente irritado, teto atingido, falha.
- Se perguntarem diretamente se é robô, ela confirma que é assistente virtual com IA.
- Janela de 24 h do WhatsApp: passou de 24 h sem mensagem do cliente, nem a Lia nem o painel
  conseguem mandar texto livre (só modelo pago). Aí é ligação ou o seu WhatsApp.

## Teste local (sem número e sem chave)

`scripts/teste-atendente.ts` confere preço, desconto, e-mail e placar (`npx tsx scripts/teste-atendente.ts`).
Para o fluxo completo, o site local aceita `WHATSAPP_API_BASE` (servidor falso da Graph API)
e `ANTHROPIC_BASE_URL` (API falsa do Claude); assim foi validado em 28/10/2026: webhook
assinado, lead reconhecido, etapa, descoberta, preço, pedido de desconto, liberação pelo
relógio, resposta do Arthur pelo painel e a IA calada depois que ele assume.
