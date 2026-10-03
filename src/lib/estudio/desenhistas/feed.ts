// Os modelos da seção 03 do playbook — os posts de feed.
//
// As medidas são as do playbook, em pixels de uma arte de 1080×1350. Onde o
// protótipo usa flexbox, aqui a pilha é montada de baixo para cima: o bloco de
// texto tem âncora no rodapé (72px da base) e cresce para cima, que é o que
// mantém o preço sempre na mesma linha em peças de título curto e de título
// longo.

import {
  COR,
  MARGEM,
  brilho,
  etiqueta,
  fonteMono,
  fonteTexto,
  fonteTitulo,
  espacamento,
  lockup,
  marcaDagua,
  ouroMetal,
  paragrafo,
  preencher,
  produto,
  regua,
  rodapeEsfumado,
  rotulo,
  selo,
  sombraDeContato,
  specs,
  titulo,
  type Ctx,
  type Halo,
} from '@/lib/estudio/marca';
import { animador, ROTEIRO, TEMPO } from '@/lib/estudio/animacao';
import { campo, type Cena, type Desenhista } from '@/lib/estudio/desenhistas/tipos';

const halo = (c: Record<string, string>, chave = 'halo'): Halo =>
  (campo(c, chave, 'roxo') as Halo) in { roxo: 1, magenta: 1, turquesa: 1, rubi: 1, ouro: 1 }
    ? (campo(c, chave, 'roxo') as Halo)
    : 'roxo';

/* ------------------------------------------------------- 3A · produto escuro */

export const desenhar3A: Desenhista = ({ ctx, largura, altura, conteudo, imagens, t }) => {
  const a = animador(t);

  preencher(ctx, COR.onix, largura, altura);
  brilho(ctx, largura / 2, 520, 680, halo(conteudo), a.luz(0.5));

  const agua = campo(conteudo, 'marcaDagua');
  if (agua) {
    a.entrada(ctx, ROTEIRO.produto, () => marcaDagua(ctx, agua, largura / 2, 150, 560), {
      subida: 0,
      duracao: TEMPO.produto,
    });
  }

  if (imagens.produto) {
    const img = imagens.produto;
    // A caixa é menor que a do protótipo de propósito. Lá a imagem é um PNG
    // quadrado com o aparelho pequeno no meio e muita transparência em volta;
    // aqui ela chega recortada rente ao produto, então a mesma caixa faria o
    // notebook sangrar pelos quatro lados. O que importa é a área que o produto
    // ocupa, não a da moldura que ele tinha na origem.
    a.zoom(ctx, ROTEIRO.produto, 540, 600, () => {
      sombraDeContato(ctx, 540, 905, 760, 80, 0.75);
      produto(ctx, img, { x: 95, y: 250, largura: 890, altura: 650 }, { rotacao: -7 });
    });
  }

  a.entrada(ctx, ROTEIRO.lockup, () => lockup(ctx, imagens.icone ?? null, MARGEM, MARGEM, 64), {
    subida: 18,
    duracao: TEMPO.micro,
  });
  const marca = campo(conteudo, 'etiqueta');
  if (marca) {
    a.entrada(
      ctx,
      ROTEIRO.etiqueta,
      () => etiqueta(ctx, marca, largura - MARGEM, MARGEM + 6, { alinhamento: 'direita' }),
      { subida: 18, duracao: TEMPO.micro }
    );
  }

  const desconto = campo(conteudo, 'selo');
  if (desconto) {
    a.entrada(ctx, ROTEIRO.specs, () => selo(ctx, largura - 64 - 115, 755, 115, 'até', desconto, 12), {
      subida: 24,
      duracao: TEMPO.micro,
    });
  }

  rodapeEsfumado(ctx, COR.onix, largura, altura, 420, 0.4);

  // Pilha do rodapé, de baixo para cima.
  const base = altura - MARGEM;
  const larguraUtil = largura - MARGEM * 2;

  const preco = campo(conteudo, 'preco');
  const parcela = campo(conteudo, 'parcela');
  const ficha = campo(conteudo, 'specs');

  ctx.font = fonteTitulo(68);
  const larguraPreco = ctx.measureText(preco).width * 1.1;
  if (preco) {
    // A mesma função pinta o preço na arte e na camada da varredura. É por isso
    // que ela recebe o contexto em vez de fechar sobre ele: a luz é recortada
    // pelo algarismo numa camada à parte, e para recortar é preciso ter o
    // algarismo lá também.
    const pintarPreco = (c: Ctx) => {
      c.font = fonteTitulo(68);
      c.fillStyle = ouroMetal(c, largura - MARGEM - larguraPreco, base - 68, larguraPreco, 68);
      c.textAlign = 'right';
      const soltar = espacamento(c, '-1.4px');
      c.fillText(preco, largura - MARGEM, base);
      soltar();
      c.textAlign = 'left';
    };
    a.entrada(ctx, ROTEIRO.preco, () => pintarPreco(ctx), {
      subida: 28,
      duracao: TEMPO.micro,
      escala: 0.94,
      ancora: { x: largura - MARGEM, y: base },
    });
    // A varredura é uma por peça, e vai no preço: é o elemento que o
    // diagnóstico apontou como o mais pedido nos comentários.
    a.varredura(
      ctx,
      { x: largura - MARGEM - larguraPreco - 16, y: base - 78, largura: larguraPreco + 32, altura: 96 },
      pintarPreco
    );
  }
  if (parcela) {
    a.entrada(
      ctx,
      ROTEIRO.parcela,
      () => {
        ctx.font = fonteTexto(24);
        ctx.fillStyle = COR.prataEscura;
        ctx.textAlign = 'right';
        ctx.fillText(parcela, largura - MARGEM, base - 78);
        ctx.textAlign = 'left';
      },
      { subida: 20, duracao: TEMPO.micro }
    );
  }
  if (ficha) {
    a.entrada(ctx, ROTEIRO.specs, () => specs(ctx, ficha, MARGEM, base - 86, 26, COR.prata), {
      subida: 24,
      duracao: TEMPO.micro,
    });
  }

  const topoDaFicha = base - 110;
  a.estica(ctx, ROTEIRO.regua, MARGEM, () =>
    regua(ctx, MARGEM, topoDaFicha - 28, larguraUtil, COR.grafiteClaro)
  );

  const texto = campo(conteudo, 'titulo', 'Título do post');
  const alturaTitulo = medirTitulo(ctx, texto, larguraUtil, 104);
  const topoTitulo = topoDaFicha - 28 - 24 - alturaTitulo;
  a.entrada(ctx, ROTEIRO.titulo, () =>
    titulo(ctx, texto, MARGEM, topoTitulo, 104, { largura: larguraUtil, maxLinhas: 2 })
  );

  const acima = campo(conteudo, 'sobretitulo');
  if (acima) {
    a.entrada(ctx, ROTEIRO.sobretitulo, () => rotulo(ctx, acima, MARGEM, topoTitulo - 32, 26, COR.prataEscura), {
      subida: 24,
      duracao: TEMPO.micro,
    });
  }
};

/* -------------------------------------------------------- 3B · produto claro */

export const desenhar3B: Desenhista = ({ ctx, largura, altura, conteudo, imagens }) => {
  preencher(ctx, COR.marfim, largura, altura);

  const agua = campo(conteudo, 'marcaDagua');
  if (agua) marcaDagua(ctx, agua, largura / 2, 150, 560, { preenchido: COR.papel });

  if (imagens.logo) ctx.drawImage(imagens.logo, MARGEM - 24, MARGEM - 30, 150, 150);
  const marca = campo(conteudo, 'etiqueta');
  if (marca) {
    rotulo(ctx, marca, largura - MARGEM, MARGEM + 24, 24, COR.bronze, 'right');
  }

  if (imagens.produto) {
    sombraDeContato(ctx, 540, 835, 780, 70, 0.35);
    produto(ctx, imagens.produto, { x: 60, y: 150, largura: 960, altura: 960 }, {
      sombra: 'rgba(60,45,20,.28)',
      desfoque: 40,
    });
  }

  callout(ctx, campo(conteudo, 'callout1'), 690, 250, 'direita');
  callout(ctx, campo(conteudo, 'callout2'), 60, 700, 'esquerda');

  // Bloco inferior: texto à esquerda, cartão de preço inclinado à direita.
  const base = altura - MARGEM;
  const preco = campo(conteudo, 'preco');
  let larguraCartao = 0;
  if (preco) {
    ctx.font = fonteTitulo(56);
    larguraCartao = ctx.measureText(preco).width * 1.12 + 64;
    cartaoDePreco(ctx, largura - MARGEM - larguraCartao / 2, base - 70, larguraCartao, campo(conteudo, 'parcela', '12× sem juros'), preco);
  }

  const larguraTexto = largura - MARGEM * 2 - (larguraCartao ? larguraCartao + 24 : 0);
  const sub = campo(conteudo, 'subtitulo');
  if (sub) {
    ctx.font = fonteTexto(30);
    ctx.fillStyle = COR.tintaSecundaria;
    ctx.fillText(sub, MARGEM, base);
  }
  const texto = campo(conteudo, 'titulo', 'Título do post');
  const alturaTitulo = medirTitulo(ctx, texto, larguraTexto, 96);
  const topoTitulo = base - (sub ? 60 : 0) - alturaTitulo;
  titulo(ctx, texto, MARGEM, topoTitulo, 96, { largura: larguraTexto, cor: COR.onix, maxLinhas: 2 });

  const acima = campo(conteudo, 'sobretitulo');
  if (acima) rotulo(ctx, acima, MARGEM, topoTitulo - 24, 24, COR.grafiteTexto);
};

/* ---------------------------------------------------------------- 3C · oferta */

export const desenhar3C: Desenhista = ({ ctx, largura, altura, conteudo, imagens, t }) => {
  const a = animador(t);

  preencher(ctx, COR.onix, largura, altura);
  brilho(ctx, 700, 470, 620, halo(conteudo, 'halo'), a.luz(0.46));

  if (imagens.produto) {
    const img = imagens.produto;
    // Sangra na borda de propósito — a caixa começa depois do meio e termina
    // fora da arte. O que não pode é o produto subir até o topo: o título mora
    // no canto superior esquerdo e precisa de fundo limpo atrás dele.
    a.zoom(ctx, ROTEIRO.produto, 750, 620, () => {
      sombraDeContato(ctx, 760, 900, 820, 90, 0.75);
      produto(ctx, img, { x: 300, y: 310, largura: 900, altura: 620 }, {
        rotacao: -5,
        desfoque: 60,
        sombra: 'rgba(0,0,0,.6)',
      });
    });
  }

  const marca = campo(conteudo, 'etiqueta');
  if (marca) {
    a.entrada(ctx, ROTEIRO.lockup, () => rotulo(ctx, marca, MARGEM, MARGEM + 30, 26, COR.ouro), {
      subida: 18,
      duracao: TEMPO.micro,
    });
  }
  if (imagens.icone) {
    const icone = imagens.icone;
    a.entrada(ctx, ROTEIRO.etiqueta, () => ctx.drawImage(icone, largura - MARGEM - 64, MARGEM, 64, 64), {
      subida: 18,
      duracao: TEMPO.micro,
    });
  }

  // O título do 3C ocupa só a metade esquerda: a direita é do produto sangrando.
  const texto = campo(conteudo, 'titulo', 'Oferta');
  const sub = campo(conteudo, 'tituloLinha2');
  a.entrada(ctx, ROTEIRO.titulo, () => titulo(ctx, texto, MARGEM, 180, 104, { largura: 560, maxLinhas: 2 }));
  if (sub) {
    const alturaTexto = medirTitulo(ctx, texto, 560, 104);
    a.entrada(
      ctx,
      ROTEIRO.titulo,
      () => titulo(ctx, sub, MARGEM, 180 + alturaTexto, 104, { largura: 560, cor: COR.prataEscura, maxLinhas: 1 }),
      { linha: 1 }
    );
  }

  const desconto = campo(conteudo, 'selo');
  if (desconto) {
    a.entrada(ctx, ROTEIRO.specs, () => selo(ctx, largura - 80 - 115, 285, 115, 'off', desconto, -12), {
      subida: 24,
      duracao: TEMPO.micro,
    });
  }

  rodapeEsfumado(ctx, COR.onix, largura, altura, 460, 0.45);

  const base = altura - MARGEM;
  const rodape = campo(conteudo, 'rodape');
  const cta = campo(conteudo, 'cta');
  if (rodape) {
    a.entrada(ctx, ROTEIRO.cta, () => rotulo(ctx, rodape, MARGEM, base, 24, COR.prata), {
      subida: 20,
      duracao: TEMPO.micro,
    });
  }
  if (cta) {
    a.entrada(
      ctx,
      ROTEIRO.cta,
      () => {
        ctx.font = fonteTexto(28, 600);
        ctx.fillStyle = COR.marfim;
        ctx.textAlign = 'right';
        ctx.fillText(cta, largura - MARGEM, base);
        ctx.textAlign = 'left';
      },
      { subida: 20, duracao: TEMPO.micro, linha: 1 }
    );
  }

  a.estica(ctx, ROTEIRO.regua, MARGEM, () =>
    regua(ctx, MARGEM, base - 48, largura - MARGEM * 2, COR.grafiteClaro)
  );

  // Preço de e preço por, na mesma linha de base.
  const preco = campo(conteudo, 'preco');
  const precoDe = campo(conteudo, 'precoDe');
  const linhaPreco = base - 76;
  let cursor = MARGEM;
  if (precoDe) {
    ctx.font = fonteTexto(34);
    const larguraDe = ctx.measureText(precoDe).width;
    const xDe = cursor;
    a.entrada(
      ctx,
      ROTEIRO.precoDe,
      () => {
        ctx.font = fonteTexto(34);
        ctx.fillStyle = COR.prataEscura;
        ctx.fillText(precoDe, xDe, linhaPreco);
        ctx.fillRect(xDe, linhaPreco - 11, larguraDe, 2);
      },
      { subida: 24, duracao: TEMPO.micro }
    );
    cursor += larguraDe + 28;
  }
  if (preco) {
    ctx.font = fonteTitulo(108);
    const l = ctx.measureText(preco).width * 1.12;
    const xPreco = cursor;
    const pintarPreco = (c: Ctx) => {
      c.font = fonteTitulo(108);
      c.fillStyle = ouroMetal(c, xPreco, linhaPreco - 108, l, 108);
      const soltar = espacamento(c, '-3px');
      c.fillText(preco, xPreco, linhaPreco);
      soltar();
    };
    a.entrada(ctx, ROTEIRO.preco, () => pintarPreco(ctx), {
      subida: 32,
      duracao: TEMPO.micro,
      escala: 0.94,
      ancora: { x: xPreco, y: linhaPreco },
    });
    // A varredura é uma por peça, e aqui vai no preço novo.
    a.varredura(ctx, { x: xPreco - 16, y: linhaPreco - 120, largura: l + 32, altura: 144 }, pintarPreco);
  }
};

/* ---------------------------------------------------------- 3D · prova social */

export const desenhar3D: Desenhista = ({ ctx, largura, altura, conteudo, imagens }) => {
  preencher(ctx, COR.marfim, largura, altura);

  const marca = campo(conteudo, 'chamada', 'Quem compra, confia');
  rotulo(ctx, marca, MARGEM, MARGEM + 24, 24, COR.bronze);
  rotulo(ctx, '★★★★★', largura - MARGEM, MARGEM + 24, 26, COR.bronze, 'right');

  // Retângulo escuro atrás do produto: é dele que o aparelho "sai". Precisa
  // sobrar borda visível nos quatro lados, senão o produto deixa de sair da
  // moldura e passa a ser só uma foto por cima de um retângulo.
  ctx.fillStyle = '#111113';
  ctx.fillRect(MARGEM, 260, 600, 470);

  if (imagens.produto) {
    produto(ctx, imagens.produto, { x: 30, y: 180, largura: 680, altura: 500 }, {
      rotacao: -4,
      sombra: 'rgba(0,0,0,.35)',
      desfoque: 40,
    });
  }

  // Cartão da nota, encostado na quina de baixo do retângulo.
  const cartaoX = 620;
  const cartaoY = 560;
  const cartaoL = 388;
  ctx.fillStyle = COR.onix;
  ctx.shadowColor = 'rgba(0,0,0,.25)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 24;
  ctx.fillRect(cartaoX, cartaoY, cartaoL, 300);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  rotulo(ctx, campo(conteudo, 'sobretitulo', campo(conteudo, 'produtoNome', 'Produto')), cartaoX + 36, cartaoY + 56, 20, COR.ouro);
  titulo(ctx, campo(conteudo, 'nota', '4,9'), cartaoX + 36, cartaoY + 76, 72, { largura: cartaoL - 72, maxLinhas: 1 });
  const avaliacoes = campo(conteudo, 'avaliacoes');
  if (avaliacoes) specs(ctx, avaliacoes.replace(/\s*\|\s*/g, '\n'), cartaoX + 36, cartaoY + 192, 18, COR.prataEscura);

  // Depoimento no rodapé.
  const base = altura - MARGEM;
  const autor = campo(conteudo, 'autor');
  if (autor) {
    ctx.font = fonteTexto(28);
    ctx.fillStyle = COR.tintaSecundaria;
    ctx.fillText(autor, MARGEM, base);
  }
  const frase = campo(conteudo, 'depoimento', '"Depoimento do cliente."');
  ctx.font = fonteTitulo(54, 700);
  const alturaFrase = medirTitulo(ctx, frase, largura - MARGEM * 2, 54, 4, 1.12);
  titulo(ctx, frase, MARGEM, base - (autor ? 56 : 0) - alturaFrase, 54, {
    largura: largura - MARGEM * 2,
    cor: COR.onix,
    maxLinhas: 4,
  });
};

/* --------------------------------------------------------- 3E · capa de Reels */

export const desenhar3E: Desenhista = ({ ctx, largura, altura, conteudo, imagens }) => {
  preencher(ctx, COR.onix, largura, altura);
  brilho(ctx, largura / 2, 760, 740, halo(conteudo, 'halo'), 0.48);

  const agua = campo(conteudo, 'marcaDagua');
  if (agua) marcaDagua(ctx, agua, largura / 2, 330, 420, { traco: 'rgba(217,182,110,.4)' });

  if (imagens.produto) {
    sombraDeContato(ctx, 540, 1125, 800, 90, 0.75);
    produto(ctx, imagens.produto, { x: -60, y: 260, largura: 1200, altura: 1200 }, {
      rotacao: -6,
      desfoque: 50,
      sombra: 'rgba(0,0,0,.6)',
    });
  }

  // Degradê alto: a capa precisa ler no grid, onde só o miolo 4:5 aparece.
  rodapeEsfumado(ctx, COR.onix, largura, altura, 920, 0.28);

  const base = 1180;
  const marca = campo(conteudo, 'etiqueta');
  if (marca) rotulo(ctx, marca, MARGEM, base + 32, 32, COR.ouro);

  const texto = campo(conteudo, 'titulo', 'Título do Reels');
  const alturaTitulo = titulo(ctx, texto, MARGEM, base + 70, 132, {
    largura: largura - MARGEM * 2,
    maxLinhas: 3,
  });

  const sub = campo(conteudo, 'subtitulo');
  if (sub) paragrafo(ctx, sub, MARGEM, base + 70 + alturaTitulo + 24, 40, { largura: largura - MARGEM * 2, maxLinhas: 2 });
};

/* ------------------------------------------------------------------ apoio */

/** Altura que um título vai ocupar, para ancorar a pilha no rodapé. */
function medirTitulo(
  ctx: Cena['ctx'],
  texto: string,
  largura: number,
  tamanho: number,
  maxLinhas = 2,
  entrelinha = 0.92
): number {
  ctx.font = fonteTitulo(tamanho);
  if (texto.includes('\n')) {
    return Math.min(texto.split('\n').length, maxLinhas) * tamanho * entrelinha;
  }
  const palavras = texto.split(/\s+/).filter(Boolean);
  let linhas = 1;
  let atual = '';
  for (const p of palavras) {
    const tentativa = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(tentativa).width * 1.15 <= largura || !atual) atual = tentativa;
    else { linhas++; atual = p; }
    if (linhas === maxLinhas) break;
  }
  return linhas * tamanho * entrelinha;
}

/** Callout técnico do 3B: bolinha, linha e caixa com borda. */
function callout(ctx: Cena['ctx'], texto: string, x: number, y: number, lado: 'esquerda' | 'direita'): void {
  if (!texto) return;
  const linhas = texto.split('\n').slice(0, 2);
  const tamanho = 22;
  ctx.font = fonteMono(tamanho);
  const larguraTexto = Math.max(...linhas.map((l) => ctx.measureText(l.toUpperCase()).width));
  const caixaL = larguraTexto + 32;
  const caixaA = linhas.length * tamanho * 1.3 + 20;
  const direcao = lado === 'direita' ? 1 : -1;

  ctx.fillStyle = COR.bronze;
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const comprimento = lado === 'direita' ? 60 : 50;
  ctx.fillRect(lado === 'direita' ? x : x - comprimento, y - 1, comprimento, 2);

  const caixaX = lado === 'direita' ? x + comprimento : x - comprimento - caixaL;
  const caixaY = y - caixaA / 2;
  ctx.fillStyle = COR.marfim;
  ctx.fillRect(caixaX, caixaY, caixaL, caixaA);
  ctx.strokeStyle = COR.onix;
  ctx.lineWidth = 2;
  ctx.strokeRect(caixaX, caixaY, caixaL, caixaA);

  ctx.fillStyle = COR.onix;
  const soltar = espacamento(ctx, '1.3px');
  linhas.forEach((l, i) => ctx.fillText(l.toUpperCase(), caixaX + 16, caixaY + 10 + tamanho + i * tamanho * 1.3));
  soltar();
  void direcao;
}

/** Cartão de preço inclinado do 3B. */
function cartaoDePreco(
  ctx: Cena['ctx'],
  cx: number,
  cy: number,
  largura: number,
  parcela: string,
  preco: string
): void {
  const altura = 140;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-3 * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0,0,0,.25)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = COR.onix;
  ctx.fillRect(-largura / 2, -altura / 2, largura, altura);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.textAlign = 'right';
  ctx.font = fonteMono(20);
  const soltar = espacamento(ctx, '2px');
  ctx.fillStyle = COR.prataEscura;
  ctx.fillText(parcela.toUpperCase(), largura / 2 - 32, -altura / 2 + 44);
  soltar();

  ctx.font = fonteTitulo(56);
  ctx.fillStyle = COR.ouroClaro;
  ctx.fillText(preco, largura / 2 - 32, altura / 2 - 34);
  ctx.textAlign = 'left';
  ctx.restore();
}

export const DESENHISTAS_DE_FEED: Record<string, Desenhista> = {
  '3a': desenhar3A,
  '3b': desenhar3B,
  '3c': desenhar3C,
  '3d': desenhar3D,
  '3e': desenhar3E,
};
