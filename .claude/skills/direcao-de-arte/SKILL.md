---
name: direcao-de-arte
description: Direção de arte das peças da Prog Imports a partir do Playbook Instagram v1.0 — escolhe o modelo certo, escreve o texto no tom da marca, define o enquadramento e reprova o que não passa no checklist. Use sempre que o assunto for produzir peça de divulgação: "faz um post do Legion", "monta um carrossel sobre importação", "preciso de um story de enquete", "cria uma arte dessa oferta", "qual modelo uso pra esse lançamento", "escreve a legenda desse post". Vale também quando a pessoa manda só o assunto ou só o produto e espera a peça pronta, sem citar modelo nem formato.
---

# Direção de arte da Prog Imports

Quem decide o que a peça é — qual modelo, que texto, o que entra e o que fica
de fora. O desenho em si sai do Estúdio (`/admin/estudio`); as regras de pixel
estão em `src/lib/estudio/marca.ts`. Aqui mora o julgamento.

A régua é o **Playbook Instagram v1.0**, em
`Prog Imports/kit-instagram/kit-instagram-prog-imports/project/`. Ele nasceu de
um diagnóstico do perfil, e cada regra responde a um problema real que o feed
tinha. Vale conhecer o diagnóstico antes de discordar de uma regra.

## O que o playbook está consertando

Cinco problemas, e é por isso que as regras existem:

- **A marca é dourada; o feed era laranja.** O laranja saturado e a condensada
  em caixa-alta não existem no logo, e o feed parecia outra loja a cada post.
  Laranja saiu do sistema.
- **O texto ocupava mais área que o produto.** Quem compra hardware quer ver a
  máquina.
- **Fundo de papel amassado**, que é recurso genérico de template.
- **Os comentários pediam preço e ele não aparecia.** "Quanto??" era o comentário
  mais frequente.
- **Foto real sem tratamento ao lado de render**, sem padrão de luz.

## Escolher o modelo

Treze modelos, agrupados por função. O catálogo com os campos de cada um está em
`src/lib/estudio/modelos.ts`.

| Quando a tarefa é… | Modelo |
|---|---|
| Mostrar um produto que chegou, com preço | **3A** escuro ou **3B** claro |
| Baixar preço, queimar estoque, última unidade | **3C** oferta |
| Provar que a loja entrega | **3D** prova social |
| Capa de vídeo | **3E** capa de Reels |
| Explicar como a importação funciona | **4A** carrossel educativo |
| Lançar uma linha inteira | **4B** carrossel de lançamento |
| Vender no story | **5A** |
| Fazer o seguidor escolher | **5B** enquete |
| Abrir caixinha de perguntas | **5C** |
| Responder um seguidor | **5D** |
| Organizar o perfil | **5E1/2/3** capas de destaque |

**A escolha entre 3A e 3B não é estética, é de ritmo.** O grid do perfil alterna
claro e escuro, e nunca aceita dois iguais lado a lado. Antes de decidir, olhe
as últimas peças: se as duas anteriores foram escuras, a próxima é clara.

**O calendário do playbook**, se não houver pedido específico: segunda produto
escuro, terça Reels, quarta carrossel educativo, quinta prova social, sexta
oferta ou lançamento, sábado produto claro. Stories, no mínimo cinco por dia —
um bastidor, um produto, uma interação, uma prova, um repost de cliente.

## Escrever o texto

O tom é **premium e sóbrio**. Frase curta, número concreto, no máximo um emoji
por legenda e só funcional (→ ✓).

A diferença fica clara no par:

- Evitar: "🔥 BOMBA!!! O MONSTRO CHEGOU, CORRE!!!"
- Usar: "Legion Pro 7i Gen 10. Pronta entrega, 3 unidades."
- Evitar: "Sem risco de taxação e com preço muito menor?"
- Usar: "Importação com nota, impostos inclusos no preço final."

O segundo par importa mais que o primeiro: o original insinuava que importar com
a Prog driblava imposto. Não drible — a venda é feita com nota e os impostos
estão no preço. Prometer menos imposto é promessa que a loja não cumpre, e é a
que dá problema depois.

**Título com até 6 palavras.** Não é limite de design, é de leitura: o grid do
perfil mostra a peça com 3cm de largura.

**Specs em linha separada**, em mono, nunca dentro do título. O público lê spec
como lê manchete — "RTX 5080 · 32 GB · 240 HZ" comunica mais que um adjetivo.

**Preço sempre.** Peça de produto sem preço visível volta. Quando o preço varia
ou depende de cotação, use "a partir de" ou "sob consulta" — o que não pode é o
cliente ter que perguntar.

**Rumor não é fato.** Post de notícia nasce de matéria que muitas vezes é
relato — "diz relatório", "segundo", "deve", "reportedly". A frase certa é "deve
chegar em 27 de outubro, segundo relatos", e não "chega em 27 de outubro". É o
mesmo erro do imposto de cima, com outro vestido: prometer o que a fabricante
não anunciou é promessa que alguém cobra depois, e numa loja que vende máquina
de R$ 40 mil a cobrança chega por direct.

**Catálogo primeiro, foto de fora depois.** Onde o produto é cenário (prova
social, capa de série, carrossel educativo), a máquina vem do catálogo. A foto de
fora entra só quando a loja não tem — em lançamento e notícia, onde não existe
foto nossa de um aparelho anunciado ontem. Duas regras que vêm junto: só
licença que permite uso comercial e alteração, acima de 1080px, e **o crédito
sempre na legenda** (CC BY e CC BY-SA exigem atribuição). Em peça de venda nunca:
vender com foto de terceiro é vender o que não está na vitrine.

**Dois campos com a mesma chave brigam.** Quando um modelo reaproveita uma chave
que o cadastro de produto também preenche (`etiqueta`, `subtitulo`), o cadastro
escreve por cima do que a peça queria dizer. O 3D, o 3C e o 3E já tiveram o
mesmo defeito, cada um com chave própria agora (`chamada`, `tituloLinha2`,
`serie`). Ao criar um modelo, confira `sugestoesDoProduto()` antes de escolher o
nome de um campo.

### Estrutura da legenda

Linha 1 é o gancho, até 8 palavras. Linhas 2 a 4 trazem três fatos com número.
Linha 5 é o CTA com a palavra-chave que você vai monitorar ("QUERO",
"COTAÇÃO"). Fecha com 3 a 5 hashtags de nicho — nicho, não genérica:
#notebookgamer rende mais que #tecnologia.

## Enquadrar

Feed é 1080×1350 com margem de 72px. **O perfil corta para 3:4**: o essencial
precisa caber nos 1012px centrais. Título, preço e CTA ficam dentro dessa faixa
ou somem da vitrine.

A proporção que o playbook pede: 70% superfície, 20% produto e foto, 10% ouro. O
ouro nunca é fundo inteiro e **nunca aparece em mais de dois elementos por
arte** — normalmente o preço e mais um. Quando bate em três, um deles vira prata
ou marfim.

### Halo: a cor é da família, e são três por fileira

O halo é luz atrás do aparelho, não forma colada atrás dele — essa é a diferença
entre o sistema e o adesivo laranja que as capas de coleção usavam antes. A cor
segue a **marca do produto**, não a da Prog, e é o único lugar onde cor fora da
paleta entra.

Nas capas de coleção da loja:

| Família | Halo |
|---|---|
| Gamer, peças e upgrades | roxo |
| Apple (iPad, MacBook, iPhone) | turquesa |
| Periféricos | rubi |
| Mais vendidos, promoções, serviços | ouro |

**Uma cor por capa vira arco-íris na fileira da home.** Agrupar em três ou
quatro famílias é o que faz a vitrine parecer um sistema em vez de uma caixa de
lápis de cor. Toda capa leva também sombra de contato — sem ela o produto
flutua, e é a sombra que dá o peso de máquina cara.

## Antes de entregar

Se alguma resposta for "não", a peça volta:

- O produto ocupa mais área que o texto?
- O título tem até 6 palavras?
- Preço ou "a partir de" está visível?
- O ouro está em no máximo dois elementos?
- O essencial cabe no corte 3:4?
- A foto passou pelo LUT da marca? (ver `tratamento-de-imagem`)
- O CTA tem palavra-chave?
- Se é vídeo: áudio em −14 LUFS e legenda queimada? (ver `audio-design`)

## Entregando

Crie a peça no Estúdio — uma linha em `studio_pieces` com o modelo, o produto e
os campos. Ela aparece lá pronta para baixar em 1080.

Diga ao dono, por peça: qual modelo você escolheu e **por quê**, o que puxou do
catálogo, o que inventou, e qualquer item do checklist que ficou no limite. Se
você precisou escolher entre duas leituras do pedido, diga qual escolheu — é
mais barato ele corrigir a direção agora que depois de dez peças no mesmo erro.
