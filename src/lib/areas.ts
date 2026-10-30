// Áreas do painel (separação pedida pelo dono em 30/10/2026: "separar visualmente a loja de importados
// da prestação de serviço"). As rotas continuam sob /admin (mesmo login e permissões); o que muda é o
// menu, a marca e as cores de cada área.

/** Telas da Prog Soluções (serviços: sites, sistemas, marca). O resto do /admin é a gestão da loja. */
export const ROTAS_DA_PROG_SOLUCOES = [
  '/admin/captacao',
  '/admin/pos-venda',
  '/admin/gastos',
  '/admin/prestacao-servico',
  '/admin/orcamentos-servicos',
  '/admin/servicos-internos',
] as const;

export const ehDaProgSolucoes = (pathname: string) =>
  ROTAS_DA_PROG_SOLUCOES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
