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
| P1 | Aplicar a migration `0062` em produção e rodar `get_advisors` | a fazer | Passo 2 acima. Só numa sessão aberta na pasta **Prog Soluções** (MCP `supabase-arthurmatos003`). |
| P2 | Push dos commits locais e acompanhar o deploy | a fazer | Depois do P1, nunca antes (a tela sem a tabela quebra). |
| P3 | Testar no Chrome, iPhone e Android pelo acesso do dono | a fazer | O Android ainda não foi testado em nenhuma versão (emulador não abria o Chrome após boot a frio). |
| P4 | Conferir se `NEXT_PUBLIC_WHATSAPP_NUMBER` na Vercel é `5562982133188` | a fazer | É o número de serviços (padrão do código). |
| P5 | Importar em produção os CSVs de `google-maps-scraper-kit\resultados` | a fazer | Passo 6 acima. Lote de Goiânia (36 nichos) e Orlando (18) rodando em 27/10. |
| P6 | Gerar o link do Felipe e mandar para ele | a fazer | Passo 7. Falta o WhatsApp dele. |

Fora do repositório (só no PC, não vão no push): a alteração do kit do scraper
(`scrape.py` lendo `GMAPS_LANG`), o `docker-compose.override.yml` que desliga a
telemetria do engine e o ambiente de teste local
(`3 - Ferramentas\prog-imports-local`).

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
- **"Valor na mesa"** diz "uma vez" / "todo mês" e mostra o total em 12 meses de contrato.

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
| Portugal e Espanha | Espaço reservado no card "Valor na mesa". Falta: preço em euro (`planos.ptpt.js` e `planos.eu.js` do portfólio), cotação do euro, mensagens em pt-PT e espanhol, WhatsApp +351/+34. |
| Captação para a loja Prog Imports | Revendedores, assistências técnicas, empresas com frota. O dono adiou (27/10). |
| Domínio do diagnóstico | Hoje sai em prog-imports.com (domínio da loja). Melhor num domínio da Prog Soluções; liga com o "domínio próprio" do backlog do portfólio. |
| Botão "Agendar 20 min" | No diagnóstico e no e-mail, quando existir o Cal.com (backlog do portfólio). |
| Aviso no celular do lead quente | Hoje o aviso aparece só no painel (topo e selo laranja). Push no celular precisa de infraestrutura nova. |
| Docker caindo no lote longo | Log mostra o "Resource Saver" do Docker Desktop. Se repetir, desativar nas configurações (pedir ao dono antes). |
| Mais cidades | Capitais do Brasil e cidades com brasileiros nos EUA (Pompano Beach, Framingham, Marlborough, Newark, Danbury). |
