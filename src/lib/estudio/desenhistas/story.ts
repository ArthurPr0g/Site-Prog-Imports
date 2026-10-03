// Stories e capas de destaque — seção 05 do playbook.
//
// O que muda em relação ao feed é a área útil. O story tem 1920px de altura,
// mas o Instagram cobre os 250 de cima com o avatar e a barra de progresso, e
// os 340 de baixo com a caixa de resposta. Tudo que importa vive entre y=250 e
// y=1580; fora disso o texto existe no arquivo e some na tela.

import {
  COR,
  MARGEM,
  brilho,
  caminhoArredondado,
  espacamento,
  fonteMono,
  fonteTexto,
  fonteTitulo,
  ouroMedalha,
  ouroMetal,
  paragrafo,
  preencher,
  produto,
  regua,
  rodapeEsfumado,
  rotulo,
  sombraDeContato,
  titulo,
  type Ctx,
  type Halo,
} from '@/lib/estudio/marca';
import { animador, ROTEIRO, TEMPO } from '@/lib/estudio/animacao';
import { desenharIcone } from '@/lib/estudio/icones';
import { campo, type Desenhista } from '@/lib/estudio/desenhistas/tipos';

/** Faixa que sobrevive à interface do Instagram. */
const SEGURO = { topo: 250, base: 1580 } as const;

const HALOS: Halo[] = ['roxo', 'magenta', 'turquesa', 'rubi', 'ouro'];
const halo = (c: Record<string, string>, padrao: Halo = 'roxo'): Halo => {
  const v = campo(c, 'halo', padrao) as Halo;
  return HALOS.includes(v) ? v : padrao;
};

/* ---------------------------------------------------------- 5A · venda */

export const desenhar5A: Desenhista = ({ ctx, largura, altura, conteudo, imagens, t }) => {
  const a = animador(t);

  preencher(ctx, COR.onix, largura, altura);
  brilho(ctx, largura / 2, 760, 680, halo(conteudo), a.luz(0.46));

  if (imagens.produto) {
    const img = imagens.produto;
    a.zoom(ctx, ROTEIRO.produto, 540, 720, () => {
      sombraDeContato(ctx, 540, 1010, 760, 90, 0.8);
      produto(ctx, img, { x: 110, y: 420, largura: 860, altura: 600 }, { rotacao: -7 });
    });
  }
  rodapeEsfumado(ctx, COR.onix, largura, altura, 760, 0.35);

  const marca = campo(conteudo, 'etiqueta');
  if (marca) {
    a.entrada(ctx, ROTEIRO.etiqueta, () => rotulo(ctx, marca, MARGEM, SEGURO.topo + 60, 28, COR.ouro), {
      subida: 20,
      duracao: TEMPO.micro,
    });
  }

  // Pilha ancorada no fim da área segura, crescendo para cima.
  let y = SEGURO.base;

  const cta = campo(conteudo, 'cta');
  if (cta) {
    const yCta = y;
    a.entrada(
      ctx,
      ROTEIRO.cta,
      () => {
        ctx.font = fonteTexto(36, 600);
        const l = ctx.measureText(cta).width + 96;
        const altura = 110;
        caminhoArredondado(ctx, MARGEM, yCta - altura, l, altura, [55, 55, 55, 55]);
        ctx.fillStyle = COR.marfim;
        ctx.fill();
        ctx.fillStyle = COR.onix;
        ctx.fillText(cta, MARGEM + 48, yCta - altura / 2 + 13);
      },
      { subida: 32, duracao: TEMPO.micro }
    );
    y -= 110 + 56;
  }

  const preco = campo(conteudo, 'preco');
  if (preco) {
    const yPreco = y;
    ctx.font = fonteTitulo(116);
    const larguraPreco = ctx.measureText(preco).width * 1.12;
    const pintarPreco = (c: Ctx) => {
      c.font = fonteTitulo(116);
      c.fillStyle = ouroMetal(c, MARGEM, yPreco - 116, larguraPreco, 116);
      const soltar = espacamento(c, '-3px');
      c.fillText(preco, MARGEM, yPreco);
      soltar();
    };
    a.entrada(ctx, ROTEIRO.preco, () => pintarPreco(ctx), {
      subida: 36,
      duracao: TEMPO.micro,
      escala: 0.94,
      ancora: { x: MARGEM, y: yPreco },
    });
    a.varredura(
      ctx,
      { x: MARGEM - 16, y: yPreco - 128, largura: larguraPreco + 32, altura: 156 },
      pintarPreco
    );
    y -= 150;
  }

  const ficha = campo(conteudo, 'specs');
  if (ficha) {
    const yFicha = y;
    a.entrada(
      ctx,
      ROTEIRO.specs,
      () => {
        ctx.font = fonteMono(28);
        const soltar = espacamento(ctx, '2.6px');
        ctx.fillStyle = COR.prata;
        ctx.fillText(ficha.split('\n')[0].toUpperCase(), MARGEM, yFicha);
        soltar();
      },
      { subida: 24, duracao: TEMPO.micro }
    );
    y -= 44;
  }

  const yRegua = y;
  a.estica(ctx, ROTEIRO.regua, MARGEM, () =>
    regua(ctx, MARGEM, yRegua, largura - MARGEM * 2, COR.grafiteClaro)
  );
  y -= 36;

  const texto = campo(conteudo, 'titulo', 'Título do story');
  ctx.font = fonteTitulo(104);
  const linhas = texto.includes('\n') ? texto.split('\n').length : 1;
  const yTitulo = y - linhas * 96;
  a.entrada(ctx, ROTEIRO.titulo, () =>
    titulo(ctx, texto, MARGEM, yTitulo, 104, { largura: largura - MARGEM * 2, maxLinhas: 2 })
  );
};

/* -------------------------------------------------------- 5B · enquete */

export const desenhar5B: Desenhista = ({ ctx, largura, altura, conteudo, imagens }) => {
  preencher(ctx, COR.onix, largura, altura);

  const marca = campo(conteudo, 'etiqueta', 'Você decide · próximo teste');
  rotulo(ctx, marca, MARGEM, SEGURO.topo + 50, 32, COR.ouro);

  const texto = campo(conteudo, 'titulo', 'Qual entra\nno Teste\nde Fogo?');
  titulo(ctx, texto, MARGEM, 370, 120, { largura: largura - MARGEM * 2, maxLinhas: 3 });

  // Dois quadros lado a lado, cada um com o seu produto e a sua luz.
  const topo = 820;
  const alturaQuadro = 520;
  const vao = 16;
  const larguraQuadro = (largura - MARGEM * 2 - vao) / 2;

  const lados = [
    { x: MARGEM, img: imagens.produtoA, rot: campo(conteudo, 'rotuloA'), cor: halo(conteudo, 'rubi'), giro: -8, alinha: 'left' as const },
    { x: MARGEM + larguraQuadro + vao, img: imagens.produtoB, rot: campo(conteudo, 'rotuloB'), cor: halo(conteudo, 'magenta'), giro: 8, alinha: 'right' as const },
  ];

  for (const lado of lados) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(lado.x, topo, larguraQuadro, alturaQuadro);
    ctx.clip();
    ctx.fillStyle = '#141416';
    ctx.fillRect(lado.x, topo, larguraQuadro, alturaQuadro);
    brilho(ctx, lado.x + larguraQuadro / 2, topo + alturaQuadro * 0.55, larguraQuadro * 0.8, lado.cor, 0.4);
    if (lado.img) {
      produto(ctx, lado.img, { x: lado.x - 40, y: topo - 40, largura: larguraQuadro + 80, altura: 380 }, { rotacao: lado.giro, desfoque: 30 });
    }
    ctx.restore();
    if (lado.rot) {
      rotulo(
        ctx,
        lado.rot,
        lado.alinha === 'left' ? lado.x + 32 : lado.x + larguraQuadro - 32,
        topo + alturaQuadro - 36,
        32,
        COR.marfim,
        lado.alinha === 'left' ? 'left' : 'right'
      );
    }
  }

  // O VS fica na emenda dos dois quadros — é o único ouro da peça.
  const cx = largura / 2;
  const cy = topo + 200;
  ctx.fillStyle = ouroMedalha(ctx, cx, cy, 75);
  ctx.beginPath();
  ctx.arc(cx, cy, 75, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = fonteTitulo(54, 900);
  ctx.fillStyle = COR.onix;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VS', cx, cy + 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Barra branca: é o lugar onde o sticker nativo de enquete vai por cima.
  const barraY = 1390;
  caminhoArredondado(ctx, 150, barraY, largura - 300, 150, [24, 24, 24, 24]);
  ctx.fillStyle = COR.marfim;
  ctx.fill();
  ctx.fillStyle = COR.papelBorda;
  ctx.fillRect(largura / 2 - 1, barraY + 20, 2, 110);
  ctx.font = fonteTexto(44, 700);
  ctx.fillStyle = COR.onix;
  ctx.textAlign = 'center';
  ctx.fillText(campo(conteudo, 'rotuloA', 'Opção A'), largura / 2 - (largura - 300) / 4, barraY + 90);
  ctx.fillText(campo(conteudo, 'rotuloB', 'Opção B'), largura / 2 + (largura - 300) / 4, barraY + 90);
  ctx.textAlign = 'left';

  rotulo(ctx, '↑ sticker nativo de enquete aqui', 150, barraY + 210, 24, COR.grafiteTexto);
};

/* ------------------------------------------------------- 5C · caixinha */

export const desenhar5C: Desenhista = ({ ctx, largura, altura, conteudo, imagens }) => {
  preencher(ctx, COR.marfim, largura, altura);

  if (imagens.logo) ctx.drawImage(imagens.logo, largura / 2 - 130, 260, 260, 260);

  const texto = campo(conteudo, 'titulo', 'Pergunte\nao importador.');
  titulo(ctx, texto, largura / 2, 600, 110, {
    largura: largura - MARGEM * 2,
    cor: COR.onix,
    maxLinhas: 3,
    alinhamento: 'center',
  });

  const sub = campo(conteudo, 'subtitulo');
  if (sub) {
    ctx.textAlign = 'center';
    paragrafo(ctx, sub, largura / 2, 880, 40, {
      largura: largura - 240,
      cor: COR.tintaSecundaria,
      maxLinhas: 3,
    });
    ctx.textAlign = 'left';
  }

  // A moldura escura é só o lugar do sticker nativo de perguntas — ela existe
  // para o dono saber onde colar, não para ser a caixa de verdade.
  const caixaY = 1120;
  caminhoArredondado(ctx, 150, caixaY, largura - 300, 300, [28, 28, 28, 28]);
  ctx.fillStyle = COR.onix;
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.font = fonteTexto(40, 600);
  ctx.fillStyle = COR.marfim;
  ctx.fillText(campo(conteudo, 'placeholder', 'Sua dúvida sobre importação'), largura / 2, caixaY + 110);

  const campoY = caixaY + 155;
  caminhoArredondado(ctx, largura / 2 - (largura - 420) / 2, campoY, largura - 420, 90, [14, 14, 14, 14]);
  ctx.fillStyle = COR.grafite;
  ctx.fill();
  ctx.font = fonteTexto(30);
  ctx.fillStyle = COR.grafiteTexto;
  ctx.fillText('Digite algo…', largura / 2, campoY + 56);
  ctx.textAlign = 'left';

  rotulo(ctx, '↑ sticker nativo de perguntas', 150, caixaY + 380, 24, '#8a8478');
};

/* ------------------------------------------------------- 5D · resposta */

export const desenhar5D: Desenhista = ({ ctx, largura, altura, conteudo, imagens }) => {
  preencher(ctx, COR.onix, largura, altura);

  // Foto de bastidor inclinada, cobrindo a metade de baixo. É a prova de que a
  // loja tem o aparelho na mão — por isso ela vem em foto, e não em render.
  const foto = imagens.fundo ?? imagens.produto;
  if (foto) {
    ctx.save();
    ctx.translate(largura / 2, 1180);
    ctx.rotate((-14 * Math.PI) / 180);
    const lado = 1920;
    ctx.drawImage(foto, -lado / 2, -lado / 2, lado, lado);
    ctx.restore();
    const g = ctx.createLinearGradient(0, 0, 0, altura);
    g.addColorStop(0, 'rgba(12,12,13,.2)');
    g.addColorStop(0.3, 'rgba(12,12,13,.2)');
    g.addColorStop(0.72, COR.onix);
    g.addColorStop(1, COR.onix);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, largura, altura);
  }

  // Balão da pergunta, no topo da área segura.
  const pergunta = campo(conteudo, 'pergunta', 'Pergunta do seguidor');
  const autor = campo(conteudo, 'autorPergunta');
  ctx.font = fonteTexto(46, 600);
  const linhas: string[] = [];
  let atual = '';
  for (const p of pergunta.split(/\s+/)) {
    const t = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(t).width <= largura - MARGEM * 2 - 88 || !atual) atual = t;
    else { linhas.push(atual); atual = p; }
  }
  if (atual) linhas.push(atual);

  const alturaBalao = linhas.length * 58 + (autor ? 108 : 70);
  caminhoArredondado(ctx, MARGEM, 300, largura - MARGEM * 2, alturaBalao, [24, 24, 24, 24]);
  ctx.fillStyle = COR.marfim;
  ctx.fill();

  let yTexto = 300 + 60;
  if (autor) {
    rotulo(ctx, autor, MARGEM + 44, yTexto, 26, COR.grafiteTexto);
    yTexto += 56;
  }
  ctx.font = fonteTexto(46, 600);
  ctx.fillStyle = COR.onix;
  linhas.forEach((l, i) => ctx.fillText(l, MARGEM + 44, yTexto + 34 + i * 58));

  // Resposta, ancorada acima da caixa de resposta do Instagram.
  const texto = campo(conteudo, 'titulo', 'Resposta curta.');
  const sub = campo(conteudo, 'subtitulo');
  const alturaResposta = (texto.includes('\n') ? texto.split('\n').length : 1) * 85;
  const base = SEGURO.base - (sub ? 70 : 0);
  titulo(ctx, texto, MARGEM, base - alturaResposta, 92, { largura: largura - MARGEM * 2, maxLinhas: 3 });
  if (sub) paragrafo(ctx, sub, MARGEM, base + 10, 38, { largura: largura - MARGEM * 2, maxLinhas: 2 });
};

/* ------------------------------------------- 5E · capas de destaque */

/** As três direções do playbook. O disco é centrado num quadrado de 1080 para
 *  o recorte circular do Instagram pegar o desenho inteiro. */
function capaDeDestaque(
  ctx: Ctx,
  largura: number,
  altura: number,
  conteudo: Record<string, string>,
  direcao: 'onix' | 'medalha' | 'indice',
  icone: HTMLImageElement | null
): void {
  preencher(ctx, direcao === 'medalha' ? COR.marfim : COR.onix, largura, altura);

  const cx = largura / 2;
  const cy = altura / 2;
  const raio = 300;
  const nome = campo(conteudo, 'icone', 'package');

  if (direcao === 'onix') {
    const g = ctx.createRadialGradient(cx - raio * 0.4, cy - raio * 0.5, raio * 0.1, cx, cy, raio);
    g.addColorStop(0, '#26262b');
    g.addColorStop(0.6, '#111113');
    g.addColorStop(1, '#0a0a0b');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, raio, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(217,182,110,.18)';
    ctx.lineWidth = 3;
    ctx.stroke();
  } else if (direcao === 'medalha') {
    const g = ctx.createRadialGradient(cx - raio * 0.4, cy - raio * 0.6, raio * 0.1, cx, cy, raio);
    g.addColorStop(0, '#F4E2B4');
    g.addColorStop(0.35, '#D2AE66');
    g.addColorStop(0.7, '#A47B35');
    g.addColorStop(1, '#6E4E1C');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, raio, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#141416';
    ctx.beginPath();
    ctx.arc(cx, cy, raio, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a3a3f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, raio - 20, 0, Math.PI * 2);
    ctx.stroke();
  }

  // O ícone ocupa no máximo 36% do diâmetro: acima disso o anel do Instagram
  // corta o desenho na borda.
  const ladoIcone = raio * 2 * 0.34;
  const corDoIcone = direcao === 'medalha' ? COR.onix : COR.ouroClaro;
  const deslocamento = direcao === 'indice' ? -24 : 0;

  if (nome === 'globo') {
    if (icone) ctx.drawImage(icone, cx - ladoIcone / 2, cy - ladoIcone / 2 + deslocamento, ladoIcone, ladoIcone);
  } else {
    desenharIcone(ctx as CanvasRenderingContext2D, nome, cx, cy + deslocamento, ladoIcone, corDoIcone);
  }

  if (direcao === 'indice') {
    const numero = campo(conteudo, 'numero');
    if (numero) rotulo(ctx, numero.padStart(2, '0'), cx, cy + 86, 26, COR.prataEscura, 'center');
  }
}

export const desenhar5E1: Desenhista = ({ ctx, largura, altura, conteudo, imagens }) =>
  capaDeDestaque(ctx, largura, altura, conteudo, 'onix', imagens.icone ?? null);

export const desenhar5E2: Desenhista = ({ ctx, largura, altura, conteudo, imagens }) =>
  capaDeDestaque(ctx, largura, altura, conteudo, 'medalha', imagens.icone ?? null);

export const desenhar5E3: Desenhista = ({ ctx, largura, altura, conteudo, imagens }) =>
  capaDeDestaque(ctx, largura, altura, conteudo, 'indice', imagens.icone ?? null);

export const DESENHISTAS_DE_STORY: Record<string, Desenhista> = {
  '5a': desenhar5A,
  '5b': desenhar5B,
  '5c': desenhar5C,
  '5d': desenhar5D,
  '5e1': desenhar5E1,
  '5e2': desenhar5E2,
  '5e3': desenhar5E3,
};
