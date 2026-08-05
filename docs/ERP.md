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
| M6 | Serviços (cadastro) + Prestação | **Pronto** | `/admin/servicos-internos`, `/admin/prestacao-servico` |
| M7 | Orçamentos Serviços | **Pronto** | `/admin/orcamentos-servicos` |
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
são o caso mais frequente). Só o que está `Pago` entra na **linha "no período"**
e no **gráfico de fluxo de caixa**. Na tela, receita `Pago` é rotulada
**Recebido** — quem recebe não
"pagou" nada. O dado guardado é o mesmo; a diferença é só de linguagem
(`rotuloStatus` em `lib/finance.ts`).

**As duas linhas de indicadores são leituras diferentes do mesmo filtro**
(decisão do dono). A de cima, "no período", é só o que já movimentou dinheiro. A
de baixo, "prevista", é **tudo que foi lançado no período** — movimentado ou não,
o total esperado, não "o que falta". Lidas juntas, a diferença é o que ainda está
por acontecer: previsto R$ 10.000 com real R$ 6.900 significa R$ 3.100 a entrar.
Se o previsto excluísse o já pago, os dois cards não seriam comparáveis e o total
do período não apareceria em lugar nenhum. Cada card carrega a nota "já
recebida" / "tudo lançado", porque dois rótulos parecidos com regras diferentes
confundem sem isso.

`source` = `manual` | `venda` | `servico`. Lançamento gerado por venda ou
serviço **não pode ser excluído pela tela do Financeiro**: o registro de origem
continuaria afirmando que houve dinheiro e o caixa discordaria. A ação recusa e
manda ajustar a origem. `reference_id` aponta para o registro de origem, sem FK
porque aponta para tabelas diferentes conforme o `source` (e M4/M6 ainda não
existem). `installment_id` agrupa as parcelas de um mesmo lançamento.

**Filtro de período** com prioridade fixa, para dois filtros preenchidos ao mesmo
tempo nunca darem resultado ambíguo: `tudo` > `ano` (com `mês` opcional dentro) >
`mês` no ano corrente > datas manuais. Os campos se anulam na tela — escolher ano
desmarca "Tudo" —, senão o usuário mexe num filtro e o resultado não muda, sem
explicação.

O padrão cobre o **mês corrente inteiro**, não "até hoje". A primeira versão
cortava em hoje e o teste em produção mostrou o estrago: lançamento `Previsto` é
por definição futuro, então os três indicadores de previsto abriam sempre zerados
e uma despesa marcada para o dia 20 ficava invisível na tela — justamente a
informação que esses cards existem para dar. Pelo mesmo motivo "Tudo" vai até a
**última** movimentação, não até hoje.

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

Regras testadas antes da UI (34 asserções: prioridade do filtro, fevereiro
bissexto, virada de mês às 00h, mês inteiro no padrão, previsto nunca menor que
o real, fluxo mensal).

Verificado em produção (2026-08-01): "3.500,50" e "1.200" gravados certos;
edição reabriu o campo em formato brasileiro; período padrão abriu em agosto
inteiro e trouxe a despesa prevista do dia 20; "Tudo" foi de 10/05 a 20/08 (da
primeira à última movimentação, não até hoje); no gráfico, R$ 3.450,13 rendeu
75px contra 150px de R$ 6.900,25 — escala exata —, e o lançamento `Previsto`
ficou de fora; exclusão de lançamento com origem `venda` foi recusada com ✕
vermelho, a de lançamento manual passou. Dados de teste removidos ao final.

---

## Serviços e Prestação (M6) — regras confirmadas

Três tabelas: `internal_services` (catálogo), `service_orders` (a execução) e
`service_order_items` (os serviços de cada prestação).

**Catálogo separado da vitrine.** `internal_services` não tem relação com
`services`, que é o que o visitante vê no site. Públicos e ciclos de vida
diferentes; misturar faria um serviço interno aparecer para o cliente. Campos:
título, descrição, categoria, valor, prazo em dias, ativo.

**Prazo é SOMA, não máximo.** Os serviços de uma prestação são executados em
sequência — quem faz o site depois faz o sistema. Prazo por máximo prometeria ao
cliente uma entrega que a operação não cumpre. A data de entrega é
`início + soma dos prazos`, montada pelos componentes locais da data (`new
Date('2026-08-01')` é meia-noite UTC e no Brasil devolve 31/07).

**Item copia do catálogo, não referencia.** Escolher um serviço preenche nome,
valor e prazo; a partir daí o item é dele. Preço de catálogo que muda depois não
pode reescrever uma prestação já fechada. Por isso `total_amount` e
`lead_time_days` também ficam gravados na prestação.

**Execução e pagamento são campos separados.** `status` (Em andamento →
Concluída, com Cancelada como saída) e `payment_status` (Previsto | Recebido).
Serviço entregue não é serviço pago; com um campo só, um dos dois teria que
mentir.

**Cada prestação lança UMA receita no Financeiro**, nunca uma por serviço — é
assim que a contagem dupla é impedida por construção. `source = 'servico'`,
`reference_id` = id da prestação. O status da receita espelha o **pagamento**,
não a execução. **Cancelada não lança nada** e remove o lançamento existente:
serviço cancelado não é dinheiro previsto, e deixá-lo lá inflaria o previsto com
algo que ninguém vai receber.

A sincronia roda **depois de todo salvamento**, não só na criação, porque o
lançamento depende de campos que mudam ao longo da vida da prestação. Não é
transacional: se o Financeiro falhar, a prestação continua salva e um novo
salvamento conserta. Função no banco seria mais peso do que este volume paga.

Excluir a prestação apaga o lançamento **primeiro** — a tela do Financeiro
recusa excluir linha de origem `servico`, então a ordem inversa deixaria a
receita órfã e impossível de remover pela interface.

Serviço do catálogo em uso por alguma prestação **não pode ser excluído**; a
saída é desativá-lo, que o tira de novos orçamentos sem mexer no histórico.

Regras testadas antes da UI em `scratchpad/test-services.mjs` (28 asserções:
soma de valores e prazos, virada de mês/ano e fevereiro bissexto na entrega, as
seis combinações de status × pagamento no lançamento, canceladas fora dos
indicadores).

Verificado em produção (2026-08-01): escolher do catálogo copiou nome, valor e
prazo; dois serviços (R$ 4.500 / 20d + R$ 1.200,50 / 7d) deram total
R$ 5.700,50 e entrega em 28/08 — soma, não máximo; serviço inativo ficou fora do
seletor; o Financeiro recebeu **uma** receita na data de entrega. Marcar
Recebido virou a mesma linha para Pago **sem duplicar**; Cancelada removeu o
lançamento e manteve os itens; voltar para Em andamento o recriou — a sincronia
é idempotente. Excluir serviço em uso foi recusado com ✕ e a orientação de
desativar; excluir a prestação levou lançamento e itens junto. Dados de teste
removidos ao final, incluindo o catálogo, que é do dono para preencher.

---

## Planos mensais — regras confirmadas

Serviço do catálogo tem `billing_type` = `unico` | `mensal`. Em `mensal`, o
`price` é a **mensalidade**, e a prestação que o inclui vira um **plano** de
**6, 12 ou 24 meses** (12 é o padrão do dono).

**Uma parcela por mês, todas lançadas de uma vez.** É o que faz o gráfico de
fluxo de caixa mostrar o que entra em cada mês; um lançamento único com o total
do contrato criaria um pico num mês que nunca acontece. Alternativa descartada:
gerar a parcela só quando o mês chega — perderia a visão do contratado para
frente, que é justamente para o que o status `Previsto` existe.

**Valor único e mensalidade em colunas separadas** (`total_amount` e
`monthly_amount`). É como o contrato é lido — "R$ 4.500 + R$ 149/mês" — e somar
os dois apagaria quanto é recorrente. O valor de contrato (`total + mensal ×
meses`) é só de exibição; o Financeiro nunca recebe esse número de uma vez.

**A data da primeira mensalidade é escolhida na criação** (`plan_start_date`),
com a data de início como padrão. As demais caem no mesmo dia dos meses
seguintes.

**Serviço mensal não entra na soma do prazo.** Hospedagem e manutenção são
contínuas, não têm entrega, e somar o "prazo" delas empurraria a entrega do
trabalho real para meses à frente.

**`somarMeses` prende no último dia do mês** quando o dia não existe. Sem isso um
plano começado em 31/01 pularia fevereiro: o JavaScript transborda `new
Date(2026, 1, 31)` para 3 de março, e a parcela de fevereiro apareceria em março
junto da de março. Contrato mensal cobra "todo dia 31, ou o último se o mês não
tiver".

**A sincronização casa alvo com existente pelo NÚMERO da parcela**
(`installment_number`), não pela data. É isso que **preserva o status das
parcelas já baixadas**: sem o casamento, a única saída seria apagar e recriar, e
um plano de 24 meses perderia todos os recebimentos marcados por causa de uma
correção de título. O lançamento do trabalho é a exceção — o status dele vem do
`payment_status` da prestação. As parcelas nascem sempre `Previsto`: cada mês é
um recebimento independente.

**O Financeiro aceita mudança de STATUS em lançamento gerado, e só isso.** É como
se baixa cada parcela. Valor, data e descrição continuam vindo da origem — se
fossem editáveis, a próxima sincronização os reescreveria em silêncio. Os campos
aparecem travados na tela, com a razão escrita.

Indicadores de Prestação: **Recorrente/mês** (soma das mensalidades ativas, o
tamanho da receita recorrente) e **Valor em contratos** (trabalho + todas as
mensalidades). Perguntas diferentes; nenhum dos dois sozinho responde as duas.

Testado em `scratchpad/test-planos.mjs` (37 asserções: clamp do dia 31, virada de
ano, fevereiro bissexto, plano sem trabalho, trabalho sem plano, 6/12/24 meses).

Verificado em produção (2026-08-01): site R$ 4.500 + manutenção R$ 149/mês deu
contrato de R$ 6.288 e **13 lançamentos** — 1 do trabalho e 12 parcelas somando
R$ 1.788, de 08/2026 a 07/2027, num só `installment_id`; prazo ficou em 20 dias,
ignorando o mensal; no Financeiro os campos da parcela abriram travados e só o
status mudou. **Marcar duas parcelas como recebidas e depois editar o título da
prestação manteve as duas pagas** — a preservação funciona. Encurtar de 12 para 6
meses removeu as parcelas 7–12 e manteve as pagas; cancelar removeu as 6. Dados
de teste removidos ao final.

### Em aberto sobre planos

- **Aviso de contrato perto do fim** (pedido do dono, 2026-08-01, ainda não
  construído). Ele quer ser avisado **antes** do plano acabar, para procurar o
  cliente e negociar a renovação a tempo. Sem isso o contrato vence em silêncio
  e a conversa acontece depois de o cliente já ter parado de pagar — que é a
  pior hora para propor renovação.

  Os dados necessários já existem: `plan_start_date` e `plan_months` na
  `service_orders` dão a data de fim (`somarMeses(planStartDate, planMonths - 1)`
  é a última parcela). Falta decidir com o dono: **quantos dias de
  antecedência** (30 e 60 são os usuais; talvez configurável em Parâmetros do
  sistema), **onde o aviso aparece** (Dashboard, um cartão na tela de Prestação,
  ou os dois) e se basta destaque na tela ou se precisa de e-mail — este último
  exigiria envio agendado, que o projeto ainda não tem.

  Cuidado ao construir: o aviso deve considerar só prestações **não canceladas**
  e ignorar as que já foram substituídas por um contrato novo, senão vira ruído
  e passa a ser ignorado.

- **Renovação** não existe: ao fim do contrato o plano simplesmente termina. Um
  novo período exige nova prestação. Anda junto com o aviso acima — avisar sem
  ter como renovar em um clique resolve metade do problema.
- **Cancelamento no meio** só existe pelo status `Cancelada` da prestação, que
  apaga **todas** as parcelas, inclusive as já recebidas. Para encerrar um plano
  mantendo o histórico do que foi pago, hoje a saída é encurtar a duração.

---

## Orçamentos de Serviços (M7) — regras confirmadas

`service_quotes` + `service_quote_items`. Espelha o fluxo da loja: lá é
orçamento → estoque → venda, aqui é **orçamento → prestação**.

**O orçamento nunca toca no Financeiro.** É proposta, não dinheiro. Quem lança é
a prestação, e só ela — a contagem dupla fica impedida por construção, não por
disciplina.

Status: `Em elaboração` → `Enviado` → `Aguardando Cliente` → `Aprovado` →
`Convertido em Prestação`, com `Reprovado` como saída negativa. **`Convertido em
Prestação` não aparece no seletor**: é atingido pela conversão, nunca escolhido à
mão, senão o orçamento diria que virou prestação sem que nenhuma exista.

**Só orçamento aprovado converte.** Antes disso não há acordo com o cliente, e
converter criaria trabalho a executar que ninguém contratou.

**Sem validade e sem forma de pagamento** no orçamento (decisão do dono). Forma
de pagamento e data de início são pedidas **no momento da conversão**, e vivem na
prestação.

**Os itens são copiados na conversão, não movidos.** O orçamento continua sendo o
registro do que foi proposto; a prestação passa a ser o do que está sendo
executado. Editar uma não mexe na outra — é isso que permite comparar prometido
com entregue.

**A prestação nasce `Em andamento` / pagamento `Previsto`.** Aprovar é acordo,
não recebimento; o dono marca Recebido quando o dinheiro entra.

Orçamento já convertido **não pode mais ser editado nem excluído**: mexer nele
faria a proposta divergir da prestação que dela nasceu, e o cliente tem a versão
antiga em mãos. Excluir a prestação reabre o orçamento para nova conversão.

Nos indicadores, "em aberto" é o que ainda pode virar sim (elaboração, enviado,
aguardando); "aprovado" conta só o que ainda **não** foi convertido — é a fila de
trabalho. Convertido sai das duas contas: já aparece em Prestação, e contá-lo
aqui somaria o mesmo dinheiro duas vezes no painel.

Regras testadas em `scratchpad/test-service-quotes.mjs` (19 asserções: quem pode
converter, o status fora do seletor, e os convertidos/reprovados fora dos
indicadores).

**Excluir a prestação devolve o orçamento para `Aprovado`.** Isso não existia e
criava um beco sem saída: o orçamento ficava em `Convertido em Prestação` sem
prestação nenhuma, sem poder ser editado (a action bloqueia convertidos) nem
reconvertido (só `Aprovado` converte) — pelo caminho que a própria mensagem de
exclusão recomendava. **O mesmo valia para a loja desde o M3**;
`deleteStockItemAction` foi corrigida junto. As duas ações leem o vínculo
**antes** do delete, porque depois dele não há como saber a origem.

Verificado em produção (2026-08-01): 'Convertido em Prestação' fora do seletor;
dois serviços do catálogo deram R$ 5.700,50 / 27 dias; **orçamento aprovado não
lançou nada** no Financeiro; a conversão criou a prestação com os itens copiados
(orçamento manteve os seus), `quote_id` ligado, pagamento Previsto e uma receita
de R$ 5.700,50 em 28/08; o botão de converter sumiu e o link "ver prestação"
apareceu; editar e excluir o convertido foram recusados com ✕; excluir a
prestação devolveu o orçamento para Aprovado e permitiu reconverter. Dados de
teste removidos ao final.

---

## Desconto nos orçamentos — regras confirmadas

Campo de desconto em **porcentagem ou reais**, com **descrição** que sai no PDF.
Uma função só em `lib/discount.ts` para os dois orçamentos, o PDF e a prestação.

**Onde incide, e por quê é diferente nos dois:**

- **Loja:** sobre o **preço de venda**, derrubando lucro e margem. O custo com o
  fornecedor não muda — o desconto sai do bolso da Prog, e a margem precisa
  mostrar isso *antes* de o dono conceder. A margem passou a ser calculada sobre
  o preço que o cliente paga, não sobre o cheio: com desconto, usar o cheio
  mostraria uma margem que não existe.
- **Serviços:** sobre o **valor único**, nunca sobre a mensalidade. Ela é preço
  de tabela recorrente e descontá-la mudaria o contrato mensal inteiro. Para dar
  desconto na mensalidade, o valor do próprio item já é editável na proposta.

**A prestação também guarda o desconto**, herdado na conversão. Sem isso ele se
perdia: `total_amount` da prestação é recalculado dos itens a cada salvamento, e
os itens vêm com o valor cheio — editar a prestação devolveria o preço sem
desconto e o Financeiro passaria a esperar mais do que foi combinado.

**Os dois recálculos em massa da cotação** (`quotes.ts` e `settings.ts`)
reaplicam o desconto. Sem isso devolveriam lucro e margem do preço cheio,
apagando o desconto do painel sem mexer no valor gravado.

**No PDF** o desconto vira três linhas: subtotal, desconto com a descrição ao
lado, e investimento inicial. As **parcelas de 50% e o contrato usam o valor já
descontado** — os três números não podem se contradizer dentro do mesmo
documento.

**Limites presos no cálculo**, não em cada tela: percentual acima de 100 e
desconto maior que a base viram o teto. Sem isso o preço ficaria negativo e o
cliente receberia dinheiro para comprar.

Testado em `scratchpad/test-desconto.mjs` (29 asserções, incluindo o prejuízo
aparecendo quando o desconto come todo o lucro). Verificado em produção
(2026-08-05): 10% sobre R$ 4.500 deu R$ 4.050, contrato de R$ 5.838, parcelas de
R$ 2.025 e Cláusula 6 do contrato com o mesmo R$ 4.050; na Loja, 10% sobre
R$ 21.999 derrubou o lucro de R$ 3.005 para R$ 805 e a margem de 13,66% para
4,07%, ao vivo.

### Em aberto sobre desconto

- **Orçamento de Loja não tem PDF.** O desconto aparece na tela e no cálculo,
  mas o botão de proposta em PDF só existe em Orçamentos de Serviços. Se o dono
  quiser proposta impressa da loja, é reaproveitar `lib/pdf/proposta.tsx` com os
  campos de importação no lugar dos serviços.

---

## PDF de proposta com contrato — regras confirmadas

Cada linha de orçamento tem um botão que abre
`/api/orcamentos-servicos/[id]/pdf`. Página 1 é a proposta; se `include_contract`
estiver marcado, as seguintes trazem o contrato para assinatura. Gerado com
`@react-pdf/renderer` (runtime `nodejs` — precisa de acesso a arquivo).

**Fundo branco**, por decisão do dono: é documento para imprimir e assinar. A
identidade entra pela cor de destaque e pela logo (`public/images/logo.png`, lida
do disco e embutida como data URI), não pelo fundo escuro do site — que gastaria
tinta e sairia ilegível impresso.

**⚠️ Dado pessoal fora do código.** Nome, CPF/CNPJ, qualificação e foro do
contratado ficam em `site_settings` e são editados em Parâmetros do sistema. **O
repositório é público**: CPF em arquivo versionado fica exposto para sempre,
inclusive no histórico do git. `lib/contract.ts` não contém nenhum dado pessoal —
e não pode passar a conter.

**Um contrato, não dois.** Os dois `.docx` do dono ("com domínio" e "sem
domínio") são idênticos exceto por **uma linha** da Cláusula 2. A caixa "Cliente
já possui domínio" move `Domínio` da lista de inclusos para a de não inclusos e
troca o parágrafo da cláusula de domínio. Verificado: aparece em exatamente uma
das duas listas, nunca nas duas nem em nenhuma.

**Anexar o contrato é escolha por orçamento** (decisão do dono). O modelo é de
site institucional e não faz sentido numa mentoria ou num dashboard. A caixa se
sugere sozinha quando algum item tem "site" no nome, mas nunca desmarca o que o
dono marcou.

**Os valores vêm do orçamento, não do modelo** — R$ 1.000, R$ 149 e 12 meses do
`.docx` são substituídos pelo que está na proposta, e o prazo da Cláusula 3
também. Um contrato dizendo R$ 1.000 atrás de uma proposta de R$ 4.500, no mesmo
PDF, é o erro mais caro que este documento pode conter. Os totais são
**recalculados dos itens** na hora de gerar, em vez de lidos das colunas, para o
contrato não poder contradizer a lista logo acima dele.

**As cláusulas são numeradas pela ordem final**, nunca escritas à mão: Plano de
Hospedagem e Prazo Mínimo somem quando não há mensalidade, e com número fixo o
contrato pularia da 9 para a 11 — erro que só aparece depois de assinado. Com
plano são 17 cláusulas; sem, 15.

**As metades de 50%** arredondam ao centavo com a primeira levando o a mais, para
as duas somarem exatamente o total.

Testado em `scratchpad/test-contrato.mjs` (28 asserções). Verificado em produção
(2026-08-01): proposta de R$ 4.500 + R$ 149/mês gerou 5 páginas com contrato e 1
sem; contrato trouxe "até 20 (vinte) dias" e R$ 2.250 + R$ 2.250 do orçamento;
marcar "cliente possui domínio" moveu o item entre as listas; a última cláusula
foi a 17 (FORO) com o foro de Parâmetros. Orçamento de teste removido ao final.

### Em aberto sobre o PDF

- **Só existe o contrato de site institucional.** Orçamento de mentoria ou
  dashboard sai sem contrato. Contratos por tipo de serviço exigiriam um cadastro
  de modelos, ainda não discutido.
- **A proposta não tem validade** (decisão do dono para o orçamento), então o PDF
  também não traz prazo para o cliente responder.

---

## Botão "Gerar Venda" (pedido, ainda não construído)

Cada orçamento deve ganhar um botão que faz de uma vez o que hoje seria manual:
cria a **Venda**, alimenta o **Financeiro** e lança o(s) produto(s) no
**Estoque**. Antes de gerar, precisa **conferir se a cotação salva é a de
mercado**, porque a atualização é manual e o dono pode esquecer — a função
`checkUsdRateFreshnessAction` já existe e resolve essa parte.

O Financeiro (M5) já existe e a tabela aceita `source = 'venda'` com
`reference_id`. Falta o M4. Quando ele estiver pronto, este botão é o melhor
teste de que os módulos conversam: se o fluxo inteiro roda num clique, a
integração está certa. Ao lançar no caixa, lembrar da ressalva do M5 — a receita
de venda entra pelo **lucro**, não pelo faturamento.

O M6 já resolveu o equivalente do lado dos serviços e serve de molde:
`sincronizarFinanceiroDaPrestacao` em `lib/data/service-orders.ts` mostra a
forma — um lançamento por registro de origem, sincronizado a cada salvamento e
removido junto com a origem.

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
5. **Ordenação do catálogo de serviços.** A coluna `position` existe mas a tela
   ainda não permite reordenar; hoje a lista sai por `position` e depois nome.
6. **Parcelamento no Financeiro.** A coluna `installment_id` existe para agrupar
   as parcelas de um mesmo lançamento, mas nada na tela cria parcelas ainda —
   hoje o usuário lançaria uma linha por parcela na mão.
6. **`toast` com resultado da ação** foi corrigido no Financeiro; as demais telas
   do admin ainda passam só a mensagem e mostram ✓ em recusa.

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
