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
  type Halo,
} from '@/lib/estudio/marca';
import { campo, type Cena, type Desenhista } from '@/lib/estudio/desenhistas/tipos';

const halo = (c: Record<string, string>, chave = 'halo'): Halo =>
  (campo(c, chave, 'roxo') as Halo) in { roxo: 1, magenta: 1, turquesa: 1, rubi: 1, ouro: 1 }
    ? (campo(c, chave, 'roxo') as Halo)
    : 'roxo';

/* ------------------------------------------------------- 3A · produto escuro */

export const desenhar3A: Desenhista = ({ ctx, largura, altura, conteudo, imagens }) => {
  preencher(ctx, COR.onix, largura, altura);
  brilho(ctx, largura / 2, 625, 640, halo(conteudo), 0.32);

  const agua = campo(conteudo, 'marcaDagua');
  if (agua) marcaDagua(ctx, agua, largura / 2, 120, 620);

  if (imagens.produto) {
    sombraDeContato(ctx, 560, 865, 800, 90, 0.75);
    produto(ctx, imagens.produto, { x: -40, y: 200, largura: 1160, altura: 1160 }, {
      rotacao: -7,
      recorteInferior: 0.26,
    });
  }

  lockup(ctx, imagens.icone ?? null, MARGEM, MARGEM, 64);
  const marca = campo(conteudo, 'etiqueta');
  if (marca) etiqueta(ctx, marca, largura - MARGEM, MARGEM + 6, { alinhamento: 'direita' });

  const desconto = campo(conteudo, 'selo');
  if (desconto) selo(ctx, largura - 64 - 115, 755, 115, 'até', desconto, 12);

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
    ctx.fillStyle = ouroMetal(ctx, largura - MARGEM - larguraPreco, base - 68, larguraPreco, 68);
    ctx.textAlign = 'right';
    const soltar = espacamento(ctx, '-1.4px');
    ctx.fillText(preco, largura - MARGEM, base);
    soltar();
    ctx.textAlign = 'left';
  }
  if (parcela) {
    ctx.font = fonteTexto(24);
    ctx.fillStyle = COR.prataEscura;
    ctx.textAlign = 'right';
    ctx.fillText(parcela, largura - MARGEM, base - 78);
    ctx.textAlign = 'left';
  }
  if (ficha) specs(ctx, ficha, MARGEM, base - 86, 26, COR.prata);

  const topoDaFicha = base - 110;
  regua(ctx, MARGEM, topoDaFicha - 28, larguraUtil, COR.grafiteClaro);

  const texto = campo(conteudo, 'titulo', 'Título do post');
  const alturaTitulo = medirTitulo(ctx, texto, larguraUtil, 104);
  titulo(ctx, texto, MARGEM, topoDaFicha - 28 - 24 - alturaTitulo, 104, { largura: larguraUtil, maxLinhas: 2 });

  const acima = campo(conteudo, 'sobretitulo');
  if (acima) rotulo(ctx, acima, MARGEM, topoDaFicha - 28 - 24 - alturaTitulo - 32, 26, COR.prataEscura);
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

export const desenhar3C: Desenhista = ({ ctx, largura, altura, conteudo, imagens }) => {
  preencher(ctx, COR.onix, largura, altura);
  brilho(ctx, 750, 520, 560, halo(conteudo, 'halo'), 0.28);

  if (imagens.produto) {
    sombraDeContato(ctx, 750, 815, 900, 110, 0.75);
    // Sangra na borda de propósito: a caixa passa da largura da arte.
    produto(ctx, imagens.produto, { x: 120, y: -60, largura: 1360, altura: 1360 }, {
      rotacao: -5,
      desfoque: 60,
      sombra: 'rgba(0,0,0,.6)',
    });
  }

  const marca = campo(conteudo, 'etiqueta');
  if (marca) rotulo(ctx, marca, MARGEM, MARGEM + 30, 26, COR.ouro);
  if (imagens.icone) ctx.drawImage(imagens.icone, largura - MARGEM - 64, MARGEM, 64, 64);

  const texto = campo(conteudo, 'titulo', 'Oferta');
  const sub = campo(conteudo, 'subtitulo');
  titulo(ctx, texto, MARGEM, 180, 110, { largura: 640, maxLinhas: 1 });
  if (sub) titulo(ctx, sub, MARGEM, 180 + 99, 110, { largura: 640, cor: COR.prataEscura, maxLinhas: 1 });

  const desconto = campo(conteudo, 'selo');
  if (desconto) selo(ctx, largura - 80 - 115, 285, 115, 'off', desconto, -12);

  rodapeEsfumado(ctx, COR.onix, largura, altura, 460, 0.45);

  const base = altura - MARGEM;
  const rodape = campo(conteudo, 'rodape');
  const cta = campo(conteudo, 'cta');
  if (rodape) rotulo(ctx, rodape, MARGEM, base, 24, COR.prata);
  if (cta) {
    ctx.font = fonteTexto(28, 600);
    ctx.fillStyle = COR.marfim;
    ctx.textAlign = 'right';
    ctx.fillText(cta, largura - MARGEM, base);
    ctx.textAlign = 'left';
  }

  regua(ctx, MARGEM, base - 48, largura - MARGEM * 2, COR.grafiteClaro);

  // Preço de e preço por, na mesma linha de base.
  const preco = campo(conteudo, 'preco');
  const precoDe = campo(conteudo, 'precoDe');
  const linhaPreco = base - 76;
  let cursor = MARGEM;
  if (precoDe) {
    ctx.font = fonteTexto(34);
    ctx.fillStyle = COR.prataEscura;
    ctx.fillText(precoDe, cursor, linhaPreco);
    const l = ctx.measureText(precoDe).width;
    ctx.fillRect(cursor, linhaPreco - 11, l, 2);
    cursor += l + 28;
  }
  if (preco) {
    ctx.font = fonteTitulo(108);
    const l = ctx.measureText(preco).width * 1.12;
    ctx.fillStyle = ouroMetal(ctx, cursor, linhaPreco - 108, l, 108);
    const soltar = espacamento(ctx, '-3px');
    ctx.fillText(preco, cursor, linhaPreco);
    soltar();
  }
};

/* ---------------------------------------------------------- 3D · prova social */

export const desenhar3D: Desenhista = ({ ctx, largura, altura, conteudo, imagens }) => {
  preencher(ctx, COR.marfim, largura, altura);

  const marca = campo(conteudo, 'etiqueta', 'Quem compra, confia');
  rotulo(ctx, marca, MARGEM, MARGEM + 24, 24, COR.bronze);
  rotulo(ctx, '★★★★★', largura - MARGEM, MARGEM + 24, 26, COR.bronze, 'right');

  // Retângulo escuro atrás do produto: é dele que o aparelho "sai".
  ctx.fillStyle = '#111113';
  ctx.fillRect(MARGEM, 300, 620, 500);

  if (imagens.produto) {
    produto(ctx, imagens.produto, { x: 10, y: 90, largura: 820, altura: 820 }, {
      rotacao: -4,
      sombra: 'rgba(0,0,0,.35)',
      desfoque: 40,
    });
  }

  // Cartão da nota.
  const cartaoX = 640;
  const cartaoY = 520;
  const cartaoL = 368;
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
  brilho(ctx, largura / 2, 800, 700, halo(conteudo, 'halo'), 0.3);

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
