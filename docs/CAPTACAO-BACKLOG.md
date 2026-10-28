# Captação — backlog

Ideias e pendências do módulo Captação (`/admin/captacao`), para não se perderem.
Regras e decisões do que já existe: `docs/ERP.md`, seção "Captação (M10)".

Status: **a fazer** · **fazendo** · **feito (local)** = commitado, ainda não publicado · **no ar**.

Pedido do dono em 27/10/2026: "pode fazer todos" (itens 1 a 12).

---

## Como publicar (roteiro para a sessão que for publicar)

Estado em 27/10/2026: **commits locais** em `main` desde `916ef43` (`git log origin/main..HEAD` lista todos),
sem push, e a migration `0062` **não aplicada** em produção. Os commits existem
só nesta pasta do PC: trabalhe nela (não clone de novo, senão perde tudo).

1. `cd` na pasta do repo e `git status`: a árvore deve estar limpa e `ahead` de `origin/main`.
   Se o `git pull` trouxer algo novo, resolva antes de seguir.
2. **Aplicar a migration** `supabase/migrations/0062_captacao_leads.sql` inteira
   com `apply_migration` (nome `captacao_leads`) no MCP **`supabase-arthurmatos003`**,
   project ref **`oduimaztcoxbvtlsjjcy`**. Depois, `get_advisors` (security):
   as 6 tabelas novas têm RLS de admin; as funções `lead_*` são security
   definer de propósito (página pública do diagnóstico e do vendedor).
3. `npm run build` (deve passar; lint do projeto inteiro está zerado).
4. `git push` → a Vercel publica sozinha. Acompanhar o deploy até `READY`.
   Não precisa de variável nova. `NEXT_PUBLIC_SITE_URL` deve ser o domínio
   de produção (os links do diagnóstico e do vendedor saem dele).
5. Testar pelo acesso do dono (login Google): `/admin/captacao` (abas Lista,
   Foco, Quadro, Mapa, Relatório, Vendedores, Buscas), um `/diagnostico/...` e,
   depois de gerar o link do Felipe, `/vendedor/...` no celular e no
   computador. Android e iPhone pelos simuladores (`TESTES-CELULAR.md`).
6. **Importar os leads**: `npx -y tsx scripts/captacao/worker.ts --importar <CSVs>`
   (usa a `SUPABASE_SECRET_KEY` do `.env.local`; importa com a mesma lógica do
   painel e tira os prints). Os CSVs estão em
   `3 - Ferramentas\google-maps-scraper-kit\resultados` (todos já com
   `busca_*`; os 8 antigos foram marcados em 27/10).
7. **Link do Felipe**: na aba Vendedores, com os filtros que o dono quiser,
   informar nome e **WhatsApp do Felipe** (o dono passa) e gerar.

| # | Item | Status | Observação |
|---|---|---|---|
| P1 | Aplicar a migration `0062` em produção e rodar `get_advisors` | no ar | Aplicada em 27/10. Advisor: só os avisos esperados das funções `lead_*` públicas (security definer de propósito). |
| P2 | Push dos commits locais e acompanhar o deploy | no ar | Deploy `dpl_2gUo392UYG1gqQmtXY3H8Qa1AWpd` READY em www.prog-imports.com (27/10). |
| P3 | Testar no Chrome, iPhone e Android pelo acesso do dono | no ar (falta Android) | Chrome: 7 abas, diagnóstico e página do vendedor sem erro no console. iPhone: sem rolagem lateral. **Android**: o emulador tem senha na tela de bloqueio; sem destravar, o Chrome não abre (estado `RUNNING_LOCKED`). O dono destrava e o teste segue. |
| P4 | Conferir se `NEXT_PUBLIC_WHATSAPP_NUMBER` na Vercel é `5562982133188` | no ar | Confirmado no HTML publicado (`wa.me/5562982133188`). `NEXT_PUBLIC_SITE_URL` não existe na Vercel: vale o padrão `https://prog-imports.com`, que redireciona (308) para `www` mantendo caminho e parâmetros. |
| P5 | Importar em produção os CSVs de `google-maps-scraper-kit
esultados` | no ar | 48 arquivos: 2.151 leads novos, 79 prints. Fora: `bruto-brasilia-full.csv` (versão crua do `odonto-brasilia.csv`) e `oficina-mecanica-goiania` (1 linha sem dados). 4 CSVs antigos sem `busca_*` entraram por cópia corrigida. O lote de Orlando não tinha arquivo novo; importar quando terminar. |
| P6 | Gerar o link do Felipe e mandar para ele | no ar | Link gerado em 27/10 (Goiânia, 20 leads de nota 85–90, WhatsApp 5562995711797). Falta o dono mandar o link para ele. |

Fora do repositório (só no PC, não vão no push): a alteração do kit do scraper
(`scrape.py` lendo `GMAPS_LANG`), o `docker-compose.override.yml` que desliga a
telemetria do engine e o ambiente de teste local
(`3 - Ferramentas\prog-imports-local`).

---

## Meta e animações (27/10/2026, noite) — no ar

- Card renomeado para **"Dinheiro na mesa"**; números correm até o valor, cartões entram em sequência, sublinhado da aba desliza, troca de aba suave (respeita "reduzir movimento").
- **Meta do semestre**: R$ 100 mil de faturamento de 1º/11/2026 a 30/04/2027 (`src/lib/meta-captacao.ts`, gráfico em `src/components/captacao/GraficoDaMeta.tsx`).
  - Realizado = implantação no mês do fechamento + mensalidade nos meses seguintes. Fechamento antes de 1º/11 conta em novembro.
  - Rampa 25/50/75/100% (R$ 5.556 → 11.111 → 16.667 → 22.222 × 3); o que faltar num mês é redistribuído nos meses seguintes.
  - Projeção = realizado + mensalidades já fechadas + funil × chance da etapa (proposta 60% e reunião 20% pelo padrão do HubSpot; respondeu 10% e contatado 3% de partida, ajustadas pela taxa real com peso de 20 leads).
- O painel relê os dados a cada 60 s; a página do vendedor, a cada 30 s (função `lead_kit_meta`, migration `0063`, só etapa/país/serviços/datas, sem nome nem contato).

## Leads fantasma e ficha do vendedor (27/10/2026, noite) — no ar

- **Sinais de atividade** (migration `0064`): o kit do scraper (`scrape.py`, função `derive`, só no PC) calcula status do Google, data da última avaliação, dono do perfil, horário, atributos, agendamento online, notas por estrela e 3 avaliações recentes; o `captar.ps1` já pede essas colunas.
- Nota: fechado no Google = 0; última avaliação > 2 anos −30, > 1 ano −15, ≤ 3 meses +5; perfil com dono +5.
- **Possível fantasma** (`motivoFantasma` em `src/lib/captacao.ts`): fechado no Google, sem avaliação há mais de 2 anos, ou sem contato e com menos de 3 avaliações. Fica fora do link do vendedor, do "adicionar mais 20" e do modo foco; selo vermelho na lista.
- **E-mails falsos**: 86 limpos em produção (info@example.com, press@linktr.ee, sentry/wixpress, nomes de imagem...). A mesma regra roda no kit e na importação.
- **Ficha do vendedor** (aba Análise): sinais de atividade, como é o negócio (horário, atributos, agendamento online), o que os clientes dizem, comparação com a região e "Conheça o ramo" (`src/lib/conhecer-o-ramo.ts`, 8 grupos).
- Leads importados antes de 27/10 ficam sem esses dados até a próxima busca. Reimportar não apaga nada (só grava as colunas que o CSV traz).

## Porte do cliente, limpeza da base e telefone fixo (27/10/2026, noite) — no ar

- **Porte** (`estimarPorte`, migration `0065`): avaliações no Google (≥1.000 +3, ≥300 +2, ≥100 +1, <30 −1), unidades da marca na cidade (+2), site próprio no ar (+1), ramo de ticket alto (+1). ≤1 pequena, 2–3 média, ≥4 grande.
- **Pacote provável, não proposta** (pedido do dono, 27/10): o pacote e o valor são uma previsão com o que é público no Google. Painel e página do vendedor mostram "≈" e "estimativa"; a necessidade real sai da conversa e do checklist de descoberta, e só então se monta a proposta.
- **Pacote pelo porte**: pequena fica no Essencial (ou Profissional, se o problema pede) e Gestão Básico; média sobe para Profissional e Intermediário; grande vai para Premium e Avançado.
- **Rede/franquia nacional** (lista `REDES`, palavra inteira): −30 na nota; site e sistema vêm da marca.
- **Só telefone fixo**: −5 e aviso; no modo foco e na página do vendedor o botão principal vira "Ligar" e o WhatsApp fica como "tentar mesmo assim".
- **Limpeza da base** (`scripts/captacao/reavaliar-base.ts`, com `--simular`): rodada em 27/10 nos 2.151 leads (1.330 pequenas, 643 médias, 178 grandes; 62 redes; 861 só fixo; 19 possíveis fantasmas). Atualizou 8 itens do link do Felipe (pacote e preço pelo porte). Rode de novo sempre que mudar a regra.

---

## Melhorias pedidas (27/10/2026)

### 1. Lead quente: quem abriu o diagnóstico — feito (local)
Registrar cada abertura do `/diagnostico/<token>` (contador, primeira e última
visita) e destacar no painel: "abriu 3x, a última há 10 min", no topo da lista.
- Não contar: o próprio dono (sessão admin ou `?previa=1` no link do painel) e
  os robôs que montam a prévia do link (User-Agent com WhatsApp,
  facebookexternalhit, Telegram, Slack, bot, crawler, preview).
- Função `security definer` para registrar (o anônimo não escreve na tabela).
- Depois: aviso no celular (precisa de push; hoje não existe infraestrutura).

### 2. Modo foco "Próximos 10" + meta diária — feito (local)
Um lead por vez, do maior para o menor (quentes e retornos do dia primeiro),
com a mensagem pronta; "Enviei" passa para o próximo. Meta diária de contatos
("hoje: 14 de 20") com barra; a meta fica no navegador do dono.
- Precisa de `last_contact_at` para contar os contatos do dia (inclui retornos).

### 3. Sequência de retorno (follow-up) — feito (local)
Dia 0 WhatsApp → dia 3 lembrete → dia 7 e-mail → dia 14 último contato
("vou parar de te escrever"). Card **"Para hoje"** com quem precisa de retorno e
qual mensagem.
- `followup_step` no lead e `step` nos modelos (`lead_templates`: canal ×
  idioma × etapa, com WhatsApp e e-mail em todas as etapas; a tela sugere o canal).
- Parar a sequência quando o lead responder, for perdido ou pedir para não ser contatado.

### 4. Proposta em um clique — feito (local)
"Virar cliente" já cria o **Orçamento de Serviço** com os serviços sugeridos
(itens do catálogo, combo aplicado pela regra de `combo-servicos.ts`) e abre
para ajustar e mandar o PDF que o ERP já gera.
- Reusar `saveServiceQuoteAction` / `ajustarCombosEMensalidades`, nunca
  duplicar a regra de combo.

### 5. Relatório por ramo e cidade — feito (local)
Leads, contatados, taxa de resposta, reuniões, fechados e valor por ramo e
por cidade. Mostra onde buscar mais e onde parar.

### 6. Mapa dos leads — feito (local)
Leads no mapa coloridos pela nota, para montar rota de visitas por bairro
(Goiânia: visita presencial).
- Coordenadas: o `link` do Google Maps traz `!3d<lat>!4d<lng>`, então os CSVs já
  baixados servem; para os próximos, pedir `latitude,longitude` no `--fields`.
- Leaflet + OpenStreetMap (sem chave).

### 7. Pedir busca pelo celular (importação automática) — feito (local)
Botão "Nova busca" (nicho + cidade, ou "todos os nichos da lista") no painel
grava um pedido; um programa no PC do dono (`scripts/captacao/worker`) pega o
pedido, roda a busca, confere os sites, tira os prints (item 8) e **importa
sozinho**, sem CSV manual.
- O programa usa a `SUPABASE_SECRET_KEY` do `.env.local` (uso previsto: scripts
  locais); a chave nunca vai para a Vercel.
- Mesma lógica de importação do painel (nota, dedupe, preserva etapa), num
  módulo compartilhado; não reescrever em Python.
- Começar sozinho com o Windows é configuração persistente: só com o OK do dono.

### 8. Print do site no celular dentro do diagnóstico — feito (local)
Foto real do site do lead numa tela de celular (prova de "não se adapta",
"não seguro"). Gerado no PC (Playwright) e guardado no Storage do Supabase
(bucket público só de leitura). Depende do item 7.

### 9. Não abordar quem já é cliente — feito (local)
Cruzar leads com `customers` (telefone e e-mail normalizados) e marcar
"já é cliente"; fora da fila e do modo foco.

### 10. Nota que aprende — feito (local)
Com 30+ leads contatados, mostrar a taxa de resposta por motivo da nota
("sem site" responde 12%, "site fora do ar" 20%…) para ajustar os pesos com
dados reais. Não mudar os pesos sozinho: sugerir e o dono decide.

### 11. Teste A/B de mensagens — feito (local)
Duas versões (A/B) de cada modelo; cada lead recebe uma (alternando) e o
relatório compara a taxa de resposta.

### 12. Quadro (kanban) — feito (local)
Ver os leads em colunas por etapa e arrastar entre elas (no celular, tocar e
escolher a etapa).

---

## Feito junto (27/10/2026)

- **Domínio à venda**: `checar-sites.py` marca `parado` quando o site virou página de domínio estacionado (GoDaddy `/lander`, Sedo, Dan, Afternic…). Nota +40, mensagem "o endereço do site de vocês está à venda" e item no diagnóstico. Achou casos em quase todos os nichos de Goiânia.
- **Mensagens em português sem artigo antes do nome** ("a Centro de Ensino" errava o gênero): o nome da empresa saiu do corpo do WhatsApp e foi para o assunto do e-mail.
- **"Dinheiro na mesa"** (antes "Valor na mesa") diz "uma vez" / "todo mês" e mostra o total em 12 meses de contrato.

## Página do vendedor (27/10/2026) — feito (local)

Link `/vendedor/<token>` gerado na aba Vendedores (primeiro: **Felipe**; falta o
WhatsApp dele, informado na hora de gerar o link em produção). Detalhes em
`docs/ERP.md`, seção "Captação — página do vendedor".

### Melhorias para a página do vendedor (levantadas a pedido do dono) — V1, V4, V5 e V8 feitos (local); o resto a fazer

| # | Ideia | Por quê |
|---|---|---|
| V1 | ✅ **feito (local, 27/10/2026)** · Aba **Hoje**: retornos vencidos e quentes primeiro, com a mensagem pronta (o modo foco do painel, para o vendedor) | Abrir a página e saber o que fazer agora, sem procurar no quadro |
| V2 | **Aviso para o Arthur** quando o vendedor marcar "Quer proposta" ou "Reunião marcada" (WhatsApp/e-mail) | Proposta rápida enquanto o cliente está quente |
| V3 | **Agendar reunião** com o Arthur direto da página (link do Cal.com, já no backlog do portfólio) | O vendedor fecha a conversa marcando horário, não "vou ver e te falo" |
| V4 | ✅ **feito (local, 27/10/2026)** · **Roteiro de ligação** (além do WhatsApp): o que falar nos primeiros 30 segundos e como pedir o WhatsApp | Lead quente se liga, não se manda texto |
| V5 | ✅ **feito (local, 27/10/2026)** · **Cases do mesmo ramo**: 2–3 trabalhos do portfólio parecidos com o lead (clínica, loja, academia) | Prova social na hora da objeção |
| V6 | **Pré-proposta em PDF** a partir do simulador (logo, itens, valor, validade) para o vendedor mandar | O cliente que quer "algo por escrito" recebe na hora; a proposta oficial segue com o Arthur |
| V7 | **Comissão e meta do vendedor** (quanto ganha por fechamento, quanto falta para a meta) | Motivação e transparência; o dono define as regras antes |
| V8 | ✅ **feito (local, 27/10/2026)** · **Recarregar leads**: quando ele terminar os 20, botão "pedir mais" que avisa o Arthur (ou gera sozinho do mesmo filtro) | O vendedor nunca fica parado |
| V9 | **Anotação por áudio** (grava e transcreve no checklist) | No celular, falar é mais rápido que digitar depois da ligação |
| V10 | **Instalar como app** (PWA, ícone na tela inicial) | Abrir em 1 toque, como um app de verdade |
| V11 | **Linha do tempo do lead** (mensagens enviadas, mudanças de etapa, checklist) | O Arthur e o vendedor veem a história inteira sem ler anotações soltas |
| V12 | **Ranking entre vendedores** (contatos, respostas, propostas) quando houver mais de um | Competição saudável e visão de quem converte melhor |

## Pendências e ideias levantadas antes

| Item | Observação |
|---|---|
| Portugal e Espanha | Espaço reservado no card "Dinheiro na mesa". Falta: preço em euro (`planos.ptpt.js` e `planos.eu.js` do portfólio), cotação do euro, mensagens em pt-PT e espanhol, WhatsApp +351/+34. |
| Captação para a loja Prog Imports | Revendedores, assistências técnicas, empresas com frota. O dono adiou (27/10). |
| Domínio do diagnóstico | Hoje sai em prog-imports.com (domínio da loja). Melhor num domínio da Prog Soluções; liga com o "domínio próprio" do backlog do portfólio. |
| Botão "Agendar 20 min" | No diagnóstico e no e-mail, quando existir o Cal.com (backlog do portfólio). |
| Aviso no celular do lead quente | Hoje o aviso aparece só no painel (topo e selo laranja). Push no celular precisa de infraestrutura nova. |
| Docker caindo no lote longo | Log mostra o "Resource Saver" do Docker Desktop. Se repetir, desativar nas configurações (pedir ao dono antes). |
| Mais cidades | Capitais do Brasil e cidades com brasileiros nos EUA (Pompano Beach, Framingham, Marlborough, Newark, Danbury). |
