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
| Micro (rótulo, preço) | 240 ms |
| Entrada de título | 420 ms |
| Produto (zoom 1.14 → 1) | 900 ms |
| Stagger entre linhas | 80 ms |
| Brilho no ouro | 1 por peça |

**O brilho no ouro é um por peça.** Dois já viram enfeite, e o ouro é justamente
o elemento que o playbook mais racionou — no máximo dois elementos dourados por
arte parada, uma varredura de brilho por peça animada.

O stagger de 80ms entre linhas é o que dá a leitura em cascata. Abaixo disso as
linhas parecem entrar juntas e o olho não acompanha a ordem; acima, a peça fica
lenta.

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

Na peça gráfica gerada pelo Estúdio:

- **Título**: sobe 60px com fade, 420ms, stagger de 80ms entre linhas.
- **Produto**: zoom de 1.14 para 1 em 900ms, começando junto com o título.
- **Preço**: entra por último, 240ms, depois de 200ms de silêncio.
- **Barra e rótulos**: escala horizontal a partir da esquerda, 240ms.
- **Ouro**: uma varredura de brilho atravessando o elemento dourado.

**O produto não gira e não flutua em loop.** A flutuação existe no playbook
apenas em peça de catálogo sem texto; em peça de venda ela distrai do preço.

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

Quando o material é vídeo filmado — e não peça gerada —, o Estúdio não edita. O
que ele entrega é a **ficha de motion**: a estrutura acima com os tempos
preenchidos para aquele produto, mais os sobrepostos (título, specs, preço) em
PNG com fundo transparente, prontos para entrar na timeline.

## Entregando

Diga o tempo total, onde estão os cortes e qual trecho da estrutura cada um
cobre. Se a peça ficou fora da janela de 20–35s, diga por quê — vídeo de 45s não
está errado por natureza, mas está fora do que o playbook calibrou, e quem
publica precisa decidir com isso à vista.
