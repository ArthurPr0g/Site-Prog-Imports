// Metadados dos links da Prog Soluções que moram no domínio da loja (diagnóstico,
// vendedor, painel da Captação/Pós-venda): prévia própria (imagem, título,
// descrição) em vez da Prog Imports, e sempre fora dos buscadores (páginas
// privadas). A loja continua com os metadados dela (pedido do dono, 28/10/2026).

import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo';

export function metadadosProgSolucoes(o: {
  titulo: string;
  descricao: string;
  /** Título grande da imagem (padrão: o título). */
  tituloDaImagem?: string;
  subtituloDaImagem?: string;
  ingles?: boolean;
}): Metadata {
  const q = new URLSearchParams({
    t: o.tituloDaImagem ?? o.titulo,
    s: o.subtituloDaImagem ?? 'Prog Soluções · Goiânia',
    ...(o.ingles ? { l: 'en' } : {}),
  });
  const imagem = { url: `${SITE_URL}/og/prog-solucoes?${q}`, width: 1200, height: 630, alt: o.titulo };
  return {
    title: { absolute: o.titulo },
    description: o.descricao,
    applicationName: 'Prog Soluções',
    openGraph: {
      type: 'website',
      locale: o.ingles ? 'en_US' : 'pt_BR',
      siteName: 'Prog Soluções',
      title: o.titulo,
      description: o.descricao,
      images: [imagem],
    },
    twitter: { card: 'summary_large_image', title: o.titulo, description: o.descricao, images: [imagem.url] },
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  };
}
