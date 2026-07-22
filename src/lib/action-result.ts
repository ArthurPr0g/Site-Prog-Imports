export type ActionResult = { ok: boolean; message: string };

export const okResult = (message = ''): ActionResult => ({ ok: true, message });
export const errResult = (message: string): ActionResult => ({ ok: false, message });

/** Maps common Postgres/PostgREST error codes to friendly pt-BR messages. */
export function friendlyDbError(error: { code?: string; message?: string } | null, fallback: string): string {
  if (!error) return fallback;
  if (error.code === '23505') return 'Já existe um registro com esse valor único (nome/código/SKU duplicado).';
  if (error.code === '23503') return 'Não é possível concluir: há outros registros que dependem deste item.';
  if (error.code === '42501' || error.code === 'PGRST301') return 'Você não tem permissão para fazer isso.';
  return fallback;
}
