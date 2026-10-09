---
name: motion-design
description: Animação das peças da Prog Imports segundo a seção 07 do Playbook Instagram — tempos, a curva "Prog Out", a estrutura de Reels de 20 a 35 segundos, o que anima e o que não anima, e como exportar. Use sempre que a tarefa envolver movimento: "anima esse post", "faz um Reels do Legion", "esse vídeo está sem ritmo", "quanto tempo deixo cada corte", "o texto entra muito rápido", "monta a vinheta de assinatura", "exporta esse story animado", "qual a estrutura do vídeo". Vale também quando a pessoa manda um vídeo bruto e pede para transformar em post.
---

# Motion design da Prog Imports

A função de movimento. A arte parada é da `direcao-de-arte` e da
`vetor-e-layout`; o som é da `audio-design`. Aqui é o tempo.

A sensação que o playbook persegue tem nome: **peso de máquina cara**. Tudo
entra rápido e assenta devagar. Bounce, elastic e glitch estão fora do sistema —
eles comunicam leveza e brincadeira, que é o oposto do que a marca vende.

## A curva

```
cubic-bezier(.2, .7, .1, 1)
```

No After Effects: ease out 85%, influência de entrada 15%.

Ela é o motivo de tudo parecer da mesma marca mesmo quando as peças são
diferentes. Use a mesma curva em texto, produto e opacidade — variar a curva por
elemento é o que faz uma animação parecer montada por três pessoas.

## Tempos

| Elemento | Duração |
|---|---|
| Micro (rótulo, preço) | 380 ms |
| Entrada de título | 560 ms |
| Produto (zoom 1.08 → 1) | 1100 ms |
| Régua e barras | 520 ms |
| Stagger entre linhas | 90 ms |
| Brilho no ouro | 1 por peça |

Os valores do playbook eram 240/420/900 e saíram curtos na prática: 240ms para
um elemento que percorre 60px dá um corte seco no fim — o elemento não entra,
ele aparece. O playbook pede entrada rápida com **assentamento lento**, e
assentamento precisa de tempo para existir.

**Nenhuma marca do roteiro coincide com outra e nenhum vão passa de 300ms.** A
primeira versão tinha três elementos entrando entre 300 e 420ms e depois meio
segundo de nada: a peça chegava em blocos, com buracos no meio, que é o que faz
a animação parecer um slideshow apressado.

Essa regra vale para a varredura de brilho também, e foi onde ela escapou: o
brilho ficou em 1900ms enquanto o CTA entrava em 1560, abrindo 340ms em que a
peça estava inteira e parada esperando a luz. Conferir o vão é somar a lista,
não confiar na leitura.

**O brilho no ouro é um por peça.** Dois já viram enfeite, e o ouro é justamente
o elemento que o playbook mais racionou — no máximo dois elementos dourados por
arte parada, uma varredura de brilho por peça animada.

O stagger de 90ms entre linhas é o que dá a leitura em cascata. Abaixo de 80 as
linhas parecem entrar juntas e o olho não acompanha a ordem; acima de 100, a
peça fica lenta.

## Estrutura de Reels · 20 a 35 s

| Trecho | Tempo | O que acontece |
|---|---|---|
| Gancho | 0–1,5 s | Pergunta ou número na tela. Corte no primeiro beat. |
| Produto | 1,5–8 s | Três planos: geral, ¾, macro. Slider lento, um plano por compasso. |
| Prova | 8–28 s | FPS, temperatura, comparação. Dados em mono, entrando com "click". |
| Assinatura | últimos 2 s | Globo + logo sonoro. |

**O corte acompanha o compasso, não o relógio.** Um plano por compasso é o que
faz o vídeo parecer editado e não cortado. Com trilha de 100–118 BPM, o compasso
fica entre 2,0 e 2,4 segundos.

A assinatura final é sempre a mesma — globo e logo sonoro. Repetição é o que
constrói reconhecimento; variar a vinheta joga fora o que as peças anteriores
construíram.

## O que anima

Na peça gráfica gerada pelo Estúdio — os números são os da tabela acima, não os
do rascunho do playbook:

- **Título**: sobe 60px com fade, 560ms, stagger de 90ms entre linhas.
- **Produto**: zoom de 1.08 para 1 em 1100ms, começando antes do título.
- **Preço**: entra por último, 380ms, depois de 200ms de silêncio.
- **Barra e rótulos**: escala horizontal a partir da esquerda, 520ms.
- **Ouro**: uma varredura de brilho atravessando o elemento dourado, 1100ms.

**Zoom de 1.08, e não de 1.14.** Com 14% o produto chega grande o bastante para
o olho ler duas coisas — uma entrada e um recuo. Com 8% ele lê uma.

**O produto não gira e não flutua em loop.** A flutuação existe no playbook
apenas em peça de catálogo sem texto; em peça de venda ela distrai do preço.

**Se um elemento entra com escala, o rastro entra com a mesma escala.** As
cópias do rastro desenhadas em tamanho final enquanto o elemento ainda está
menor produzem um rastro maior que quem o produziu — a única coisa que um
rastro não pode ser.

## O que mantém a peça viva depois do roteiro

O roteiro termina por volta de 2,1s. Numa peça de 5s, os outros 2,9s são onde
mora a diferença entre vídeo e PNG com introdução:

- **A câmera.** Empurrão lento e contínuo, 3,5% de escala e 14px de subida ao
  longo da peça inteira, só nas camadas de imagem. Vai na curva da peça, e não
  linear, por um motivo que só aparece no fim: na curva o movimento desacelera
  até parar no último quadro. **Movimento cortado no meio do caminho faz o
  clipe parecer inacabado; movimento que para antes do corte faz o clipe
  parecer terminado.**
- **Tipografia não anda com a câmera.** Texto que escorrega parece defeito de
  layout, e a margem de 72px é lei — ela não pode virar 68 no meio do vídeo. O
  produto empurrando com o fundo parado ainda dá paralaxe de graça.
- **O halo respira**: 3,4s por ciclo, 9% de variação. Mais rápido vira pulso de
  notificação, mais forte vira luz de balada.
- **Rastro.** Quando um elemento percorre mais de 5px num quadro, duas cópias
  fracas atrás dele (18% e 10% da opacidade) fazem o deslocamento parecer
  deslocamento. Sem isso o elemento se teletransporta de posição em posição — é
  o mesmo motivo pelo qual uma câmera de verdade tem obturador.

## A varredura de brilho é recortada pelo elemento

Degradê claro em `lighter` sobre o retângulo do preço acende **o retângulo**,
não o preço: sobre fundo escuro aparece uma barra clara atravessando a peça. O
jeito certo é pintar o elemento numa camada à parte, recortar o degradê com
`source-in` e compor com `lighter` — aí o que acende é o algarismo, e o preço
parece feito de metal.

Degradê na diagonal, não vertical: luz batendo de cima é o que dá plano ao
metal. E a varredura entra e sai com `sin(π·p)`, porque reflexo que aparece do
nada na borda do elemento entrega o truque.

## Capa de Reels

A capa é 1080×1920, mas o grid do perfil corta para 4:5 — o essencial precisa
caber na faixa central, entre y=285 e y=1635. Título e série ficam ali. É o
modelo **3E** do Estúdio, e ele já desenha a faixa.

A capa **não é o primeiro frame do vídeo**. O primeiro frame é o gancho em
movimento; a capa é composta, com o produto parado e nítido. Usar o frame do
vídeo como capa entrega um borrão no grid.

## Exportar

Formato de entrega: 1080×1920 para story e Reels, 1080×1350 para feed animado.

Do Estúdio, a peça animada sai do mesmo canvas que desenha a estática, gravando
quadro a quadro. Antes de prometer MP4, **confirme que o navegador grava nesse
formato** — o Instagram não aceita WebM:

```js
MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
```

Se não suportar, a saída é sequência de PNG numerada, que entra em qualquer
editor sem perda.

### As três armadilhas da gravação por canvas

Todas já custaram um vídeo engasgado, e nenhuma aparece olhando o código:

1. **`captureStream(fps)` amostra no relógio dele.** Quando o desenho do quadro
   não terminou, ele repete a amostra anterior e o arquivo enche de quadros
   gêmeos — o movimento engasga em cima deles. Use `captureStream(0)` com
   `track.requestFrame()` depois de cada desenho: aí nenhum quadro é repetido e
   nenhum é perdido.
2. **Pedir um quadro a cada repintura entrega a taxa do monitor.** Num monitor
   de 165Hz saem 820 quadros em 5 segundos e um arquivo de 15MB, com a mesma
   taxa de bits dividida por três vezes mais quadros — cada quadro fica pior,
   num vídeo que o Instagram vai reconverter para 30 de qualquer jeito. Trave na
   grade do formato (60) e deixe a sobra do monitor virar folga para o desenho.
3. **Todo custo de primeira vez cai no primeiro quadro que precisa dele.** A
   medição mostrava 85ms parados em 0,16s, no meio da entrada do produto, e
   54ms em 2,10s, exatamente quando a varredura acende e aloca a camada da
   máscara. Desenhe uma vez cada trecho do roteiro **antes** de criar o
   gravador. Pela mesma razão, nada de `await document.fonts.ready` por quadro:
   eram 300 esperas pelo mesmo resultado numa gravação de 5 segundos.

### Como conferir que ficou fluido

Olhar o vídeo não serve — 10% de quadros repetidos passa despercebido numa
olhada e aparece no feed. Toque o arquivo com `requestVideoFrameCallback`
contando `mediaTime`: o que interessa é **quadros repetidos igual a zero**, a
taxa mediana perto do alvo e onde estão os maiores vãos. Vão no começo é folga
do codificador e ninguém vê; vão no meio da entrada do produto é engasgo.

Quando o material é vídeo filmado — e não peça gerada —, o Estúdio não edita. O
que ele entrega é a **ficha de motion**: a estrutura acima com os tempos
preenchidos para aquele produto, mais os sobrepostos (título, specs, preço) em
PNG com fundo transparente, prontos para entrar na timeline.

## Entregando

Diga o tempo total, onde estão os cortes e qual trecho da estrutura cada um
cobre. Se a peça ficou fora da janela de 20–35s, diga por quê — vídeo de 45s não
está errado por natureza, mas está fora do que o playbook calibrou, e quem
publica precisa decidir com isso à vista.
