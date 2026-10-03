# Estúdio — peças de Instagram

Terceira área de trabalho do site, ao lado de Loja e Gerenciamento. Transforma
o **Playbook Instagram v1.0** (out/2026) em peças prontas para baixar em 1080.

O playbook em si vive fora do repositório, em
`Prog Imports/kit-instagram/`. Ele é a fonte da verdade; este módulo é a
implementação.

## Por que é outra área, e não uma tela do Gerenciamento

No Estúdio não se administra a loja, se produz a peça que vai para o Instagram.
Quem está montando post não quer passar por estoque e financeiro no caminho — e
quem está conferindo caixa não quer tropeçar em modelos de arte. O seletor do
topo tem três posições por isso.

## Como funciona

| Camada | Arquivo | O que faz |
|---|---|---|
| Tokens e primitivas | `src/lib/estudio/marca.ts` | Cores, tipografia, grid e os gestos de desenho: ouro escovado, halo, sombra de contato, contorno de texto, selo, lockup, barra de progresso |
| Catálogo | `src/lib/estudio/modelos.ts` | Os 13 modelos e os campos que cada um pede |
| Desenhistas | `src/lib/estudio/desenhistas/` | Um por seção do playbook: `feed`, `carrossel`, `story` |
| Ícones | `src/lib/estudio/icones.ts` | O set das capas de destaque, em vetor |
| Preenchimento | `src/lib/estudio/produto.ts` | Traduz um produto do catálogo nos campos da peça |
| Editor | `src/components/estudio/EditorDePeca.tsx` | Formulário, prévia ao vivo e download |

## As decisões que custaram caro para descobrir

**A arte não é gravada, é redesenhada.** `studio_pieces` guarda só o texto e o
produto. Guardar PNG envelheceria junto com o playbook: mudou uma regra de cor,
as peças antigas sairiam erradas e ninguém saberia. Redesenhar mantém tudo
coerente e deixa o arquivo pesado fora do banco.

**Canvas, e não HTML renderizado em imagem.** Os modelos usam contorno de texto,
sombra projetada, recorte e degradê dentro do texto. Os quatro quebram em
Satori e parentes, e a peça sairia diferente do playbook.

**A foto do catálogo precisa ser recortada antes de entrar.** Ela vem sobre o
cartão da loja; sem o recorte, o "produto" é a foto inteira e cobre a arte de
ponta a ponta, escondendo o halo. `image-cutout.ts` já existia para a proposta
da loja e serve aqui; quando o fundo não é liso o bastante ele devolve `null` e
a foto original volta, que é melhor que recorte quebrado.

**As caixas do protótipo não servem como estão.** No playbook a imagem é um PNG
quadrado com o aparelho pequeno no meio e muita transparência em volta. Aqui ela
chega rente ao produto, então a mesma caixa faz o aparelho sangrar pelos quatro
lados. O que importa é a área que o produto ocupa, não a da moldura que ele
tinha na origem.

**A pilha do rodapé é ancorada na base.** Montando de cima para baixo, o preço
dança de altura entre peças de título curto e longo, e o grid do perfil perde o
alinhamento.

**Campo compartilhado entre modelos colide.** `subtitulo` era a configuração do
aparelho no 3B e a segunda linha do título no 3C: o preenchimento automático
mandava a ficha técnica para a linha gigante. Cada sentido ganhou chave própria.
Mesmo caso do rótulo do topo do 3D, que vende confiança e não prazo.

**Centavo em arte de Instagram é ruído.** Ninguém decide compra de 23 mil por
noventa e dois centavos, e o `,00` rouba tamanho do número, que precisa ser lido
de longe no grid.

**O story tem 1920px, mas só 1330 são seus.** O Instagram cobre os 250 de cima e
os 340 de baixo. Fora dessa faixa o texto existe no arquivo e some na tela.

## O que falta

- **Peças animadas.** O 5A é animado no playbook, e a seção 07 define tempos
  (240 ms no micro, 420 no título, 900 no produto, 80 de stagger) e a curva
  `cubic-bezier(.2,.7,.1,1)`. Antes de prometer MP4, confirmar
  `MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')` — o Instagram não
  aceita WebM.
- **O LUT da marca em `.cube`**, para o dono aplicar em CapCut ou Premiere e as
  fotos próprias passarem a conviver com os renders.
- **Slide 5 do 4A com três produtos distintos.** Hoje repete o mesmo aparelho em
  três ângulos, porque só há um campo de produto.
- **Geração de texto por assunto.** O `ANTHROPIC_API_KEY` já existe no projeto
  para o assistente de compras; o mesmo caminho serve para propor título,
  specs e legenda no tom do playbook.
