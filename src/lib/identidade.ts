// A identidade da marca, em um lugar só.
//
// Fonte da verdade: o Playbook Instagram v1.0 (out/2026). O mesmo arquivo serve
// a loja e às peças do Estúdio — a loja lê daqui por custom property no `<html>`
// e o canvas lê daqui direto. Era o único jeito de impedir que os dois
// divergissem: paleta duplicada não fica igual por muito tempo, e quando ela
// separa ninguém percebe, porque as duas metades continuam parecendo certas
// quando olhadas sozinhas.
//
// Para mudar uma cor da marca, mude aqui. O site e as treze peças seguem juntos.

/* ------------------------------------------------------------------ paleta */

export const PALETA = {
  /** O preto da marca. Não é #000: preto puro em tela OLED some e leva a borda
   *  do produto junto. */
  onix: '#0C0C0D',
  grafite: '#18181B',
  grafiteClaro: '#2A2A2E',

  /** O claro da marca é marfim, não branco. Branco puro sobre ônix vibra e
   *  cansa; marfim assenta e deixa o ouro parecer metal em vez de amarelo. */
  marfim: '#F2EEE7',
  papel: '#E7E1D6',
  papelBorda: '#d6cfc2',

  ouro: '#C9A15A',
  ouroClaro: '#D9B66E',
  bronze: '#8C6A2F',

  prata: '#B9B4AB',
  prataEscura: '#9C978E',
  grafiteTexto: '#6f6a62',
  tintaSecundaria: '#4a4740',
} as const;

/** Brilhos de fundo por família de produto. O playbook usa um halo colorido
 *  atrás do aparelho; a cor acompanha a identidade da marca do produto, não a
 *  da Prog — é o único lugar onde cor fora da paleta entra. */
export const HALO = {
  roxo: 'rgba(124,72,255,',
  magenta: 'rgba(176,70,255,',
  turquesa: 'rgba(54,209,196,',
  rubi: 'rgba(230,40,90,',
  ouro: 'rgba(201,161,90,',
} as const;

export type Halo = keyof typeof HALO;

/* ----------------------------------------------------------- o uso do ouro */

// A regra que o playbook repete e que é fácil de quebrar sem perceber: **o ouro
// marca valor, não interação.** Preço, selo de desconto e medalha são de ouro.
// Botão, foco, borda de hover e contador não são — eles são marfim sobre ônix,
// que é exatamente o que a peça 5A faz com o CTA.
//
// O motivo é de leitura, não de gosto: numa página inteira dourada o preço
// deixa de ser o elemento mais caro da tela e vira mais um. O ouro só vale
// enquanto é raro.

/* --------------------------------------------------- superfícies da loja */

/** Os tons que o site usa e que não existem na arte do Instagram — a loja tem
 *  estados, formulários e tabelas, que uma peça de feed não tem. Todos saem da
 *  paleta acima por aproximação, e nenhum é cor nova. */
const SUPERFICIE = {
  cartao: '#141417',
  cartaoEscuro: '#101012',
  cartaoHover: '#1C1C20',
  campo: '#0F0F11',
  campoAlt: '#17171A',
  borda: '#232327',
  bordaForte: PALETA.grafiteClaro,
  bordaHover: '#3A3A40',
  divisor: '#1A1A1D',
  divisorForte: '#212125',
} as const;

/** Variáveis injetadas no `<html>`. O `globals.css` aponta os tokens do tema
 *  para elas, então trocar a paleta não exige tocar em nenhum componente. */
export const identidadeCssVars = {
  '--prog-onix': PALETA.onix,
  '--prog-grafite': PALETA.grafite,
  '--prog-marfim': PALETA.marfim,
  '--prog-papel': PALETA.papel,
  '--prog-papel-borda': PALETA.papelBorda,
  '--prog-ouro': PALETA.ouro,
  '--prog-ouro-claro': PALETA.ouroClaro,
  '--prog-bronze': PALETA.bronze,
  '--prog-prata': PALETA.prata,
  '--prog-prata-escura': PALETA.prataEscura,
  '--prog-grafite-texto': PALETA.grafiteTexto,
  '--prog-tinta-secundaria': PALETA.tintaSecundaria,

  '--prog-cartao': SUPERFICIE.cartao,
  '--prog-cartao-escuro': SUPERFICIE.cartaoEscuro,
  '--prog-cartao-hover': SUPERFICIE.cartaoHover,
  '--prog-campo': SUPERFICIE.campo,
  '--prog-campo-alt': SUPERFICIE.campoAlt,
  '--prog-borda': SUPERFICIE.borda,
  '--prog-borda-forte': SUPERFICIE.bordaForte,
  '--prog-borda-hover': SUPERFICIE.bordaHover,
  '--prog-divisor': SUPERFICIE.divisor,
  '--prog-divisor-forte': SUPERFICIE.divisorForte,
} as React.CSSProperties;
