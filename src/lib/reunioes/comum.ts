// Sala de reunião (Fase 1, 31/10/2026): o que o navegador e o servidor dividem. Sem nada só do servidor aqui.

/**
 * Aviso de gravação (LGPD) mostrado ao cliente antes de entrar. Fica SÓ aqui: o Arthur ainda vai aprovar o texto,
 * e a página do cliente e o registro do consentimento usam esta mesma constante.
 */
export const AVISO_DE_GRAVACAO =
  'Esta reunião com a Prog Soluções será gravada e transcrita para registrar o que combinarmos sobre o seu projeto. A gravação fica guardada com segurança e só é usada para isso. Ao entrar, você concorda com a gravação.';

/** Limites dos minutos da Daily, ajustáveis em Gastos › Configurações (guardados em ia_config.custos). */
export type LimitesDasReunioes = {
  /** Minutos de participante grátis por mês no plano da Daily. */
  reunioes_minutos_gratis: number;
  reunioes_aviso1_pct: number;
  reunioes_aviso2_pct: number;
  /** A partir daqui não cria sala nova na Daily no mês: a reunião vai pelo Meet. */
  reunioes_trava_pct: number;
  /** Preço do minuto de participante acima do grátis (Daily, vídeo: US$ 0,004, conferido em 31/10/2026). */
  reunioes_usd_minuto: number;
  /** Duração máxima de cada pessoa na sala (a Daily tira quem passar) e folga da sala depois do horário. */
  reunioes_duracao_max_min: number;
};

export const LIMITES_PADRAO: LimitesDasReunioes = {
  reunioes_minutos_gratis: 10000,
  reunioes_aviso1_pct: 70,
  reunioes_aviso2_pct: 90,
  reunioes_trava_pct: 95,
  reunioes_usd_minuto: 0.004,
  reunioes_duracao_max_min: 120,
};

export function limitesDe(bruto: unknown): LimitesDasReunioes {
  const c = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>;
  const num = (k: keyof LimitesDasReunioes, min: number, max: number) => {
    const n = Number(c[k]);
    return Number.isFinite(n) && c[k] !== null && c[k] !== '' ? Math.min(max, Math.max(min, n)) : LIMITES_PADRAO[k];
  };
  return {
    reunioes_minutos_gratis: Math.round(num('reunioes_minutos_gratis', 0, 1_000_000)),
    reunioes_aviso1_pct: num('reunioes_aviso1_pct', 1, 100),
    reunioes_aviso2_pct: num('reunioes_aviso2_pct', 1, 100),
    reunioes_trava_pct: num('reunioes_trava_pct', 1, 100),
    reunioes_usd_minuto: num('reunioes_usd_minuto', 0, 1),
    reunioes_duracao_max_min: Math.round(num('reunioes_duracao_max_min', 15, 480)),
  };
}

export type Trecho = { quem: 'arthur' | 'cliente'; t: number; texto: string };

/** Transcrição corrida, na ordem do tempo, com quem falou. */
export function transcricaoEmTexto(trechos: Trecho[]): string {
  return [...trechos]
    .sort((a, b) => a.t - b.t)
    .map((x) => `[${mmss(x.t)}] ${x.quem === 'arthur' ? 'Arthur' : 'Cliente'}: ${x.texto}`)
    .join('\n');
}

export const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Nome de arquivo sem caracteres que o Windows recusa. */
export const nomeDeArquivo = (s: string) => s.replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);

/** "AAAA-MM-DD HHhMM" no horário de Brasília (Goiânia, UTC−3 o ano todo). */
export function dataDoArquivo(d: Date): string {
  const l = new Date(d.getTime() - 3 * 3600_000).toISOString();
  return `${l.slice(0, 10)} ${l.slice(11, 13)}h${l.slice(14, 16)}`;
}
