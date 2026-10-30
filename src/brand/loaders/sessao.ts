// Constantes do splash fora do módulo 'use client': o layout do admin (server)
// precisa do valor de verdade, não de uma referência de cliente.

/** Chave da sessão: a construção do símbolo roda só no primeiro acesso. */
export const CHAVE_SPLASH = 'ps-splash-visto';
/** Classe do overlay real (não o da prévia): o script do layout do admin
 *  esconde essa classe antes de qualquer pintura quando o splash já rodou. */
export const CLASSE_SPLASH_VISTO = 'ps-splash-sessao';
