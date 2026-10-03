// Traduz um produto do catálogo nos campos que uma peça precisa.
//
// É o que faz "escolher o produto" preencher metade do formulário sozinho. O
// dono ainda pode editar tudo depois — o preenchimento é ponto de partida, não
// trava: um post de oferta às vezes mostra preço que ainda não está no site, e
// um título de arte raramente é o nome completo do cadastro.

export type ProdutoDoEstudio = {
  id: string;
  sku: string;
  name: string;
  base_name: string | null;
  price: number;
  promo_price: number | null;
  cpu: string | null;
  gpu: string | null;
  ram: string | null;
  storage: string | null;
  screen_type: string | null;
  condition: string | null;
  stock: number | null;
  capa: string | null;
};

/** Preço como o playbook escreve: "R$ 42.499", sem centavos.
 *
 *  Centavo em arte de Instagram é ruído — ninguém decide compra de R$ 23 mil
 *  por causa de noventa e dois centavos, e o ",00" rouba tamanho do número, que
 *  é o elemento que precisa ser lido de longe no grid. */
export function precoDaArte(valor: number): string {
  return `R$ ${Math.round(valor).toLocaleString('pt-BR')}`;
}

/** Até 12 parcelas sem juros é a regra da loja; abaixo de R$ 1.000 a parcela
 *  fica ridícula e o playbook prefere o preço limpo. */
function parcelamento(valor: number): string {
  if (valor < 1000) return '';
  return `12× ${precoDaArte(valor / 12)} sem juros`;
}

/** O nome da arte não é o nome do cadastro.
 *
 *  "Notebook Lenovo Legion 5i Gen 10 15.1" Intel Core i7-14700HX RTX 5070 16GB
 *  RAM 1TB SSD" tem 14 palavras; o playbook aceita 6. O que fica é o modelo —
 *  é por ele que o cliente procura. */
export function tituloDaArte(p: ProdutoDoEstudio): string {
  const base = (p.base_name || p.name).split('—')[0].trim();
  const semPrefixo = base
    .replace(/^(notebook|notebook gamer|smartphone|tablet)\s+/i, '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    // A marca sai do título porque ela já está na linha de cima, e repetir
    // "Alienware Area-51" gasta duas das seis palavras dizendo a mesma coisa
    // duas vezes. O que o cliente procura é o modelo.
    .replace(/^(lenovo|alienware|asus|acer|apple|samsung|dell|rog|predator)\s+/i, '')
    .trim();
  return semPrefixo.split(/\s+/).slice(0, 6).join(' ');
}

/** A marca d'água gigante atrás do produto.
 *
 *  É o "9i", o "M5", o "51" do playbook: o pedaço do nome que identifica o
 *  modelo sem precisar ser lido — em 560px de altura e só contornado, ele
 *  funciona como textura, não como texto. Por isso são poucos caracteres: nome
 *  inteiro vira parede e disputa com o produto. */
export function marcaDaguaSugerida(p: ProdutoDoEstudio): string {
  const titulo = tituloDaArte(p);
  // O primeiro número do nome é o do modelo; os seguintes costumam ser o
  // tamanho da tela. "Area-51 16\"" tem que virar 51, não 16.
  const candidatos = titulo.match(/[A-Za-z]?\d+[A-Za-z]*/g) ?? [];
  const curto = candidatos.find((c) => c.length <= 4);
  if (curto) return curto;
  return titulo.split(/\s+/)[0]?.slice(0, 3) ?? '';
}

/** Linha de marca acima do título: fabricante · linha · geração. */
export function sobretitulo(p: ProdutoDoEstudio): string {
  const base = (p.base_name || p.name).split('—')[0];
  const achados = base.match(/\b(lenovo|legion|alienware|asus|rog|acer|predator|nitro|apple|macbook|samsung|galaxy|dell|tuf)\b/gi);
  if (!achados?.length) return '';
  const unicos = Array.from(new Set(achados.map((a) => a.toUpperCase())));
  return unicos.slice(0, 4).join(' · ');
}

/** Specs em duas linhas de mono, que é o que o rodapé do 3A comporta. */
export function fichaCurta(p: ProdutoDoEstudio): string {
  const primeira = [p.gpu, p.cpu].filter(Boolean).join(' · ');
  const segunda = [p.ram, p.storage, p.screen_type].filter(Boolean).join(' · ');
  return [primeira, segunda].filter(Boolean).join('\n');
}

/** Preço que a peça mostra: o promocional quando existe, senão o cheio. */
export function precoVigente(p: ProdutoDoEstudio): number {
  return p.promo_price && p.promo_price > 0 ? Number(p.promo_price) : Number(p.price);
}

/** Etiqueta do topo. Pronta entrega vence condição: é a informação que o
 *  comentário mais pede depois do preço. */
export function etiquetaSugerida(p: ProdutoDoEstudio): string {
  if ((p.stock ?? 0) > 0) return 'Pronta entrega';
  if (p.condition === 'Novo') return 'Novo · lacrado';
  if (p.condition) return p.condition;
  return 'Exclusivo EUA';
}

/** Desconto em porcentagem inteira, só quando há promoção de verdade. */
export function descontoEmPorcento(p: ProdutoDoEstudio): string {
  const cheio = Number(p.price);
  const promo = p.promo_price ? Number(p.promo_price) : 0;
  if (!promo || promo >= cheio) return '';
  return `${Math.round((1 - promo / cheio) * 100)}%`;
}

/** Preenche os campos do modelo a partir do produto, sem apagar o que o dono
 *  já escreveu — quem edita manda. */
export function preencherComProduto(
  conteudo: Record<string, string>,
  p: ProdutoDoEstudio,
  prefixo: '' | 'A' | 'B' = ''
): Record<string, string> {
  const vigente = precoVigente(p);
  const sugestoes: Record<string, string> = prefixo
    ? { [`rotulo${prefixo}`]: tituloDaArte(p) }
    : {
        titulo: tituloDaArte(p),
        marcaDagua: marcaDaguaSugerida(p),
        sobretitulo: sobretitulo(p),
        specs: fichaCurta(p),
        preco: precoDaArte(vigente),
        parcela: parcelamento(vigente),
        etiqueta: etiquetaSugerida(p),
        selo: descontoEmPorcento(p),
        precoDe: p.promo_price ? precoDaArte(Number(p.price)) : '',
        subtitulo: [p.ram, p.storage].filter(Boolean).join(' · '),
        rodape: [p.gpu, parcelamento(vigente), (p.stock ?? 0) > 0 ? 'Pronta entrega' : '']
          .filter(Boolean)
          .join(' · '),
        // O diagnóstico do playbook é explícito: todo post de produto precisa
        // de preço, prazo e caminho para o WhatsApp. Os dois primeiros saem do
        // cadastro; o terceiro era o que faltava.
        cta: 'WhatsApp →',
      };

  const saida = { ...conteudo };
  for (const [chave, valor] of Object.entries(sugestoes)) {
    if (valor && !saida[chave]?.trim()) saida[chave] = valor;
  }
  return saida;
}
