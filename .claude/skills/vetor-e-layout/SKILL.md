---
name: vetor-e-layout
description: Tipografia, logo, ícones e grid da Prog Imports segundo o Playbook Instagram v1.0 — como aplicar o lockup, qual peso e largura de Archivo usar, quando entra JetBrains Mono, o set de ícones das capas de destaque e as margens. Use sempre que a tarefa envolver construir ou corrigir a forma de uma peça: "o logo está pequeno nessa arte", "qual fonte uso aqui", "monta as capas dos destaques", "esse título está desalinhado", "faz um ícone pra essa categoria", "o texto está saindo da margem", "padroniza a tipografia dessa peça". Vale também quando alguém pede um layout sem dizer as medidas.
---

# Vetor e layout da Prog Imports

A função de construção da forma: tipografia, marca, ícone e grid. O que a peça
diz é da `direcao-de-arte`; como a imagem é tratada é da `tratamento-de-imagem`.
Aqui é como ela se organiza no espaço.

As medidas estão implementadas em `src/lib/estudio/marca.ts` — use as funções de
lá em vez de recalcular, porque elas já carregam o acerto do playbook.

## Tipografia

Duas famílias, três papéis. A escolha não é decorativa: Archivo larga ecoa o
"PROG" do logo, e a mono traz a linguagem de ficha técnica que o público
entusiasta lê como manchete.

| Papel | Fonte | Peso | Largura | Tracking |
|---|---|---|---|---|
| Títulos | Archivo | 800 | 115% | −3% |
| Texto | Archivo | 400 | 100% | normal |
| Specs e rótulos | JetBrains Mono | 500 | caixa-alta | +12% |

**Título em frase normal, nunca em caixa-alta.** Caixa-alta no título era parte
do que fazia o feed antigo parecer panfleto. A caixa-alta vive na mono, nos
rótulos curtos.

A entrelinha dos títulos é 0.92 — apertada de propósito, para o bloco de texto
ocupar menos área e sobrar espaço para o produto.

Números gigantes de fundo (o "9i", o "VS", o "01") vão em Archivo 900, 125% de
largura, **em contorno** de 3px em ouro a 45% de opacidade, nunca preenchidos —
preenchido vira fundo e rouba a disputa do produto.

## Logo

Três formas, e cada uma tem o seu lugar:

- **Lockup horizontal** (globo + PROG/IMPORTS) no topo das artes, 64px de
  altura. É `lockup()` em `marca.ts`.
- **Só o globo** em avatar, capa de destaque e marca d'água.
- **Logo vertical** (`public/marca/logo.png`) em peça clara, onde o lockup
  montado em texto perde para o desenho original.

Nunca esticar, contornar ou pôr sombra extra. O globo já tem acabamento
metálico; sombra por cima suja.

No escuro, "PROG" sai em `#D9B66E` e "IMPORTS" em prata. No claro, bronze
`#8C6A2F` e cinza — ouro claro sobre marfim não tem contraste suficiente.

## Medir texto no mesmo estado em que ele é desenhado

`measureText` responde sobre o contexto **agora**: a fonte que está posta, o
`letterSpacing` que está ativo, o `fontStretch` que está ligado. Medir depois de
desfazer qualquer um dos três é medir outra palavra.

O caso que isto custou: `lockup()` devolvia a borda direita medindo "IMPORTS"
**depois** de soltar o espaçamento, e sem olhar para "PROG", que é maior.
Devolvia 210px onde o desenho terminava em 255. O 4A e o 4B usam esse retorno
para encostar um rótulo ao lado do logo — e o rótulo entrava 45px cedo, com o
G de "GUIA" encavalando no G de "PROG". O comentário no código dizia que o
número fixo anterior colidia; o cálculo que o substituiu colidia também, menos.

Três regras que saem daí:

- Meça **dentro** do bloco que desenha, antes de qualquer `soltar()` ou
  `restore()`.
- Quando um bloco tem duas palavras empilhadas, a borda é a **maior das duas**,
  cada uma medida com a sua fonte.
- Quando uma função devolve uma coordenada, **confira o número contra o
  desenho** — redesenhe as partes em canvas separados e compare as caixas de
  tinta. Dois retângulos que se cruzam é prova; olhar a miniatura e achar que
  está apertado, não.

## Texto que não cabe tem de aparecer

`quebrar()` corta no limite de linhas. Até esta revisão o resto sumia calado: a
peça saía bonita com a frase pela metade, e nada na tela dizia que faltava
palavra. Agora a última linha recebe reticência — publicar com reticência é
ruim, publicar sem saber que faltam palavras é pior.

Se a reticência apareceu na prévia, o conserto é **encurtar o texto**, não
aumentar `maxLinhas`: o limite de linhas existe porque o bloco tem altura
reservada, e crescer empurra o produto ou o preço.

## Grid

Feed 1080×1350, margem de **72px** em todos os lados. Story 1080×1920.

A faixa que sobrevive ao corte 3:4 do perfil vai de y=168 a y=1180. Título,
preço e CTA ficam dentro dela.

A pilha do rodapé é ancorada na base e cresce para cima — é isso que mantém o
preço na mesma altura em peça de título curto e de título longo. Montar de cima
para baixo faz o preço dançar entre as peças, e o grid perde o alinhamento.

## Ícones das capas de destaque

Um único set em todas as capas: traço de 1,5px, cantos arredondados. Misturar
seta, texto e aspas em capas diferentes é o que faz o conjunto parecer
improvisado.

A ordem é o funil, e ela é informativa — quem chega no perfil percorre nessa
sequência:

1. Pronta entrega (`package`)
2. Encomende (`plane`)
3. Como funciona (`route`)
4. Garantia (`shield-check`)
5. Clientes (`message-square-quote`)
6. Teste de Fogo (`flame`)
7. Sobre (o globo)

Exportar em 1080×1920 com o disco centralizado num quadrado de 1080. O ícone
ocupa **no máximo 36% do diâmetro** — acima disso o anel do Instagram corta.

Três direções, e a recomendada é a primeira: **ônix esculpido** (disco escuro
com luz de canto, ícone fino em ouro), porque o anel do próprio Instagram já faz
a moldura. **Medalha de metal** chama mais atenção e conversa com o acabamento
do logo. **Índice técnico** deixa a ordem do funil explícita com numeração mono.
Escolha uma e use nas sete — misturar direções é pior que escolher a "errada".

## Cor

| | | |
|---|---|---|
| Ônix `#0C0C0D` | fundo principal | Grafite `#18181B` cards |
| Marfim `#F2EEE7` | fundo claro | Papel `#E7E1D6` blocos claros |
| Ouro `#C9A15A` | detalhes | Bronze `#8C6A2F` ouro no claro |
| Prata `#B9B4AB` | texto secundário | Ouro metal | só em títulos-chave |

A proporção é 70% superfície, 20% produto, 10% ouro. **O ouro nunca vira fundo
inteiro** e não aparece em mais de dois elementos por arte.

O degradê de ouro escovado (`ouroMetal()`) vai em 100°, do bronze escuro ao
creme e de volta. Em círculo, use `ouroMedalha()`, que corre na diagonal — o
mesmo degradê linear num disco achata o metal.

## Entregando

Quando sair do playbook, diga que saiu e por quê. Uma peça que quebra a margem
de 72px porque o produto sangra na borda é decisão legítima — o 3C faz isso de
propósito. Quebrar sem perceber é que estraga o grid.
