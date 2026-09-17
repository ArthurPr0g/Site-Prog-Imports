# Onde procurar imagem oficial, por fabricante

A ordem dentro de cada marca é a mesma: sala de imprensa primeiro (material feito
para republicação), depois a página do produto. Confirme sempre que a página é do
domínio do próprio fabricante — há muito agregador que se disfarça de oficial.

| Marca | Onde procurar |
|---|---|
| Apple | `apple.com/newsroom` (galerias por produto) e a página do produto em `apple.com` |
| Lenovo / Legion | `news.lenovo.com` (StoryHub) e `lenovo.com` |
| Dell / Alienware | Press kits em `dell.com/en-us/dt/corporate/newsroom` e `dell.com` |
| ASUS / ROG | `press.asus.com`, `rog.asus.com` |
| Acer / Predator | `acer.com/us-en/press`, página do produto |
| HP / Omen | `press.hp.com`, `hp.com` |
| Samsung | `news.samsung.com` (Media Library) |
| MSI | `msi.com/news`, página do produto |
| Razer | `press.razer.com` |
| Logitech | `logitech.com/pressroom` |
| Intel / AMD / NVIDIA | Salas de imprensa próprias, úteis para peças e placas |

## Endereço direto da galeria, por CDN

Vale mais que a busca: a página do produto é renderizada no navegador e não
entrega nada por HTTP, mas o CDN aceita o tamanho na URL. O caminho é sempre o
mesmo: pegar os identificadores no HTML da página e montar a URL grande.

**ASUS / ROG** — `dlcdnwebimgs.asus.com`. A galeria de verdade está na página
`/gallery/`, não na página da série: `rog.asus.com/<pais>/laptops/<linha>/<produto>/gallery/`
vem com os GUIDs já no HTML servido (dá para pegar com `Invoke-WebRequest`).

```
https://dlcdnwebimgs.asus.com/gain/<GUID>/w2560/h2560
```

A página da **série** traz GUID de banner de marketing e de produtos que nem são
o seu (fonte, gabinete, teclado). A `/gallery/` traz só o aparelho.

**Acer / Predator** — Scene7 em `images.acer.com`. A página de família mostra o
modelo do ano corrente; para um modelo antigo, use a **PDP por part number**
(`acer.com/us-en/.../pdp/NH.XXXXX.001`), que é onde os nomes do Scene7 do modelo
certo aparecem.

```
https://images.acer.com/is/image/acer/<nome>?wid=2560&hei=2560&fit=constrain&fmt=png-alpha
```

`req=props` **não** serve para descobrir o tamanho nativo aqui: devolve o tamanho
do preset padrão (400px) e o Scene7 amplia calado quando você pede maior.

**Dell / Alienware** — Scene7 em `i.dell.com`. O HTML da página SPD traz a
galeria inteira com o tamanho nativo já na query (`wid`/`hei`/`size`); é só
reduzir proporcionalmente para 2560. Mantém `fmt=png-alpha`.

```
i.dell.com/is/image/DellContent/.../alienware-notebooks/<slug>/media-gallery/<arquivo>.psd?fmt=png-alpha&wid=W&hei=H&size=W,H&scl=1&qlt=100,1&resMode=sharp2&chrss=full
```

Pede `Referer: https://www.dell.com/` e responde **503 em pedido rápido em
sequência** — uma pausa de ~1s entre imagens e 3 ou 4 tentativas resolve. Tamanho
fora da proporção nativa também dá 503.

**Samsung** — Scene7 em `images.samsung.com`, caminho `p6pim/<pais>/<modelo>/gallery/`.
O identificador termina em número; o `-thumb-<n>` da página é 330px e a versão
grande costuma ser **`<n-1>` sem o `thumb`**. Varrer uma faixa de dez números
acha o ensaio inteiro.

```
https://images.samsung.com/is/image/samsung/p6pim/<pais>/<modelo>/gallery/<id>?wid=3000&fit=constrain&fmt=png-alpha
```

`fit=constrain` é o que revela o teto nativo: sem ele o Scene7 amplia; com ele,
pedir 3000 e receber 1600 significa que 1600 é tudo que existe. Produto
descontinuado não tem mais página na região de origem — procure o **mesmo part
number em outra região** (`/ca/business/`, `/hk_en/business/`), que costuma
continuar no ar.

## Como reconhecer que a imagem serve

- **Resolução**: lado maior a partir de 1600px; press kit costuma entregar
  2000–4000px, que é o ideal para o zoom do site.
- **Limpeza**: sem marca d'água, sem selo de loja, sem texto promocional, sem
  moldura. Press kit vem limpo; print de anúncio, não.
- **Fundo**: branco ou neutro, ou já recortado em PNG com transparência. Fundo de
  ambiente (mesa, escritório) foge do padrão do catálogo.
- **Consistência**: prefira fotos do mesmo ensaio — a mesma sessão traz ângulos
  diferentes com iluminação igual, que é o que faz a galeria parecer profissional.

## Busca que funciona

Procurar pelo **nome comercial completo + geração** encontra o ensaio oficial:
"Lenovo Legion Pro 7i Gen 9 press images", "MacBook Pro 14 M4 newsroom",
"Alienware Area-51 16 press kit". Buscar por especificação ("notebook 32GB RTX
4080") devolve qualquer carcaça com aquela ficha — exatamente o erro que a skill
existe para evitar.

Quando o produto é exclusivo dos EUA e o fabricante não publica press kit dele,
registre isso no `fontes.md` e avise o dono: nesse caso a foto própria do aparelho
costuma ser a única saída limpa.
