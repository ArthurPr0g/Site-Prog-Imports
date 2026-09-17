---
name: fotos-de-produto
description: Monta o conjunto de fotos de um produto da loja Prog Imports a partir da descrição ou do nome do modelo — identifica o aparelho exato, busca imagens em fontes oficiais licenciadas, padroniza em 2560x2560 com fundo #212121 e prepara para subir no admin. Use sempre que o assunto for foto/imagem de produto do catálogo: "buscar imagens desse notebook", "montar as fotos do produto", "esse produto está sem foto", "trocar os placeholders", "preciso das imagens do MacBook", "padronizar essas fotos em 2560", mesmo quando a pessoa não falar em skill nem em tamanho de imagem.
---

# Fotos de produto da Prog Imports

A foto **é** a vitrine: o cliente decide a compra olhando para ela, e a página
do produto tem zoom que amplia a imagem sob o cursor. Por isso o trabalho aqui
tem dois lados que não podem ser separados — achar a imagem **do aparelho
certo** e entregá-la no padrão que o site espera.

## O erro que não pode acontecer

Um cliente que recebe um notebook diferente do que viu na foto abre reclamação,
e ele tem razão. A regra que o dono da loja usa:

- **Pode divergir:** capacidade de SSD, quantidade de RAM, processador, cor do
  papel de parede na tela, região do teclado. Se a descrição diz 1TB e a foto
  oficial é da versão de 2TB, **serve** — o aparelho visível é o mesmo.
- **Não pode divergir:** modelo, geração/ano, tamanho de tela, chassi, cor do
  corpo, disposição de portas, formato do teclado (numérico ou não).

Na dúvida, compare lado a lado: perfil das dobradiças, saídas de ar, posição da
webcam, logotipo, formato do touchpad. Dois modelos com a mesma ficha técnica
podem ser carcaças completamente diferentes — é aí que o erro nasce.

**Quando não der para confirmar o modelo, pare e pergunte.** Entregar uma foto
"parecida" é pior que entregar o produto sem foto: a loja vende importado, e o
cliente compara com o que achou no Google antes de pagar.

## De onde as imagens podem vir

Republicar foto de terceiro numa loja é uso comercial de obra alheia. A ordem de
preferência existe por isso, não por capricho:

1. **Sala de imprensa / press kit do fabricante** — Apple Newsroom, Lenovo
   StoryHub, Dell Press Kits, ASUS Press Room, e afins. É material feito para
   ser republicado por quem vende o produto.
2. **Portal de parceiro ou distribuidor** (quando a loja tem acesso) — costuma
   licenciar explicitamente o revendedor.
3. **Página oficial do produto no site do fabricante** — normalmente aceita para
   revenda do mesmo produto, mas confira o rodapé de termos de uso.

Ver `references/fontes-oficiais.md` para os endereços por fabricante.

**Não use** foto de marketplace ou de loja concorrente (Amazon, Best Buy, Mercado
Livre, B&H), nem banco de imagem sem licença. Além do risco jurídico, essas fotos
costumam vir com marca d'água, selo de frete ou moldura da loja.

Se não existir fonte oficial para aquele produto, **diga isso ao dono** em vez de
improvisar: a saída costuma ser foto própria do aparelho, que é melhor ainda —
prova que a loja tem a unidade.

Registre a origem enquanto trabalha, num `fontes.md` dentro da pasta do produto:

```
1.png — https://news.lenovo.com/.../legion-pro-7i-gen9.jpg — press kit Lenovo, 3000x2000
2.png — https://www.lenovo.com/medias/....png — página oficial do produto
```

Sem isso, daqui a seis meses ninguém sabe se aquela imagem podia ser usada.

## O padrão do site

| Item | Valor |
|---|---|
| Quantidade | 4 a 6 imagens por produto (o site aceita no máximo 8) |
| Dimensão | 2560 × 2560 (quadrado) |
| Fundo | o que a fonte oficial entregar — **não repinte** (ver abaixo) |
| Formato de entrega | PNG ou JPEG, até 5 MB por arquivo |
| Margem | ~4% de respiro nas bordas |

**Sobre o fundo, aprendido na prática (2026-09-17):** a tentação é uniformizar
tudo no cinza do site. Não faça. Fundo de foto de notebook preto não se troca
por recorte — o recorte come o chassi ou deixa halo —, e "levantar o preto" da
imagem clareia o produto junto: o resultado publicado deixa de parecer a foto
que o fabricante fez, e o dono percebe na hora. Mantenha o fundo original e
deixe a moldura do site fazer a separação.

**A "sombra branca" (2026-09-17).** Os quatro produtos Lenovo foram ao ar com
uma elipse branca flutuando embaixo do aparelho. A causa não estava na origem: o
PNG da Lenovo traz a sombra de contato certinha, em **preto com alfa baixo**
(A≈35). A elipse branca era a saída daquela tentativa de levantar o preto, que
ficou na pasta `final/` e foi o que subiu. Composto direto pelo
`padronizar-fotos.ps1`, o mesmo pixel dá `#0f0f11` — sombra de verdade sobre o
cartão.

Duas regras que vêm disso:

- **Nada de pós-processamento entre a origem e o composite.** A única coisa que
  acontece com a imagem do fabricante é redimensionar e centralizar.
- **Confira a sombra antes de subir**, porque no log não aparece: pegue um pixel
  da sombra na imagem pronta e veja se continua escuro.

  ```powershell
  Add-Type -AssemblyName System.Drawing
  $i = [System.Drawing.Bitmap]::new(".\final\1.jpg"); $i.GetPixel(2074, 1792); $i.Dispose()
  ```

  Sombra correta fica perto de `#111114`. Se voltar claro (200+), a imagem passou
  por processamento que não devia e a pasta de saída está contaminada — regere
  a partir das originais em vez de tentar consertar o arquivo pronto.

O site reduz o lado maior para 2560 e converte para WebP no navegador durante o
upload (`lib/image-compress.ts`), então entregar em 2560 PNG é exatamente o que
ele espera: nada é jogado fora e a transparência não vira fundo preto.

**Resolução da origem:** o lado maior precisa ter pelo menos 1600px; abaixo disso
a imagem chega borrada no zoom, que é justamente onde o cliente olha de perto.
Nunca amplie mais que 1,5× o tamanho original — ampliar demais deixa borda
serrilhada e textura de plástico chapada. Sem fonte grande o bastante, prefira
menos fotos boas a completar o conjunto com imagem ruim.

**Ângulos que vendem**, nesta ordem de prioridade: frente aberta (é a capa),
3/4 em perspectiva, perfil fechado mostrando espessura, teclado de cima,
traseira ou lateral com as portas, detalhe (webcam, dobradiça, acabamento).

**Consistência importa mais que variedade:** as 4 a 6 fotos precisam parecer o
mesmo ensaio — mesma cor de corpo, mesmo fundo, mesma escala aproximada. Foto
com fundo branco no meio de um conjunto escuro denuncia colagem.

## Fluxo

1. **Leia a descrição do produto** no catálogo (tabela `products`: `name`,
   `base_name`, `description`, `cpu`, `gpu`, `ram`, `storage`, `color`,
   `condition`) e extraia o modelo exato, incluindo geração e ano.
2. **Pesquise o modelo** e confirme a identidade visual antes de baixar
   qualquer coisa. Se a descrição for ambígua ("Notebook Gamer Lenovo 16"),
   pergunte ao dono qual é o modelo antes de seguir.
3. **Colete as candidatas** das fontes oficiais, guardando a URL de cada uma.
   Baixe para `<pasta-do-produto>/originais/`.
4. **Confira uma a uma:** é o mesmo aparelho? Tem marca d'água ou logo de loja?
   O lado maior tem 1600px ou mais? Descarte sem dó o que falhar.
5. **Padronize** com `scripts/padronizar-fotos.ps1` (abaixo).
6. **Revise o resultado** abrindo as imagens — corte errado, produto espremido
   ou fundo com duas cores aparecem na hora e não aparecem em nenhum log.
7. **Suba no admin** e confira no site.

## Padronizando

```powershell
powershell -File .claude\skills\fotos-de-produto\scripts\padronizar-fotos.ps1 -Entrada ".\originais" -Saida ".\prontas" -Fundo escuro
```

O arquivo precisa continuar salvo em **UTF-8 com BOM**: o Windows PowerShell 5.1
desta máquina lê `.ps1` sem BOM como ANSI e quebra nos acentos.

O script redimensiona mantendo proporção, centraliza numa tela quadrada de
2560×2560, aplica a margem e grava PNG numerado (`1.png`, `2.png`, ...), que é a
ordem em que as fotos vão aparecer. Opções de `-Fundo`: `escuro` (#212121,
padrão), `branco` ou `transparente`.

**Fundo branco na origem:** compor uma foto de fundo branco sobre a tela escura
cria um retângulo branco no meio da imagem. Ou use `-Fundo branco` para o
conjunto inteiro daquele produto, ou remova o fundo antes. Nunca misture os dois
estilos no mesmo produto.

## Atalho que economiza muito trabalho

Alguns CDNs de fabricante aceitam o tamanho na própria URL e devolvem a imagem
já quadrada. O da ASUS é assim:

```
https://dlcdnwebimgs.asus.com/gain/<GUID>/w2560/h2560
```

A altura manda no resultado: `h2560` devolve 2560×2560 pronto, sem recorte nem
moldura. Vale testar o mesmo padrão em outras marcas antes de partir para o
processamento manual — a galeria oficial costuma servir a imagem em `w1000`, e é
só trocar o número.

## Subindo

Com a chave secreta do Supabase em `.env.local` (`SUPABASE_SECRET_KEY`), o
upload é automático:

```powershell
node scripts\subir-fotos.mjs <SKU> <pasta-com-as-fotos> [--substituir]
```

O script faz o que o admin faria: grava no bucket `product-images` sob a pasta
do produto, cria as linhas em `product_images` com o nome do produto como rótulo
e a posição em sequência — a **primeira imagem é a capa**, que aparece na
vitrine, nas listagens e no ERP. Ele também apaga as linhas de placeholder (sem
url) e respeita os limites do site: 8 imagens por produto, 5 MB cada.

`--substituir` troca o conjunto inteiro, apagando as fotos anteriores do banco
**e** do bucket — sem isso o storage acumula arquivo órfão a cada tentativa.

Sem a chave, deixe a pasta numerada na ordem e peça ao dono para arrastar em
**Produtos → editar → área de imagens**.

Depois, abra a página pública do produto e passe o cursor sobre a foto: se o
zoom mostra o detalhe nítido e a imagem aparece limpa, o conjunto está aprovado.

## Entregando o resultado

Diga, por produto: o modelo confirmado (e como confirmou), quantas fotos, de onde
vieram, e o que ficou de fora e por quê. Se alguma foto entrou com ressalva
(resolução no limite, ângulo repetido), avise — quem vende precisa saber o que
está publicando.
