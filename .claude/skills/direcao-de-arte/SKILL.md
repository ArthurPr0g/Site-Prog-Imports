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
