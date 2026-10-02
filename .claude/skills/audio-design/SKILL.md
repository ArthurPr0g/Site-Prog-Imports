---
name: audio-design
description: Som das peças em vídeo da Prog Imports segundo a seção 07 do Playbook Instagram — loudness de entrega, logo sonoro, biblioteca de efeitos, voz sobre trilha, escolha de música e legenda queimada. Use sempre que houver áudio envolvido: "que música coloco nesse Reels", "o áudio está baixo", "a voz some embaixo da trilha", "faz a vinheta sonora", "esse som está estourando", "preciso legendar esse vídeo", "qual BPM uso", "o Instagram abaixou o volume do meu vídeo". Vale também quando a pessoa manda um vídeo pronto reclamando que "ficou estranho" sem saber que o problema é som.
---

# Audio design da Prog Imports

A função de som. Anda junto com a `motion-design` — os tempos de corte e os
pontos de áudio são o mesmo relógio.

O som é o que separa vídeo de loja de vídeo de marca, e quase ninguém no nicho
cuida dele. É vantagem barata.

## Entrega

| Parâmetro | Alvo |
|---|---|
| Loudness integrado | −14 LUFS |
| True peak | −1 dBTP |
| Voz sobre trilha | +8 a +10 dB |
| Trilha | 100–118 BPM |
| Legenda queimada | sempre |

**−14 LUFS não é preferência, é o alvo das plataformas.** Instagram, TikTok e
YouTube normalizam para perto disso. Entregar mais alto não deixa o vídeo mais
alto — a plataforma abaixa, e o que sobra é um áudio comprimido e sem respiro ao
lado dos concorrentes. Entregar mais baixo faz o vídeo sumir no feed.

**True peak em −1 dBTP** porque a conversão para AAC cria picos que não existem
no arquivo original. Em 0 dBTP, o que você ouviu limpo chega distorcido.

**Voz +8 a +10 dB sobre a trilha.** Abaixo de 8 a trilha engole a voz no celular
com som ruim, que é onde a maioria assiste. Acima de 10 a trilha vira ruído de
fundo e some o clima.

**Legenda queimada sempre.** A maior parte do feed roda sem som. Legenda do
Instagram depende de o espectador ligar; queimada ninguém desliga. Além disso,
ela segura o espectador nos primeiros segundos, que é onde o vídeo é decidido.

## Biblioteca de sons

Quatro sons, sempre os mesmos. A repetição é o ponto:

- **Logo sonoro** — 1,2s: whoosh grave + ping metálico afinado em Lá. Vai na
  assinatura, nos últimos 2 segundos, junto com o globo. **Sempre o mesmo.**
- **Spec** — click mecânico de teclado, −18 dB, um por linha de ficha técnica.
  Amarra no stagger de 80ms do motion: o click entra com a linha, não antes.
- **Preço** — sub-drop curto de 60 Hz, com **200 ms de silêncio antes**. O
  silêncio é o efeito; o drop sozinho não cria expectativa.
- **Trilha** — eletrônica escura, sem vocal.

**Evitar áudio viral de meme.** Ele entrega alcance de um dia e marca o perfil
como loja de oferta — exatamente o que o playbook está desmontando. Trilha sem
vocal também evita que a letra dispute com a locução e com a legenda.

## Escolher a trilha

Entre 100 e 118 BPM. Nessa faixa o compasso dura de 2,0 a 2,4 segundos, que é o
tempo de um plano de produto — a edição cai no ritmo sozinha.

Sem vocal, sem drop agressivo, sem build de EDM. A referência é trilha de
lançamento de carro ou de relógio, não de game.

Confira a licença antes. Áudio da biblioteca do próprio Instagram é seguro para
conta comercial; faixa de terceiro sem licença derruba o post e, às vezes, o
alcance do perfil por semanas.

## Mixagem, na ordem

1. Nivele a **voz** primeiro, com compressão suave (3:1, ataque médio).
2. Traga a **trilha** até 8–10 dB abaixo da voz.
3. Abaixe a trilha nos trechos de locução com ducking automático — manual deixa
   degrau audível.
4. Ponha os **efeitos** (click, drop) e cheque se algum empurra o pico.
5. Meça o **integrado** no vídeo inteiro, não por trecho, e ajuste para −14 LUFS.
6. **Limite** em −1 dBTP por último.

Medir antes de limitar é o erro comum: o limiter muda o integrado, e quem mede
antes entrega fora do alvo achando que está dentro.

## Quando não há voz

Peça animada do Estúdio normalmente não tem locução. Aí a trilha sobe para o
nível de voz e os efeitos ganham a função de pontuação: click na spec, drop no
preço, logo sonoro na assinatura. O silêncio de 200 ms antes do preço vale ainda
mais — sem voz, ele é o único recurso de ênfase que sobra.

## Entregando

Diga os números medidos, não só que "está ok": integrado em LUFS, true peak, e
onde cada efeito caiu. Se algum alvo não foi atingido, diga qual e por quê —
material de origem ruim é motivo legítimo, e quem publica precisa saber antes de
o vídeo ir ao ar.
