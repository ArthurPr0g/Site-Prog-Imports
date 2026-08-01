# ERP Prog Imports — roadmap, decisões e estado

Documento de continuidade. O ERP está sendo construído em módulos dentro deste
mesmo repositório, na área `/admin`. Se você é uma sessão nova retomando este
trabalho, **leia este arquivo antes de mexer em qualquer coisa** — o histórico
do git tem o "como", este arquivo tem o "por quê" e o "o que falta".

Fonte original dos requisitos: `C:\Apps\Uso do Claude\erp-regras-e-visual-6-paginas.md`
(especificação de Estoque, Orçamentos, Vendas, Financeiro, Trocas e Prestação de
Serviços, extraída de um sistema Flask anterior).

---

## Estado dos módulos

| # | Módulo | Estado | Rota |
|---|---|---|---|
| M0 | Navegação (6 grupos no menu) | **Pronto** | — |
| M1 | Clientes + Parâmetros do sistema | **Pronto** | `/admin/clientes`, `/admin/configuracoes` |
| M2 | Estoque + selo de pronta entrega | **Pronto** | `/admin/estoque` |
| M3 | Orçamentos Loja + cotação automática | **Pronto** | `/admin/orcamentos-loja` |
| M4 | Vendas | Pendente | `/admin/vendas` |
| M5 | Financeiro (livro-caixa) | **Pronto** | `/admin/financeiro` |
| M6 | Serviços (cadastro) + Prestação | Pendente | `/admin/servicos-internos`, `/admin/prestacao-servico` |
| M7 | Orçamentos Serviços | Pendente | `/admin/orcamentos-servicos` |
| M8 | Avaliação de Troca | Pendente | `/admin/avaliacao-troca` |
| M9 | Relatórios | Pendente | `/admin/relatorios` |

Os módulos pendentes aparecem **apagados no menu lateral** (propriedade
`pendente` em `AdminSidebar.tsx`). Ao concluir um módulo, remova a marcação —
é o que mantém o menu honesto sobre o que existe.

Ordem de dependência: M8 (Trocas) é o mais complexo e depende de M2, M4 e M5
estarem sólidos, porque uma troca cria itens de estoque, gera uma venda e lança
no financeiro numa transação só.

---

## Decisões tomadas (não redecidir sem falar com o dono)

**Clientes.** `profiles` continua sendo "quem tem conta no site" (id referencia
`auth.users`). O ERP usa a tabela `customers`, independente, com `profile_id`
opcional. Quem compra por WhatsApp nunca vai logar. Só o **nome** é obrigatório
— exigir e-mail faria o operador inventar dado para conseguir salvar.

**Vínculo cliente↔conta do site.** Nunca automático. Quando alguém criar conta
com e-mail e nome iguais aos de um cliente já cadastrado, a **própria pessoa**
confirma se é ela antes de vincular (e-mail compartilhado em família ou empresa
juntaria históricos de gente diferente). `findCustomerCandidates` já existe;
**a tela de confirmação no cadastro do site ainda não foi implementada.**

**Estoque × catálogo do site.** São coisas separadas. A loja trabalha por
encomenda: o produto continua à venda sem unidade em mãos. O vínculo do item de
estoque com um produto do catálogo é **opcional** — existe item comprado para
revenda que nunca aparece na loja e é vendido só pelo sistema.

**Cada item de estoque é uma unidade.** Sem coluna de quantidade; os
indicadores contam linhas.

**Selo de pronta entrega.** Só um selo, sem número. Aparece quando há unidade
com status `Disponível` vinculada ao produto, e some quando a última é vendida.
A ausência **não** significa indisponível. A loja lê a função
`ready_stock_counts()` (security definer), nunca a tabela — ela tem custo de
aquisição e margem.

**Vendas.** O ERP absorve os pedidos do site: uma tabela só, com cabeçalho e
itens. Venda manual nasce com um item e os custos USD/BRL; venda do site nasce
com N itens. Os 8 pedidos existentes eram teste e **podem ser apagados**.
Consequência a tratar no M4: `/conta/pedidos`, a timeline de 10 etapas e o
checkout leem `orders` hoje e precisarão ler a tabela nova.

**Cotação do dólar.** Definida em Configurações, nunca no formulário do
orçamento — fonte única de verdade. Cotação nula = "não configurada": o cálculo
é **recusado**, nunca assume 1.

O ponto de congelamento é **"Aprovado"**, não a conversão em estoque: enquanto
a proposta não foi aprovada ela acompanha o câmbio (se o cliente fechar amanhã,
o preço é o de amanhã); a partir de aprovada o valor virou compromisso e
recalcular mudaria um preço já acordado. Salvar a cotação **reaplica sozinho**
nos não aprovados — não depende de ninguém lembrar de clicar em nada.

**Busca automática da cotação.** Botão em Configurações consulta duas APIs
gratuitas sem chave, em ordem (AwesomeAPI e open.er-api), e soma a
`usd_rate_spread` — a taxa que a Prog paga por dólar comprado, configurável,
padrão R$ 0,10. **A AwesomeAPI falha a partir da Vercel** mesmo funcionando de
rede residencial; a segunda fonte é quem responde na prática. O valor buscado
não é salvo sozinho: entra no campo para conferência.

Não há atualização diária automática, por decisão do dono. Em compensação, a
tela de orçamentos **avisa quando a cotação salva está velha** (diferença de 5
centavos ou mais em relação ao mercado).

**Serviços.** Dois cadastros independentes: os da **Loja** aparecem no site
público; os de **Cadastro** são os que a Prog presta fora dela (criação de
sites, sistemas, design) e nunca aparecem no site.

**Orçamento de Serviços.** Proposta para os serviços internos. Quando aprovado,
**vira uma Prestação de Serviço**, e é a Prestação que lança no Financeiro —
uma receita só. Espelha o fluxo da loja (orçamento → estoque → venda) e elimina
a contagem dupla por construção, não por disciplina.

Campos definidos pelo dono: **vários serviços por orçamento**, com valores
separados e somados no total. **Sem validade** de proposta. **Prazo por
serviço**, somados ao final. Forma de pagamento **não** entra no orçamento — é
pedida no momento da aprovação, junto das demais informações necessárias.

**Serviços internos (M6).** O dono preenche título, descrição, valor, prazo e
categoria. É esse cadastro que alimenta o Orçamento de Serviços, com o valor
ajustável na proposta.

**Relatórios.** Dados brutos das tabelas macro (vendas, estoque, orçamentos,
financeiro, clientes), com filtro por período e exportação.

**Visual.** Mantém o tema escuro com laranja do site. O design system roxo do
documento original foi descartado.

**Escopo.** O ERP é **exclusivo da Prog Imports**, não entra no modelo
replicável da RFC-0001. Como o repositório é único para todas as lojas
(RFC-0001 §4.3b), lojas de cliente receberiam este código sem usar — a mitigação
prevista é uma variável de ambiente que esconde as rotas.

---

## Orçamentos Loja (M3) — regras confirmadas

Cinco componentes digitados em **USD**, convertidos multiplicando pela cotação:

1. Valor do Produto
2. Imposto
3. Taxa Viajante
4. Taxa Grabr
5. Processamento

O **Frete** é o único invertido: digitado em **BRL**, convertido para USD
dividindo pela cotação.

- Valor Total USD = soma dos 5 em USD + frete convertido
- Valor Total BRL = soma dos 5 em BRL + frete em BRL
- Lucro = Valor de Venda (BRL, livre) − Valor Total BRL
- Margem = Lucro / Valor de Venda × 100

**Nenhum componente é calculado por percentual sobre outro** — todos os valores
em dólar são digitados. Confirmado com o dono.

Status: `Em elaboração` → `Enviado` → `Aguardando Cliente` → `Aprovado` →
`Convertido em Estoque`. `Reprovado` é a saída negativa.

Verificado em produção (2026-08-01): cálculo ao vivo igual ao gravado no banco;
frete invertido correto; orçamento não aprovado acompanhou o câmbio ao subir de
5,1664 para 6,00 (margem caiu de 21,70% para 9,33%); aprovado permaneceu em
6,00 com o sistema em 7,50; conversão em estoque herdou custo, cotação
congelada e cliente; exclusão com item vinculado foi recusada.

---

## Financeiro (M5) — regras confirmadas

Uma tabela só, `finance_entries`, com `kind` = `receita` | `despesa`. Os dois
lados têm os mesmos campos e todo relatório precisa deles juntos e ordenados por
data — duas tabelas obrigariam a um `UNION` em toda consulta.

`status` = `Pago` | `Previsto`, com padrão **Previsto** (parcela e conta a pagar
são o caso mais frequente). Só o que está `Pago` entra no **resultado real** e no
**gráfico de fluxo de caixa**; o previsto aparece na segunda linha de
indicadores. Na tela, receita `Pago` é rotulada **Recebido** — quem recebe não
"pagou" nada. O dado guardado é o mesmo; a diferença é só de linguagem
(`rotuloStatus` em `lib/finance.ts`).

`source` = `manual` | `venda` | `servico`. Lançamento gerado por venda ou
serviço **não pode ser excluído pela tela do Financeiro**: o registro de origem
continuaria afirmando que houve dinheiro e o caixa discordaria. A ação recusa e
manda ajustar a origem. `reference_id` aponta para o registro de origem, sem FK
porque aponta para tabelas diferentes conforme o `source` (e M4/M6 ainda não
existem). `installment_id` agrupa as parcelas de um mesmo lançamento.

**Filtro de período** com prioridade fixa, para dois filtros preenchidos ao mesmo
tempo nunca darem resultado ambíguo: `tudo` > `ano` (com `mês` opcional dentro) >
`mês` no ano corrente > datas manuais. O padrão é do dia 1º do mês corrente até
hoje. Os campos se anulam na tela — escolher ano desmarca "Tudo" —, senão o
usuário mexe num filtro e o resultado não muda, sem explicação.

**Datas são dias de calendário, não instantes.** `toISOString()` converte para
UTC antes de cortar, o que no Brasil devolve o dia anterior para qualquer horário
antes das 21h; no dia 1º de cada mês isso fazia o período padrão começar no mês
errado. `lib/finance.ts` monta as datas pelos componentes locais.

**Ressalva sobre "resultado".** Enquanto M4 e M6 não existem, resultado é receita
menos despesa. Quando existirem, a receita de venda precisa entrar pelo **lucro**
e não pelo faturamento — senão o preço cheio conta como ganho, o custo de
aquisição some da conta e o resultado infla. Lançamento manual continua entrando
integral: quem lança R$ 500 recebidos e não lança o custo está declarando que não
houve custo.

Testado em `scratchpad/test-finance.mjs` antes da UI (21 asserções: prioridade do
filtro, fevereiro bissexto, virada de mês às 00h, indicadores, fluxo mensal).

---

## Botão "Gerar Venda" (pedido, ainda não construído)

Cada orçamento deve ganhar um botão que faz de uma vez o que hoje seria manual:
cria a **Venda**, alimenta o **Financeiro** e lança o(s) produto(s) no
**Estoque**. Antes de gerar, precisa **conferir se a cotação salva é a de
mercado**, porque a atualização é manual e o dono pode esquecer — a função
`checkUsdRateFreshnessAction` já existe e resolve essa parte.

Depende de M4 e M5. Construir antes seria escrever em tabelas que não existem.
Quando os dois estiverem prontos, este botão é o melhor teste de que os módulos
conversam: se o fluxo inteiro roda num clique, a integração está certa.

## Em aberto

1. **Confirmação de vínculo no cadastro do site** (M1, não implementado).
2. **Proteções de exclusão do estoque** (item vendido, item usado em troca)
   dependem de M4 e M8 — o `deleteStockItemAction` já tem o lugar marcado.
3. **Variável de ambiente para esconder o ERP** em lojas de cliente.
4. **Prazo de entrega, forma de pagamento e PIX parcelado** ficaram fora do
   formulário de orçamento por decisão do dono, mas as colunas existem no banco
   (`delivery_time`, `payment_method`). Sem forma de pagamento, o orçamento
   exportado não comunica condições ao cliente, e o "prazo padrão" configurado
   no M1 segue sem uso.

---

## Convenções deste projeto

- **Migrations** ficam em `supabase/migrations/`, aplicadas via MCP. O ledger do
  Supabase **não** bate com os nomes dos arquivos — conferir schema por objeto
  (`information_schema`), nunca por `list_migrations`.
- **Tipos do banco** em `src/lib/supabase/database.types.ts` são editados à mão
  ao adicionar tabela; regenerar o arquivo inteiro é caro.
- **Client component não importa de `lib/data/*`** — isso arrasta `next/headers`
  para o bundle do navegador e o build quebra. Tipos e cálculos puros vão em
  `lib/<dominio>.ts` (ver `lib/stock.ts`).
- **CSS sem layer vence `@layer utilities`.** Regra global solta anula classes
  do Tailwind em silêncio. Ver o comentário em `globals.css` sobre `a { color }`.
- **Cor da marca** nunca em hexadecimal cravado — há regra de lint que recusa.
  Use `var(--color-accent)` ou `rgb(var(--brand-accent-rgb) / .X)`.
- **Validar em produção com o navegador embutido** exige frontear a aba
  (`tabs_select`) antes de medir ou tirar screenshot: aba em background congela
  animações e devolve frames intermediários que parecem bug.
- **Número digitado passa por `parseNumeroBR`** (`lib/format.ts`), nunca por
  conversão improvisada. A versão anterior era duplicada em três componentes e
  tratava todo ponto como milhar — quando a busca automática preencheu a
  cotação com "5.1664", gravou 51664 como câmbio oficial. Valor plausível o
  bastante para passar despercebido, e salvar a cotação dispara recálculo em
  massa.
- **Cálculo que aparece na tela e é gravado no banco usa a MESMA função**
  (`lib/quotes.ts` roda no formulário e na action). Duas implementações
  divergem com o tempo e a tela passa a mostrar um número enquanto o banco
  grava outro.
- **Testar a regra de negócio antes da tela.** O motor de orçamento foi
  validado com casos conferidos à mão (`scratchpad/test-quotes.mjs`) antes de
  existir formulário — dois deles quebrariam em produção (`Infinity` por
  cotação zero, `NaN` por venda zero).
