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
| M4 | Vendas + botão Gerar Venda | **Pronto** | `/admin/vendas` |
| M5 | Financeiro (livro-caixa) | **Pronto** | `/admin/financeiro` |
| M6 | Serviços (cadastro) + Prestação | **Pronto** | `/admin/servicos-internos`, `/admin/prestacao-servico` |
| M7 | Orçamentos Serviços | **Pronto** | `/admin/orcamentos-servicos` |
| M8 | Avaliação de Troca | **Pronto** | `/admin/avaliacao-troca` |
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

### A mensalidade é dívida em todo lugar (2026-08-06)

O plano estava certo no Financeiro (uma linha por mês) e **pela metade** no
resto. No histórico do cliente contava no "total comprado" e aparecia na aba
Serviços, mas ficava fora do carnê, do "em aberto", do "atrasado" e da
adimplência — um contrato de 12 × R$ 149 não aparecia como nada devido. Na conta
do cliente não aparecia: o farol lê `my_installments()`, que só olhava
`payment_installments`, e a mensalidade não mora lá.

**Onde ela mora não mudou.** O plano continua nascendo direto no Financeiro e é
lá que o dono baixa mês a mês — mudar isso mexeria num fluxo que ele não pediu
para mudar. O que mudou é que ela passou a ser **lida de volta como dívida**:
`mensalidadeComoParcela` converte num lugar só, e a partir dali resumo,
adimplência e farol enxergam a mesma dívida sem duplicar regra. A função do banco
ganhou a segunda metade, pelo mesmo corte que já separava as duas coisas na
coluna `installment_number` (abaixo de `OFFSET_PARCELA_PIX` é mensalidade, acima
é carnê).

Na página do cliente elas ficam em **bloco próprio**, separado do carnê — carnê é
parcelamento com fim, mensalidade é assinatura enquanto o plano durar — e agora
podem ser baixadas ali, sem atravessar para o Financeiro e caçar a linha do mês.
A adimplência passou a contar mensalidade vencida, inclusive nos selos de Vendas
e Orçamentos, que diziam "Adimplente" para quem estava com hospedagem atrasada.

Verificado em produção (2026-08-06): o cliente com plano de 12 × R$ 149 saiu de
"R$ 2.050 em aberto, 5 parcelas" para **"R$ 3.838, 17 parcelas"**; a baixa pela
página do cliente moveu R$ 149 para "já pago" e voltou ao desfazer.

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

## Avaliação de Troca (M8) — regras confirmadas

`trades` + `trade_items`. O cliente entrega produtos usados como parte do
pagamento de um item do estoque: troca e venda na mesma negociação.

**A regra que governa tudo: produto recebido NÃO é caixa.** Ele vira item de
estoque — um ativo — e só vale dinheiro quando for revendido. Lançar o valor
abatido como receita inventaria uma entrada que nunca aconteceu.

Então a venda gerada tem como receita apenas a **diferença em dinheiro**,
enquanto o **custo do principal entra inteiro** (mesmo critério do M4, onde o
custo é reconhecido na venda). **Consequência que a tela avisa antes de
concluir:** numa troca em que os produtos cobrem boa parte do preço, o resultado
imediato fica pequeno ou negativo. Está certo — o valor que falta está nos itens
que entraram no estoque, esperando revenda.

**Ao concluir**, em sequência: cada produto recebido vira item de estoque com
origem `Troca`; nasce a venda do principal; o item principal passa a `Vendido`;
o Financeiro recebe só a diferença. **Não é transacional** — o Supabase não expõe
transação pelo cliente HTTP —, então a ordem foi escolhida para uma falha no meio
deixar o estado legível: a troca é gravada primeiro e a venda por último, de modo
que uma interrupção deixa uma negociação **sem venda** (visível e corrigível) em
vez de uma venda órfã sem negociação.

**A diferença nunca fica negativa.** Se os produtos valem mais que o principal, o
cliente não paga nada e a sobra aparece como **excedente**, com aviso de que a
loja precisa acertar por fora. Número negativo ali seria impossível de
interpretar.

**A venda gerada só nasce pendente** quando há diferença **e** ela foi parcelada.
Diferença zero (produtos cobriram tudo) ou paga à vista já nasce quitada.

**PIX Parcelado usa o mesmo mecanismo dos outros módulos**, com uma diferença: o
carnê é calculado sobre a **diferença**, não sobre o preço do produto — o resto
já foi pago em mercadoria.

**Excluir a negociação** reverte a venda, devolve o principal ao estoque e
**apaga os itens recebidos**: se a negociação não aconteceu, aqueles produtos
nunca entraram na loja, e deixá-los inventariaria mercadoria inexistente.

A regra tem uma trava. Se algum item recebido já seguiu adiante — vendido,
reservado, em transporte, ou dentro de alguma venda — a exclusão inteira é
recusada, dizendo qual item e em que estado ele está. Apagá-lo furaria o
histórico de uma venda real por causa de um acerto administrativo, e apagar só
os livres deixaria a negociação meio revertida, que é pior que não reverter.

**Produto recebido não vai para o site.** Ele entra em `stock_items` sem
`product_id`, e `ready_stock_counts()` filtra `product_id is not null` — então
não aparece na vitrine nem conta como pronta entrega. Publicar é decisão do
dono, ligando o item a um produto pela tela de Estoque.

Testado em `scratchpad/test-trocas.mjs` (32 asserções). Verificado em produção
(2026-08-05): principal de R$ 3.000 (custo R$ 2.000) com iPhone recebido por
R$ 1.200 deu diferença de R$ 1.800 e lucro total de R$ 1.400; o carnê saiu **sobre
os R$ 1.800**, não sobre os R$ 3.000; ao concluir, o principal virou `Vendido`, o
iPhone entrou como estoque `Disponível` com custo R$ 1.200, nasceu a venda #1051
e o caixa recebeu 3 parcelas de R$ 600 mais a despesa de R$ 2.000; excluir
devolveu o principal a `Disponível` e apagou venda e parcelas.

A nova regra de exclusão foi testada em produção logo depois: com o item
recebido marcado `Reservado`, a exclusão foi recusada nomeando o item e o
estado; com ele `Disponível`, a negociação saiu, o principal voltou a
`Disponível` e o recebido deixou o estoque. Dados de teste removidos ao final.

### ⚠️ Bug encontrado no teste e corrigido

A lista vinha vazia com o banco cheio. Existem **duas** chaves estrangeiras entre
`trades` e `orders` — `trades.order_id` e `orders.trade_id` — e sem dizer qual
usar o PostgREST recusa a consulta por ambiguidade. A recusa chegava como
`data: null`, então a tela dizia "nenhuma negociação" logo depois de concluir
uma. Mesmo padrão da entrada que sumia do Financeiro: **leitura sem verificar
`error` escondendo o motivo**. A consulta passou a nomear a chave
(`orders!trades_order_id_fkey`) e a falha vai para o log.

---

## Histórico do cliente e adimplência — regras confirmadas

Clicar no nome do cliente abre `/admin/clientes/[id]` com abas **Financeiro,
Compras, Serviços e Orçamentos**, mais os cartões de total comprado, já pago, em
aberto e atrasado, e um aviso de produtos a caminho.

**A ponte que faltava.** As vendas apontavam para `profiles` (conta do site) e
os orçamentos/prestações para `customers` (cadastro do ERP). Sem unir, o
histórico apareceria pela metade — e era por isso que a venda gerada de orçamento
nascia sem vínculo, pendência registrada no M4. `orders` ganhou
`erp_customer_id`, com backfill do que dava para deduzir (venda cujo profile já
estava ligado a um cliente). A leitura busca **pelos dois vínculos**, para vendas
antigas não sumirem enquanto o cadastro não estiver todo ligado.

**A adimplência é derivada das parcelas, nunca gravada.** Um campo no cadastro
envelheceria em silêncio: a parcela vence sozinha e ninguém vai lá marcar. Assim
a resposta é sempre a de hoje. Uma parcela atrasada torna o cliente
**Inadimplente** mesmo com todas as outras em dia — é o pior caso que define a
situação. Sem nada vencido mas com parcelas a vencer: **Possui parcelas
pendentes**. Nada em aberto: **Adimplente**.

**O selo aparece nos três momentos pedidos:** cadastro, venda e criação de
orçamento. Nas listagens só aparece **quando há algo em aberto** — selo verde em
toda linha vira ruído e ninguém repara no vermelho.

**No consolidado, compra parcelada conta pelas parcelas e compra à vista pelo
status do próprio registro.** Misturar os dois critérios contaria duas vezes o
mesmo dinheiro. Cancelados ficam fora de tudo: não são compra nem dívida.

A venda manual agora também escolhe o cliente do cadastro, e a venda gerada de
orçamento já nasce vinculada.

**A aba Financeiro do cliente não é só leitura (2026-08-05).** É o mesmo carnê
das telas de Venda e Prestação: dá baixa, desfaz baixa, corrige valor e
vencimento, cancela e exclui — com a **origem de cada parcela** na frente, porque
a lista mistura vendas e serviços. Em ordem de vencimento, que a pergunta dessa
tela é "o que vence a seguir", não "de qual venda veio". Toda alteração
ressincroniza o Financeiro, o total em aberto e a adimplência.

Testado em `scratchpad/test-cliente.mjs` (31 asserções). Verificado em produção
(2026-08-05): cliente com 3 parcelas (1 recebida, 1 vencida, 1 a vencer) apareceu
como **Inadimplente (1)** na lista e no detalhe; os cartões deram R$ 29.697
comprado, R$ 2.000 em aberto e R$ 1.000 atrasado; a parcela de julho virou
**Atrasada sozinha**; e as 3 compras antigas do site apareceram junto da nova,
confirmando o backfill. Dados de teste removidos ao final.

### Em aberto sobre o histórico

- **A venda casa com o cliente pelo nome** nas listagens de Vendas, porque
  `orders.customer_name` é texto livre e nem toda venda tem vínculo. Errar só
  deixa o selo de fora, nunca mostra a situação de outra pessoa — mas o certo é
  ligar as 5 vendas antigas que ficaram sem `erp_customer_id`.
- **A mensalidade do plano não entra no "em aberto"** do cliente: ela é cobrada
  mês a mês e o recebimento vive no Financeiro, não no carnê.

---

## Parcelamento via PIX — regras confirmadas

Formas de pagamento viraram lista fechada, em Vendas e em Prestação: **PIX, PIX
Parcelado, Cartão de Crédito, Débito, Transferência**. Só o **PIX Parcelado**
gera carnê — no cartão a operadora repassa o valor cheio, então para o caixa da
Prog é uma entrada só, e o parcelamento é entre o cliente e o banco dele.

**As parcelas têm tabela própria** (`payment_installments`), não vivem só em
`finance_entries`. O dono precisa editar vencimento e cancelar parcela a parcela,
e a sincronização com o caixa recalcula os lançamentos a cada salvamento — essas
edições se perderiam. A tabela guarda o **plano de pagamento**; o Financeiro é o
**espelho contábil** dele.

**Juros simples sobre o valor financiado**, de 0 a 20%. É o que se combina num
parcelamento informal por PIX e o único que o cliente confere de cabeça: 10% de
R$ 1.000 é R$ 100, total R$ 1.100. **A entrada sai da base de juros** — quem paga
na hora não deve juros sobre aquilo.

**A parcela é truncada ao centavo e a ÚLTIMA absorve a sobra**, para as N
parcelas somarem exatamente o devido. Arredondar todas para cima faria o cliente
pagar centavos a mais; para baixo, a Prog receber menos.

**'Atrasada' não é status gravado** — é derivado de vencimento passado com a
parcela pendente. Gravá-lo exigiria uma rotina diária, e qualquer falha dela
deixaria o painel mentindo. Os gravados são Pendente, Recebida e Cancelada.

**Venda retroativa não precisa de tratamento especial:** a data informada é
sempre o vencimento da primeira parcela, então um carnê lançado hoje com primeira
em maio já nasce com as vencidas marcadas como atrasadas.

**Integração com o Financeiro — o ponto do pedido.** Com parcelamento, as
**parcelas são a receita**: uma linha por parcela em vez de uma receita única do
total. Cada uma entra como `Previsto` e **só vira `Pago` quando o dono marca
Recebida** — e aí o valor entra na receita, no fluxo de caixa e nos indicadores.
Parcela cancelada sai do caixa. O carnê casa por número ao regravar, então editar
a venda não apaga baixas nem vencimentos já ajustados.

**Edição manual do carnê (2026-08-05).** O dono edita **valor** e vencimento,
cancela e **exclui** parcela a parcela — pela venda, pela prestação ou pela
página do cliente, que é a mesma lista. Isso obrigou a mudar duas regras:

* **Salvar a venda não refaz mais o carnê**, a não ser que o total ou as
  condições (parcelas, entrada, juros, primeiro vencimento) tenham mudado. Antes
  ele era regerado a todo salvamento, o que desfaria ajuste manual em silêncio
  mesmo numa correção de nome do cliente.
* **Quando refazer é o que se quer, existe botão.** O aviso de carnê fora do
  valor traz "Refazer carnê", que recalcula valor e vencimento pelas condições
  gravadas e **preserva o status de cada parcela** — perder o registro do que já
  foi pago para consertar um cálculo seria destruir histórico de dinheiro
  recebido.

**⚠️ A data do caixa é a do RECEBIMENTO, não a do vencimento (2026-08-06).** O
lançamento usava o vencimento mesmo depois da baixa. Enquanto a parcela é
previsão isso está certo — o dinheiro é esperado naquele dia. Depois de recebida,
não: parcela vencida em 27/07 e paga em agosto ficava arquivada em julho, e como
o Financeiro abre no mês corrente, **dar baixa não mexia em nada na tela**.
Parecia falta de sincronia; era data errada.

A parcela guarda `paid_at`, e `dataDeCaixa()` decide: recebida vale o dia do
pagamento, pendente vale o vencimento. O formulário tem o campo **"Recebida em"**
(só aparece com a parcela recebida) e a lista mostra "pago em dd/mm" quando o
pagamento saiu do vencimento — que é o que explica o valor ter caído noutro mês.
A baixa pelo botão assume hoje; data diferente se corrige no formulário.

O backfill deu `paid_at = due_date` às já recebidas, que é o que o sistema vinha
usando: nenhum mês fechado se move sozinho. O que foi pago fora do prazo o dono
corrige uma a uma.

**⚠️ Baixar pelo Financeiro escreve na PARCELA.** Antes, marcar Pago naquela tela
gravava o status só na linha do caixa: a parcela continuava pendente na página do
cliente, e a próxima sincronização da venda reescrevia o status de volta para
Previsto, em silêncio. Agora a tela do Financeiro atualiza a parcela e
ressincroniza — quem manda é o carnê, o Financeiro é o espelho dele. As
mensalidades de plano seguem como eram: não têm registro próprio e são baixadas
ali mesmo.

**Carnê que não fecha se anuncia.** O bloco de parcelas soma o carnê e compara
com o devido (total **mais juros**, não o total puro), avisando quanto sobra ou
falta. Mesma regra do lucro de venda sem custo: número agregado que pode estar
errado tem que dizer isso na tela. A tolerância é de meio centavo, só para
descartar poeira de ponto flutuante — o carnê gerado já fecha no centavo, então
um centavo sobrando é sinal de que alguém mexeu.

**Excluir parcela não redistribui o valor** nas outras, e a confirmação diz isso.
Redistribuir seria adivinhar: pode ser antecipação (o valor já entrou noutra
parcela) ou renegociação (a dívida diminuiu), e as duas dão contas diferentes.

**Serviços:** o padrão continua **50% na contratação e 50% na entrega**, e a tela
lembra isso quando não há parcelamento. O carnê cobre só o **trabalho, já com
desconto** — parcelar o preço cheio cobraria um valor que ninguém combinou. A
mensalidade do plano fica de fora: ela já vira parcela por conta própria.

**As duas coisas coexistem**, e por isso as parcelas de PIX ocupam uma **faixa
deslocada** de `installment_number` (`OFFSET_PARCELA_PIX = 1000`). Sem isso a
parcela 1 do PIX e a mensalidade 1 colidiriam ao casar alvo com existente, e uma
sobrescreveria a outra. Quem manda no status também difere: a mensalidade é
baixada direto no Financeiro e a sincronização preserva o que estiver lá; a
parcela de PIX tem status vindo do carnê e sobrescreve.

### Farol do carnê na conta do cliente (2026-08-06)

Quem tem carnê vê em `/conta` (a página **Resumo**) quantas parcelas ao todo,
quantas pagas, quantas em aberto e quantas vencidas, com o valor de cada grupo, o
próximo vencimento e as próximas parcelas. Some para quem comprou à vista.

**O estado é o mesmo do gerenciamento** — reusa `calcularAdimplencia`, uma regra
só para os dois lados. Muda o texto: "Inadimplente" é palavra de cobrança
interna, não informa nada que "1 parcela vencida" já não diga, e soa como
acusação para quem talvez nem saiba que venceu. Na conta aparece como **Carnê
quitado**, **Em dia** ou **Parcela vencida**. Com atraso, o painel também para de
anunciar o "próximo vencimento": isso soaria como se estivesse tudo em dia.

O painel fica **acima do pedido em andamento** — dívida vencida é o que o cliente
mais precisa ver ao abrir a conta e o que ele resolve mais rápido — e traz o
atalho de WhatsApp quando há algo em aberto: aviso de vencimento sem caminho para
pagar só gera mensagem perguntando como pagar.

**`payment_installments` continua admin-only.** Quem responde é
`my_installments()`, `security definer`, como já é `ready_stock_counts()`. Policy
não serviria: precisaria consultar `orders`, `customers` e `service_orders`, as
três com RLS própria, e **subconsulta dentro de policy respeita a RLS da tabela
consultada** — a policy não veria nada e o cliente ficaria sem carnê, sem erro
nenhum aparecendo. A função busca o vínculo pelos **dois lados**
(`orders.customer_id` e `orders.erp_customer_id`), porque venda de PIX parcelado
costuma nascer no gerenciamento ligada só ao segundo. Cancelados ficam de fora e
o anônimo não tem `execute`.

Verificado em produção (2026-08-06): venda de teste de R$ 2.000 em 4× com a
primeira em maio deu **4 parcelas, 1 paga, 3 em aberto, 2 vencidas** no painel,
com o farol vermelho; o `anon` levou `permission denied` na função; e um cliente
com vendas mas sem carnê **não viu parcela nenhuma dos outros** (impersonação por
`request.jwt.claims`). Dados de teste removidos ao final.

A edição do carnê foi testada contra o **código real**, não contra cópia das
funções (`scratchpad/test-nome-e-carne.ts`, 34 asserções, roda com `npx tsx` na
raiz do projeto): nome, etiqueta, descrição no caixa, soma do carnê, divergência
com e sem juros, arredondamento da última parcela e origem das parcelas.
Verificado em produção (2026-08-05) na venda #1050: baixa, edição de valor e
vencimento e exclusão atualizaram cartões, carnê e Financeiro na hora; **salvar a
venda em seguida não desfez nada**; "Refazer carnê" devolveu as 8 parcelas de
R$ 406,25 mantendo a baixa; e a venda foi restaurada ao estado original ao final.

Testado em `scratchpad/test-parcelas.mjs` (47 asserções). Verificado em produção
(2026-08-05): venda de R$ 3.000 com entrada de R$ 600, 6× e 10% deu financiado
R$ 2.400, juros R$ 240, total R$ 3.240 e 6× de R$ 440, tudo ao vivo; o carnê saiu
com entrada + 6 parcelas somando R$ 3.240; baixar só a entrada deixou o
Financeiro com **R$ 600 recebido e R$ 3.240 previsto**; editar o nome do cliente
**não desfez a baixa**. Dados de teste removidos ao final.

### ⚠️ Bug encontrado no teste e corrigido

A entrada sumia do Financeiro: o `check` de `installment_number`, criado no M6
para as mensalidades, exigia número **≥ 1**, e a entrada é a parcela **0**. O
banco recusava a linha e, como o insert **não verificava erro**, a recusa era
engolida — o carnê somava R$ 3.240 e o caixa R$ 2.640, sem nada indicando o
motivo. O check passou a aceitar 0 e os inserts do Financeiro passaram a
registrar falha no log.

---

## Vendas (M4) — regras confirmadas

**Nenhuma tabela nova.** `orders` + `order_items` já era o "cabeçalho e itens"
decidido, então o ERP as estendeu com `origin`, `cost_total`, `budget_id`,
`unit_cost` e `stock_item_id`. O checkout, `/conta/pedidos` e a timeline de 10
etapas continuam funcionando sem reescrita — o que estava previsto como
consequência a tratar deixou de existir.

**A venda lança DUAS linhas no Financeiro: receita do total e despesa do custo.**
É assim que a ressalva do M5 se resolve sem mexer na fórmula do resultado —
receita menos despesa vira o lucro por construção, e o fluxo de caixa mostra as
duas pontas reais: o dinheiro que entrou do cliente e o que saiu para o
fornecedor. Lançar só o lucro esconderia o faturamento; lançar só a receita
inflaria o resultado com um custo que existe.

**O frete entra no total mas não no lucro** — é repasse, não margem. A margem
também é calculada sobre a mercadoria: no total, um frete maior faria a mesma
venda parecer pior.

**O status decide se o dinheiro entrou.** `Aguardando pagamento` deixa as duas
linhas como `Previsto`; `Pago`, `Enviado` e `Entregue` viram `Pago`. `Cancelado`
não lança nada. Trocar o status pela tela também sincroniza — sem isso o caixa
ficaria em Previsto depois de o cliente pagar.

**Vender item de estoque dá baixa nele**, e cancelar devolve para `Disponível`.
Sem isso o mesmo notebook continuaria como pronta entrega no site depois de
vendido, e o selo mentiria para o visitante.

**⚠️ A venda tem data própria (2026-08-06).** `orders.sale_date` guarda o dia em
que a venda aconteceu; `created_at` continua sendo só o registro do cadastro.
Antes o Financeiro usava `created_at`, e numa venda retroativa isso jogava o
**custo no mês do cadastro** — a receita ia para os meses certos, porque as
parcelas têm data própria, e a despesa caía num mês que não teve venda nenhuma.
O formulário tem "Data da venda", a venda gerada por troca usa o dia da
negociação, e listagens e histórico mostram essa data. Backfill: `sale_date =
created_at::date` em tudo que existia, que é o que o sistema vinha usando.

**⚠️ Compra de estoque é despesa na ENTRADA, não na venda (2026-08-06).**
Decisão do dono. Quem importa paga o fornecedor meses antes de vender: o mês da
compra não mostrava saída nenhuma, o da venda mostrava uma saída que já tinha
acontecido, e o dinheiro parado em estoque não aparecia em lugar nenhum.

Cadastrar item no estoque lança a despesa na **data de entrada** (que já era
editável). Em troca, **a venda desse item não lança custo** — senão o mesmo
dinheiro sairia duas vezes. Encomenda, sem item de estoque vinculado, continua
lançando o custo na venda: ali não houve compra para estoque. Venda mista lança
só a parte que não veio do estoque.

O **backfill era a parte crítica**: sem ele a mudança tiraria despesa sem repor
(itens antigos nunca geraram lançamento, e a venda deles deixaria de gerar),
inflando o lucro em silêncio. A migração 0042 cria a despesa de cada item já
cadastrado na data de entrada dele e ajusta as linhas de venda. Em produção
moveu R$ 3.942 de agosto para 06/03 e fez aparecer R$ 18.993,33 de mercadoria
comprada e não vendida, que nunca tinha passado pelo caixa.

**Os dois números medem coisas diferentes, e agora ambos dizem a verdade.** A
tela de Vendas segue mostrando lucro por venda com o custo cheio — é margem de
venda. O Financeiro virou fluxo de caixa de verdade: saída no mês em que se
pagou, entrada no mês em que se recebeu. Eles não batem dentro do mesmo mês, e
isso é correto.

**Toda venda tem nome (2026-08-05).** "Venda #1051" não identifica nada em lista
nenhuma. O nome é o **apelido** que o dono digitar e, quando ele não digita nada,
**sai dos próprios itens** ("iPhone 15 Pro +2"): zero digitação no caso comum,
controle quando o produto não basta — duas vendas do mesmo modelo para clientes
diferentes, por exemplo. Com vários itens mostra o primeiro e conta o resto, que
a lista inteira estoura qualquer coluna.

O nome aparece na tela de Vendas, no histórico do cliente, na busca e na
**descrição do Financeiro**, inclusive parcela a parcela — um extrato de "Venda
#1051, Venda #1052, Venda #1053" não dizia nada sobre o que foi vendido. A lista
de itens só aparece junto quando o nome é apelido; se o nome saiu deles, repetir
não acrescenta. O **número continua na frente** em tudo que é caixa: é ele que
liga a linha à venda.

**⚠️ Vendas sem custo inflam o lucro.** Venda do site nasce sem custo — o produto
é por encomenda e o custo só se conhece na compra. A tela conta quantas estão
assim e avisa, no lugar da margem. Em produção isso apareceu como R$ 70.440 de
lucro com 88% de margem, quase tudo faturamento sem custo lançado: número errado
com aparência de certo é pior que número ausente.

### Botão "Gerar Venda" — entregue

De um orçamento **Aprovado** sai a venda com preço e custo preenchidos: preço de
`sale_price_brl` menos o desconto, custo de `total_brl`. Só aparece em aprovado —
antes disso não há acordo, e vender criaria receita de algo que ninguém comprou.
Recusa se já houver venda gerada, dizendo o número dela. Excluir a venda devolve
o orçamento para `Aprovado`, como já fazem Estoque e Prestação.

Testado em `scratchpad/test-vendas.mjs` (34 asserções). Verificado em produção
(2026-08-05): orçamento de R$ 14.000 com 10% de desconto gerou a venda #1048 por
R$ 12.600 com custo R$ 9.600 e **duas linhas no Financeiro** (receita 12.600 +
despesa 9.600 = lucro 3.000), as duas como Previsto; mudar para Pago virou as
duas **sem duplicar**; excluir devolveu o orçamento para Aprovado e limpou o
caixa. Dados de teste removidos ao final.

### Etiqueta de transporte (2026-08-06)

Botão na linha de cada venda abre a pré-visualização e baixa um **PNG de 10 × 15
cm a 300 dpi** (1181 × 1772 px) — o formato que Correios e transportadoras
aceitam e que a térmica comum imprime sem redimensionar.

**Ver antes de baixar** porque etiqueta errada só aparece depois de impressa e
colada: endereço truncado, remetente em branco, CEP incompleto. Na tela o erro
custa um clique de fechar.

**O remetente vem de Configurações**, num bloco novo, e vai para `site_settings`
pelo mesmo motivo dos dados de contrato: repositório público, endereço com
CPF/CNPJ versionado fica exposto para sempre. Campos separados em vez de bloco de
texto porque a etiqueta destaca o CEP e quebra as linhas na ordem do envelope.

**O destinatário sai do endereço da própria compra** (`address_snapshot`) e, na
falta dele, do cadastro do cliente. Nessa ordem de propósito: o retrato é o
endereço que o cliente escolheu naquela compra, e mudança de cadastro hoje não
pode reescrever para onde uma encomenda antiga foi enviada. Nome, documento e
telefone vêm do cadastro de qualquer forma — o retrato não os guarda e a
transportadora precisa de alguém para procurar na entrega.

**Faltando dado, a pré-visualização lista o que falta e cada item aponta a tela
que o resolve**: remetente → Configurações, endereço → cadastro do cliente
vinculado, nome → o formulário da venda. Mandar tudo para a mesma tela seria pior
que não mandar para nenhuma.

**Desenho em canvas, sem dependência nova.** A etiqueta é um retângulo com sete
blocos de texto e uma imagem, e precisa sair idêntica toda vez, com pixel
previsível para térmica. Converter HTML em imagem traria biblioteca, dependeria
do CSS da página e mudaria de aparência a cada ajuste de tema. Fundo branco e
tinta preta: é papel para colar em caixa, muitas vezes impresso em monocromática.
O destinatário ocupa a maior área e o CEP tem caixa própria — é por ele que a
triagem separa a encomenda. O remetente é ancorado no rodapé, então o espaço em
branco fica no meio, onde a fita passa.

Testado contra o código real (`scratchpad/test-etiqueta.ts`, 33 asserções):
formatação de CEP, separação de cidade e UF (inclusive cidade com traço no nome,
que não pode perder o pedaço final), prioridade entre retrato e cadastro, retrato
vazio caindo no cadastro, rua sem número, linhas sem buraco e nome de arquivo sem
acento. Verificado em produção (2026-08-06): a venda #1047, do site, saiu com o
endereço do checkout; a #1050, manual, com o do cadastro; sem endereço, o aviso
apontou o cadastro do cliente certo; e o arquivo baixado é PNG de verdade
(assinatura `89 50 4E 47`), 1181 × 1772, ~177 KB. Dados de teste removidos.

⚠️ **O endereço do remetente está vazio em produção** — é dado do dono, ninguém
mais pode preencher. Sem ele nenhuma etiqueta sai.

### Em aberto sobre vendas

- **Custo do frete não é separado.** O frete cobrado do cliente entra na receita,
  mas o que a Prog paga de frete só entra se estiver embutido no custo do item.
  Numa venda vinda de orçamento isso já acontece (o frete é componente do
  orçamento); numa venda manual, não.
- **`customer_id` da venda gerada fica nulo.** `orders.customer_id` aponta para
  `profiles` (quem tem conta no site) e o orçamento guarda um `customers` do ERP
  — são tabelas diferentes. O nome do cliente é copiado, mas o vínculo não.
  Unificar isso é decisão maior, ligada à pendência de vínculo do M1.

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

### Proposta da loja em PNG (2026-08-06)

O botão de **duplicar orçamento deu lugar ao de gerar proposta**, por decisão do
dono. Sai uma imagem **1080 × 1350** — o retrato 4:5 que WhatsApp e Instagram
mostram inteiro, sem cortar borda nem exigir tela cheia —, com pré-visualização
antes de baixar.

**Só o resultado.** O orçamento guarda a formação de preço inteira: valor do
produto, imposto, taxa do viajante, processamento, câmbio, custo total, lucro e
margem. Nada disso é assunto do cliente — mostrar custo convida a negociar a
margem, e mostrar câmbio transforma cada oscilação do dólar em conversa. A
proposta leva foto, nome, specs, valor final, frete, formas de pagamento e o
aviso de que o valor acompanha o dólar até a confirmação.

**PIX Parcelado fica de fora das formas de pagamento**, por pedido explícito:
parcelar é concessão caso a caso, decidida na hora de lançar a venda. Anunciado
na proposta, todo cliente pediria, e a exceção viraria expectativa. Há teste
guardando isso.

⚠️ **Frete.** No orçamento, `shipping_brl` é o que a Prog **paga** para trazer o
produto — componente de custo, já coberto pelo preço de venda. Repassá-lo como
linha separada faria o cliente somar duas vezes. Por isso a proposta diz
**"incluso no valor"** quando há frete no custo, e "a combinar" quando não há.

**Escura, com a cor da marca**, ao contrário do PDF de contrato, que é branco.
São peças de uso diferente: o PDF vai para impressora e assinatura, esta imagem
vai para o WhatsApp e fica ao lado das fotos do site.

**A foto entra inteira e sem fundo (2026-08-06).** A primeira versão preenchia a
área cortando o excedente (`cover`), e foto quadrada em área larga perdia topo e
base — o notebook saía sem tela e sem teclado. Agora a foto é encaixada inteira,
centralizada; sobra espaço nas laterais quando a proporção não bate, e sobra é
melhor que faltar.

O fundo é recortado por **preenchimento a partir da borda** (`lib/image-cutout.ts`),
não por "toda cor parecida com o fundo": o preto do teclado é parecido com um
fundo cinza-escuro, mas não está ligado à borda, então sobrevive. É essa
diferença que separa recorte de destruição. A borda ganha rampa de
transparência, senão o corte binário deixa degraus no contorno.

Três guardas antes de confiar no recorte: os quatro cantos precisam concordar
sobre a cor do fundo (foto de ambiente desiste), e o que sobra precisa ficar
entre 4% e 97% da área. Falhando qualquer uma, vale a foto original — que também
entra inteira. Recorte quebrado não chega ao cliente.

O recorte resolve o enquadramento junto: sabendo onde o produto começa e termina,
a peça encaixa a caixa exata dele, em vez da foto com as margens que ela trazia.
Por isso a peça passou de 4:5 para **2:3** e a foto de 430 para 640px de altura —
com a foto inteira, um notebook quase quadrado ficava pequeno no meio do cartão.

⚠️ O recorte vale **só na proposta**, onde o desenho é nosso. As miniaturas das
listagens e as fotos do site continuam com o fundo original: tirá-lo lá exigiria
processar a imagem no upload (ou uma rota de imagem no servidor), não dá para
fazer no navegador a cada carregamento de página.

### Foto do produto nas listagens (2026-08-06)

Onde aparece nome de produto agora aparece a foto, com canto arredondado igual ao
dos cartões: **orçamentos de loja, vendas, estoque e trocas**. Numa lista de
notebooks com nomes de sessenta caracteres, a foto identifica a linha antes da
leitura.

A capa vem de `product_images` (a de menor `position`, a mesma da vitrine) e
**não filtra por produto ativo**: produto fora do ar continua aparecendo em
orçamento e venda antigos, e esconder a foto justamente aí deixaria a tela menos
reconhecível do que era antes. Em estoque e trocas, a **foto do próprio item
vence a do catálogo** — é a unidade que está na prateleira. Sem foto, o espaço
continua ocupado por um quadro neutro: sumir com ele faria as linhas dançarem de
altura conforme o cadastro tem ou não imagem. Uma consulta de capas por listagem,
nunca uma por linha.

⚠️ **`crossOrigin` é obrigatório ao carregar imagem para canvas.** A foto vem do
storage do Supabase, que é outro domínio; sem `img.crossOrigin = 'anonymous'` o
navegador marca o canvas como contaminado e `toDataURL` passa a lançar
`SecurityError` — o desenho aparece na tela e **o download morre**. O storage
responde com CORS aberto, então basta pedir.

O recorte foi validado contra a imagem real do catálogo antes de subir: fundo
(33,33,33) com divergência zero entre os cantos, caixa do produto 1175 × 966 de
1400 × 1400, 46,7% de pixels opacos, 41 ms — preservando tela, teclado e base. Na
peça final o produto ocupa 89% da altura da área, medido no canvas.

Testado contra o código real (`scratchpad/test-proposta.ts`, 16 asserções):
formas de pagamento, frete, desconto percentual e em valor, desconto maior que o
preço, e uma verificação estrutural de que o modelo enviado ao cliente não
carrega campo de custo, câmbio ou margem. Verificado em produção (2026-08-06): a
proposta do Alienware saiu com a foto real do catálogo e o download gerou PNG de
634 KB sem `SecurityError`; a etiqueta continuou funcionando depois de os dois
modais passarem a compartilhar o mesmo componente de pré-visualização.

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

### Assinatura do contratado (2026-08-06)

O bloco CONTRATADO sai com a **assinatura impressa sobre a linha** quando há uma
cadastrada. Sem cadastro, continua a linha em branco — nada muda para quem ainda
não enviou.

⚠️ **A imagem não vai para o repositório, e isso não é preciosismo.** O
repositório é público, e imagem versionada fica no histórico para sempre, mesmo
depois de removida. Com o arquivo em mãos, qualquer pessoa monta um documento
que parece assinado pelo dono. Ela é enviada pela tela de Configurações e
guardada no bucket **privado** `signatures` — o primeiro privado do projeto; os
de imagem do site são públicos porque foto de produto existe para ser vista, e
este existe para ser usado por uma pessoa só.

**Sem policy de leitura pública.** Quem lê é o servidor, com a sessão do admin, na
hora de montar o PDF; a imagem chega ao documento como data URI. O banco guarda o
**caminho**, não a URL: em bucket privado não existe URL permanente, e a assinada
expira. A prévia da tela usa URL assinada de dez minutos — permanente para este
arquivo valeria tanto quanto o arquivo.

**Só a altura da imagem é fixada** (42pt); a proporção original manda na largura.
Assinatura esticada é a primeira coisa que denuncia documento montado.

A tela pede **PNG com fundo transparente** e explica: JPG leva o retângulo branco
junto e cria uma emenda visível sobre o papel. Não dá para exigir, então aceita
qualquer imagem e avisa quando o formato não é o ideal.

**Falha ao baixar a assinatura não impede o contrato de sair** — sem a imagem ele
volta à linha assinável à mão. Um 500 na hora de mandar a proposta seria pior que
um contrato assinado a caneta. No upload, a anterior só é apagada **depois** que a
nova está gravada; na ordem inversa uma falha no meio deixaria o contrato sem
assinatura nenhuma.

Verificado em produção (2026-08-06) com um PNG sintético: upload gravou caminho e
arquivo, o contrato saiu com o traço sobre a linha e o rótulo "Assinatura"
embaixo, e a remoção limpou banco e bucket. O arquivo de teste foi removido — o
espaço está vazio esperando a assinatura real.

⚠️ **Pendente do dono:** enviar a assinatura em Configurações. Enquanto não
enviar, o contrato sai com a linha em branco.

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

### Módulos que faltam

1. **M9 — Relatórios.** Dados brutos das tabelas macro (vendas, estoque,
   orçamentos, financeiro, clientes), com filtro por período e exportação. É o
   único módulo do roadmap ainda não construído.

### Pedidos registrados e ainda não construídos

3. **Aviso antes do fim do contrato** de plano mensal — ver a seção "Em aberto
   sobre planos", que tem o que falta decidir com o dono.

### Dívidas técnicas

4. **Confirmação de vínculo no cadastro do site** (M1): `findCustomerCandidates`
   identifica candidatos, mas não existe a tela onde a pessoa confirma que é ela.
5. **Proteções de exclusão do estoque.** Item vendido foi resolvido no M4 (a
   venda dá baixa e devolve conforme o status). Falta barrar a exclusão de item
   que é produto principal ou produto recebido de uma troca — hoje o `on delete
   set null` das FKs deixa a negociação com o vínculo vazio em vez de recusar.
6. **Variável de ambiente para esconder o ERP** em lojas de cliente (RFC-0001).
7. **Prazo de entrega no orçamento de loja.** O "prazo padrão" configurado no M1
   segue sem uso, e a coluna `delivery_time` existe sem tela. Forma de pagamento
   deixou de ser problema: o M4 e o parcelamento cobriram isso na venda.
8. **Ordenação do catálogo de serviços.** A coluna `position` existe mas a tela
   não permite reordenar; hoje sai por `position` e depois nome.
9. **`toast` com resultado da ação** foi corrigido no Financeiro, em Vendas e nos
   módulos novos; as telas mais antigas do admin ainda passam só a mensagem e
   mostram ✓ em recusa.
10. **Orçamento de Loja não tem PDF** — só o de Serviços. Ganhou a **proposta em
    PNG**, que cobre o envio ao cliente; falta o documento imprimível.
11. **`window.confirm` nas telas antigas.** Existe `ui/ConfirmDialog.tsx`, usado
    na exclusão de parcela: diz o que a exclusão leva junto, foca no Cancelar e
    segue o tema. As outras telas ainda usam a caixa do navegador.

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
- **Quem gera lançamento no Financeiro sincroniza a cada salvamento**, casando
  alvo com existente por uma chave estável (número da parcela no M6, `kind` no
  M4) em vez de apagar e recriar. Recriar perde o que o dono já baixou como
  recebido. E a exclusão do registro de origem tira os lançamentos **antes** de
  apagar a si mesmo — a tela do Financeiro recusa excluir linha gerada, então a
  ordem inversa as deixa órfãs e sem remoção possível pela interface.
- **Subconsulta dentro de policy respeita a RLS da tabela consultada.** Uma
  policy que precisa olhar tabelas com RLS própria simplesmente não vê nada, e a
  tela fica vazia sem erro. Quando a resposta depende de cruzar tabelas
  protegidas, use função `security definer` (`my_installments()`,
  `ready_stock_counts()`) e dê `execute` só a quem precisa.
- **Relação ambígua entre duas tabelas precisa nomear a chave.** Quando existem
  duas FKs entre as mesmas tabelas (`trades.order_id` e `orders.trade_id`), o
  PostgREST recusa o join e devolve `data: null` — a tela mostra vazio sem erro.
  Use `tabela!nome_da_fkey(campos)`.
- **Escrita no banco sem verificar erro esconde o problema.** A entrada do
  parcelamento sumiu do Financeiro por um `check` que recusava a parcela 0, e o
  insert engolia a recusa: o carnê somava R$ 3.240 e o caixa R$ 2.640, sem nada
  na tela nem no log. Toda gravação em `finance_entries` verifica `error` e
  registra.
- **Número agregado que pode estar errado precisa dizer isso na tela.** O lucro
  das vendas soma faturamento menos custo; com vendas sem custo lançado ele fica
  perto do faturamento e a margem beira 100%. A tela conta quantas estão assim e
  avisa. Número errado com aparência de certo é pior que número ausente. Mesma
  regra no carnê: se a soma das parcelas deixa de bater com o valor devido, o
  bloco diz quanto sobra ou falta.
- **Quem mostra o mesmo dado é invalidado junto** (`lib/data/revalidate.ts`).
  Cada action mantinha a própria lista de telas para revalidar e as listas
  divergiram: baixa de parcela atualizava o Financeiro mas não o histórico do
  cliente; salvar venda atualizava o estoque mas não o painel. O sintoma é sempre
  a mesma informação com dois valores conforme a tela por onde se entra, e a
  causa nunca está na tela que mostra errado — o que torna isso caro de achar.
- **Data de registro não é data do fato.** `created_at` diz quando a linha
  entrou no sistema; quem manda no caixa é a data do fato — `sale_date` na
  venda, `paid_at` na parcela, `entry_date` no item de estoque. Todas editáveis,
  porque lançamento retroativo é rotina e o mês precisa ficar certo.
- **Mudança na regra de custo precisa de backfill no mesmo commit.** Passar a
  lançar a despesa noutro lugar sem migrar o que já existe tira dinheiro do
  caixa sem repor — e lucro inflado em silêncio é o pior erro que este sistema
  pode cometer.
- **Dado que existe em dois lugares tem um dono.** A parcela é o registro; a
  linha do Financeiro é o espelho. Toda tela que altera o espelho escreve no
  registro e ressincroniza, nunca no espelho direto — senão a próxima
  sincronização desfaz a alteração sem avisar.
- **Ajuste manual do dono não pode ser desfeito por rotina automática.** O carnê
  só é regerado quando o total ou as condições mudam, e refazer de propósito é um
  botão. Recalcular "para garantir" apaga trabalho sem avisar — e o dono só
  descobre quando o número já está errado há dias.
- **Formulário não copia para o estado o que a action revalida.** O carnê no
  modal de venda era uma cópia feita ao abrir: dar baixa atualizava banco e
  cartões, mas a lista continuava mostrando o estado anterior. Ler direto da prop
  já revalidada é menos estado e não diverge do banco.
