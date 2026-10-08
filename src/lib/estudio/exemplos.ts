// O conteúdo de exemplo de cada modelo.
//
// Serve à miniatura da página do Estúdio: em vez de descrever o modelo em
// palavras, a tela desenha a peça. É o mesmo desenhista que gera a arte final,
// então o que aparece na grade é literalmente o que o modelo produz — não um
// mockup que pode envelhecer sem ninguém notar.
//
// O texto é plausível e específico de propósito. "Título do post" numa
// miniatura não mostra nada: o que faz escolher entre o 3A e o 3C é ver quanto
// texto cabe, onde o preço fica e como o produto sangra na borda.

export const EXEMPLOS: Record<string, Record<string, string>> = {
  '3a': {
    etiqueta: 'Pronta entrega',
    sobretitulo: 'ALIENWARE · AREA-51',
    titulo: 'Area-51 16"',
    specs: 'RTX 5080 · ULTRA 9\n32GB · 1TB · 240 HZ',
    preco: 'R$ 22.999',
    parcela: '3× R$ 7.666 sem juros',
    marcaDagua: '51',
    selo: '12%',
    halo: 'roxo',
  },
  '3b': {
    etiqueta: 'Linha Apple',
    sobretitulo: 'MACBOOK PRO',
    titulo: 'MacBook Pro M5',
    subtitulo: '32GB · 1TB',
    callout1: 'Tela Mini-LED\n120Hz',
    callout2: 'Bateria\n22 horas',
    preco: 'R$ 18.499',
    parcela: '3× sem juros',
    marcaDagua: 'M5',
  },
  '3c': {
    etiqueta: 'Oferta da semana',
    titulo: 'Menos que',
    tituloLinha2: 'no Brasil',
    precoDe: 'R$ 26.999',
    preco: 'R$ 22.999',
    selo: '15%',
    rodape: 'RTX 5080 · 3× R$ 7.666 · PRONTA ENTREGA',
    cta: 'WhatsApp →',
    halo: 'magenta',
  },
  '3d': {
    chamada: 'Quem compra, confia',
    sobretitulo: 'LEGION 9I · 18"',
    nota: '4,9',
    avaliacoes: '23 avaliações | 100% recomendam',
    depoimento: '"Chegou em 11 dias, lacrado e com nota. Paguei menos que no Brasil e ainda veio com a configuração que eu queria."',
    autor: 'Rafael M. · São Paulo',
  },
  '3e': {
    etiqueta: 'Teste de fogo',
    titulo: '7 dias com o Area-51',
    subtitulo: 'Temperatura, FPS e o que ninguém mostra no unboxing.',
    marcaDagua: '51',
    halo: 'rubi',
  },
  '4a': {
    titulo: 'Como importar\nsem susto',
    subtitulo: 'O caminho inteiro, do pedido à sua porta.',
    passo1: 'Você escolhe',
    texto1: 'A gente confere preço, prazo e disponibilidade antes de qualquer pagamento.',
    passo2: 'Compra nos EUA',
    texto2: 'Produto novo, lacrado, comprado em loja oficial.',
    passo3: 'Voa para o Brasil',
    texto3: 'Com rastreio e impostos já calculados — sem surpresa na alfândega.',
    chamada: 'Qual máquina você quer?',
    cta: 'Chama no WhatsApp',
    halo: 'turquesa',
  },
  '4b': {
    titulo: 'Legion Gen 10\nchegou',
    subtitulo: 'Três configurações, todas em pronta entrega.',
    item1: 'RTX 5070 · 16GB',
    item2: 'RTX 5080 · 32GB',
    item3: 'RTX 5090 · 64GB',
    cta: 'Ver no site',
    halo: 'roxo',
  },
  '5a': {
    etiqueta: 'Chegou · pronta entrega',
    titulo: 'Area-51 16"',
    specs: 'RTX 5080 · ULTRA 9 · 240 HZ',
    preco: 'R$ 22.999',
    cta: 'Responda "QUERO"',
    halo: 'roxo',
  },
  '5b': {
    etiqueta: 'Você decide · próximo teste',
    titulo: 'Qual entra\nno Teste\nde Fogo?',
    rotuloA: 'Legion 9i',
    rotuloB: 'ROG SCAR 18',
  },
  '5c': {
    titulo: 'Pergunte\nao importador.',
    subtitulo: 'Prazo, imposto, garantia — respondo tudo aqui.',
    placeholder: 'Sua dúvida sobre importação',
  },
  '5d': {
    pergunta: 'Se der problema, a garantia funciona no Brasil?',
    autorPergunta: '@rafael.mts',
    titulo: 'Funciona,\ne é nossa.',
    subtitulo: 'Assistência local, sem depender do fabricante lá fora.',
  },
  '5e1': { icone: 'package', rotulo: 'Pronta entrega' },
  '5e2': { icone: 'shield-check', rotulo: 'Garantia' },
  '5e3': { icone: 'route', rotulo: 'Rastreio', numero: '3' },
};

/** O exemplo de um modelo, ou um mínimo que não quebre o desenho. */
export function exemploDe(codigo: string): Record<string, string> {
  return EXEMPLOS[codigo] ?? { titulo: 'Prog Imports' };
}
