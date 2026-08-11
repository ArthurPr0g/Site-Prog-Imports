// Base do SEO: endereço do site, títulos e descrições padrão.
//
// Tudo que muda de loja para loja sai de variável de ambiente, como já faz
// `lib/brand.ts` — uma loja nova é configuração, não fork.
//
// Nada aqui inventa dado de negócio. Telefone, Instagram e nome vêm de
// `constants.ts` e `brand.ts`, que já são preenchidos pelo dono. O que ele
// ainda não informou (CNPJ, endereço físico, horário) fica de fora do JSON-LD
// em vez de ser preenchido com suposição: dado errado em `Organization` é pior
// que dado ausente, porque o Google passa a confiar nele.

import { BRAND } from '@/lib/brand';

/** Endereço público do site, sem barra no fim.
 *
 *  Precisa ser absoluto: `metadataBase`, canonical, sitemap e Open Graph não
 *  aceitam caminho relativo — link de compartilhamento com URL relativa
 *  simplesmente não abre. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://prog-imports.com'
).replace(/\/$/, '');

export const SITE_NAME = BRAND.name;

/** Descrição padrão. Serve de fallback para páginas sem texto próprio. */
export const SITE_DESCRIPTION =
  process.env.NEXT_PUBLIC_BRAND_DESCRIPTION ||
  'Importação de tecnologia premium direto dos Estados Unidos. MacBooks, iPhones, notebooks gamer e mais, com garantia e atendimento personalizado.';

/** URL absoluta a partir de um caminho do site. */
export function urlAbsoluta(caminho: string): string {
  return `${SITE_URL}${caminho.startsWith('/') ? caminho : `/${caminho}`}`;
}

/** Corta a descrição no limite que o Google costuma exibir, sem partir palavra.
 *
 *  Descrição maior não é penalizada, mas é truncada com reticências pelo
 *  buscador — e o corte cai onde ele quiser, às vezes no meio da frase que
 *  convence. */
export function descricaoCurta(texto: string, limite = 155): string {
  const limpo = texto.replace(/\s+/g, ' ').trim();
  if (limpo.length <= limite) return limpo;
  const cortado = limpo.slice(0, limite);
  const ultimoEspaco = cortado.lastIndexOf(' ');
  return `${cortado.slice(0, ultimoEspaco > 60 ? ultimoEspaco : limite).trim()}…`;
}

/** Imagem padrão de compartilhamento. A logo é o que existe hoje no projeto;
 *  quando o dono fornecer uma arte 1200 × 630, é só trocar o caminho. */
export const OG_IMAGE_PADRAO = {
  url: urlAbsoluta('/images/logo.png'),
  width: 1200,
  height: 630,
  alt: SITE_NAME,
};
