export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Converte texto digitado em número, aceitando formato brasileiro e o padrão
 *  com ponto decimal.
 *
 *  A versão anterior tratava TODO ponto como separador de milhar. Isso quebrou
 *  em produção quando a busca automática preencheu a cotação com "5.1664": o
 *  valor virou 51664 e foi salvo como câmbio. O dado era plausível o bastante
 *  para passar despercebido numa conferência rápida.
 *
 *  Regras, nesta ordem:
 *  1. Tem vírgula → vírgula é decimal e pontos são milhar ("4.200,50").
 *  2. Sem vírgula, mas no padrão de milhar ("4.200", "1.234.567") → milhar.
 *  3. Caso contrário → ponto é decimal ("5.1664", "4200.50"). */
export function parseNumeroBR(texto: string): number {
  const limpo = (texto ?? '').trim();
  if (!limpo) return 0;

  let normalizado: string;
  if (limpo.includes(',')) {
    normalizado = limpo.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(limpo)) {
    normalizado = limpo.replace(/\./g, '');
  } else {
    normalizado = limpo;
  }

  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
}

export function formatParcel(value: number): string {
  return formatBRL(value / 12);
}

export function formatDateBR(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR');
}

export function formatDateTimeBR(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.toLocaleDateString('pt-BR')} · ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}
