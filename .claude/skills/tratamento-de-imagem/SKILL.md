---
name: tratamento-de-imagem
description: Tratamento e composição de imagem da Prog Imports — recorte de produto, sombra de contato, LUT da marca, limpeza de fundo, selo de canto e os limites de ampliação. Use sempre que for preciso ajustar uma imagem antes de ela entrar numa peça ou no site: "recorta esse notebook", "tira o fundo branco", "essa foto está com o fundo errado", "deixa as fotos todas com a mesma cor", "a imagem ficou borrada no zoom", "tem um selo no canto dessa foto", "clareia essa foto do setup". Vale também quando a pessoa reclama de uma imagem publicada sem dizer o que fazer com ela.
---

# Tratamento de imagem da Prog Imports

A função de retoque e composição. Trabalha depois que a imagem já existe: a
busca da foto certa do produto é da skill `fotos-de-produto`, e a decisão do que
a peça comunica é da `direcao-de-arte`.

O princípio que organiza tudo aqui: **a imagem do fabricante já está certa.** O
trabalho é encaixá-la no sistema da marca sem alterar o produto. Toda vez que
esta regra foi quebrada neste projeto, o resultado foi reprovado.

## O que já deu errado

Vale ler antes de propor um ajuste "para melhorar":

**A sombra branca (2026-09-17).** Quatro produtos Lenovo foram ao ar com uma
elipse branca sob o aparelho. A origem estava certa — o PNG trazia a sombra de
contato em preto com alfa baixo (A≈35). O que subiu foi a saída de uma tentativa
de "levantar o preto" da imagem, que ficou numa pasta e passou despercebida.
Composto direto, o mesmo pixel dá `#0f0f11`.

Daí vêm duas regras:

- **Nada de pós-processamento entre a origem e a composição.** A imagem do
  fabricante é redimensionada e centralizada, e só.
- **Confira a sombra antes de publicar**, porque ela não aparece em log nenhum:

  ```powershell
  Add-Type -AssemblyName System.Drawing
  $i = [System.Drawing.Bitmap]::new(".\final\1.jpg"); $i.GetPixel(2074, 1792); $i.Dispose()
  ```

  Sombra correta fica perto de `#111114`. Se voltar claro (200+), a pasta está
  contaminada — regere da original em vez de consertar o arquivo pronto.

**O "desenho realista".** Render oficial de fabricante é CGI, e às vezes o dono
estranha achando que não é o produto real. É o produto real, modelado pelo
próprio fabricante — vale explicar em vez de trocar por foto pior.

## Recorte

Para imagem de catálogo com fundo branco ou cinza-claro uniforme (o padrão de
Apple e Samsung):

```powershell
powershell -File .claude\skills\fotos-de-produto\scripts\recortar-enquadrar.ps1 -Entrada ".\selecionadas" -Saida ".\final"
```

O recorte parte das **bordas**: só o claro ligado à borda vira fundo, então
tecla branca, reflexo e tela acesa ficam intactos. Três coisas que ele resolve e
que aparecem no log:

- **Selo de canto.** Depois do recorte, só a maior ilha de pixels sobrevive — o
  "Copilot+PC" que a Samsung carimba sai sozinho. Se a foto tiver duas peças de
  verdade (aparelho + caneta), passe `-FracaoMinimaDaIlha 1.1` para desligar.
- **Origem pequena.** Não amplia além de `-EscalaMaxima` (1,5×). Se o produto
  ocupa um canto da foto original, ele fica menor no quadrado em vez de sair
  serrilhado, e o log avisa a porcentagem.
- **Foto de perfil e de portas.** É uma tira de 100px de altura de propósito; a
  guarda de recorte destrutivo mede área, não altura.

**Fundo preto não se recorta.** Notebook preto sobre fundo escuro: o recorte come
o chassi ou deixa halo. Mantenha o fundo original e deixe a moldura do site
separar.

### Foto com placa: como descobrir antes de estragar

PNG com transparência **não** quer dizer produto recortado. Várias fotos de
fabricante vêm com dois ou três pixels transparentes em volta e, dentro deles,
uma placa retangular de canto arredondado com o fundo embutido. Sobre fundo
preto ela quase some; sobre mapa, foto ou seção clara ela aparece, e o cliente
vê o produto dentro de uma plaquinha.

**A medida que denuncia** é a densidade de pixels opacos **dentro da própria
caixa delimitadora**, não a porcentagem de transparência do arquivo:

- abaixo de ~85% → recorte de verdade (o contorno do aparelho deixa vazios);
- acima de ~95% → placa retangular, não importa quanta transparência o arquivo
  tenha na moldura.

```js
// no navegador, com a imagem já carregada em canvas
// densidade = opacos / area(caixa delimitadora dos opacos)
```

**Quatro armadilhas, nessa ordem, todas já custaram retrabalho:**

1. **Amostrar os cantos para achar a cor do fundo.** A placa tem canto
   arredondado: o canto da caixa cai no vazio, devolve `0,0,0` com alfa 0, e o
   algoritmo conclui que o fundo é preto e não remove nada.
2. **Amostrar o meio das bordas.** O aparelho encosta na borda da placa, então a
   amostra cai em cima do produto e a divergência estoura.
3. **Usar a moda do anel de borda.** Resolve 1 e 2, mas só quando o fundo é
   chapado. Medido nestas fotos, a cor mais comum do anel cobre de 7% a 28% dele
   — o fundo é degradê de estúdio, e não existe "a cor do fundo" para comparar.
4. **Mascarar as bordas em CSS para esconder a placa.** É a mais tentadora e a
   pior: dissolver os 5% externos da foto apaga a lateral do aparelho junto,
   porque o produto encosta na borda. O resultado parece desfoque de lente, e
   quem vê não entende o que houve.

**Quando o fundo é degradê e o produto é escuro, não há recorte automático.**
MacBook cinza-espacial sobre degradê cinza não tem fronteira de cor para
nenhum algoritmo achar: o certo é buscar arte nova na CDN do fabricante (ver
`fotos-de-produto`) ou mascarar à mão. Insistir no automático produz contorno
comido, que é pior que a placa.

**O processo, e não só a técnica:** medir **imagem por imagem** antes de aplicar
qualquer coisa, gravar o resultado numa pasta de prova, olhar sobre fundo
magenta (`#f0f` revela qualquer resto de fundo e qualquer borda comida) e só
então substituir o arquivo bom — guardando o original. Recorte automático erra
de um jeito que relatório nenhum denuncia: ele come um pedaço do aparelho e
segue reportando sucesso.

## Sombra de contato

Produto recortado sem sombra flutua, e a peça perde o peso que o playbook pede.
`sombraDeContato()` em `src/lib/estudio/marca.ts` desenha a elipse borrada; a
largura acompanha a base do aparelho e a altura fica em torno de 1/9 dela.

Em superfície clara a sombra é mais fraca (opacidade 0.35) que em escura (0.75):
no marfim, sombra forte vira mancha.

## O LUT da marca

Um único tratamento em todas as fotos, para a foto real do setup conviver com o
render do fabricante sem parecer de outro ensaio:

- pretos levantados 4%
- verde −10
- laranja de pele preservado

Isso vale para **foto que a loja tirou**. Render oficial não passa pelo LUT — ele
já vem calibrado, e aplicar por cima é exatamente o erro da sombra branca.

Quando o dono for editar em CapCut, Premiere ou Lightroom, entregue o `.cube`
pronto em vez de instruções — um clique aplica em tudo e o padrão para de
depender de memória.

## Resolução

O lado maior precisa de **1600px no mínimo**; abaixo disso a imagem chega
borrada no zoom da página de produto, que é justamente onde o cliente olha de
perto. Nunca amplie mais que 1,5×.

Sem fonte grande o bastante, prefira menos imagens boas a completar o conjunto
com uma ruim. O Galaxy Book4 Edge foi ao ar com cinco fotos em vez de seis por
isso: a sexta só existia em 800px.

## Fundos do sistema

| Uso | Cor |
|---|---|
| Cartão do site | `#111114` |
| Peça escura do Instagram | `#0C0C0D` (ônix) |
| Peça clara do Instagram | `#F2EEE7` (marfim) |
| Packshot de estúdio | `#111113` |

Nunca misture fundo claro e escuro no mesmo produto — denuncia colagem.

## Entregando

Diga o que mudou e o que não mudou. Quando houver ressalva — resolução no
limite, recorte que comeu uma borda, produto menor no quadrado porque a origem
era pequena —, diga antes de perguntarem. Quem publica precisa saber o que está
publicando.
