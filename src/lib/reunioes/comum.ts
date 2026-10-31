// Sala de reunião (Fase 1, 31/10/2026): o que o navegador e o servidor dividem. Sem nada só do servidor aqui.

/**
 * Aviso de gravação (LGPD) mostrado ao cliente antes de entrar. Texto aprovado pelo Arthur como está (31/10/2026).
 * A página do cliente e o registro do consentimento usam esta mesma constante.
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
  /** Pessoas por sala (Arthur incluso). Cada uma gasta os próprios minutos de participante. Fase 2: padrão 6. */
  reunioes_max_pessoas: number;
};

export const LIMITES_PADRAO: LimitesDasReunioes = {
  reunioes_minutos_gratis: 10000,
  reunioes_aviso1_pct: 70,
  reunioes_aviso2_pct: 90,
  reunioes_trava_pct: 95,
  reunioes_usd_minuto: 0.004,
  reunioes_duracao_max_min: 120,
  reunioes_max_pessoas: 6,
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
    reunioes_max_pessoas: Math.round(num('reunioes_max_pessoas', 2, 20)),
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

/* ------------------------------------------------------------ Fase 2 (31/10/2026) */

/** Segundos de energia por amostra que o navegador manda junto da fatia (uma a cada 200 ms). */
export const PASSO_DA_ENERGIA = 0.2;

/**
 * Quem falou num pedaço da fatia: o lado com mais energia somada entre `inicio` e `fim` (segundos dentro da
 * fatia). Empate ou silêncio: quem falou no pedaço anterior (ou o cliente, se for o primeiro).
 */
export function quemFalou(energia: [number, number][], inicio: number, fim: number, anterior: Trecho['quem'] | null): Trecho['quem'] {
  const de = Math.max(0, Math.floor(inicio / PASSO_DA_ENERGIA));
  const ate = Math.min(energia.length, Math.max(de + 1, Math.ceil(fim / PASSO_DA_ENERGIA)));
  let a = 0;
  let c = 0;
  for (let i = de; i < ate; i++) {
    a += energia[i]?.[0] ?? 0;
    c += energia[i]?.[1] ?? 0;
  }
  if (a === c) return anterior ?? 'cliente';
  return a > c ? 'arthur' : 'cliente';
}

/** Trechos de uma fatia: cada segmento do Whisper ganha quem falou; segmentos seguidos da mesma pessoa se juntam. */
export function trechosDaFatia(segmentos: { inicio: number; fim: number; texto: string }[], energia: [number, number][], t0: number): Trecho[] {
  const r: Trecho[] = [];
  let anterior: Trecho['quem'] | null = null;
  for (const s of segmentos) {
    const quem = quemFalou(energia, s.inicio, s.fim, anterior);
    const ultimo = r.at(-1);
    if (ultimo && ultimo.quem === quem) ultimo.texto = `${ultimo.texto} ${s.texto}`.trim();
    else r.push({ quem, t: Math.round(t0 + s.inicio), texto: s.texto });
    anterior = quem;
  }
  return r.map((x) => ({ ...x, texto: x.texto.slice(0, 4000) }));
}

/** Balão do copiloto (só o Arthur vê). chave = o que torna o balão único (não repete). */
export type TipoDeBalao = 'pacote' | 'objecao' | 'case' | 'pergunta' | 'resumo';
export type Balao = {
  id: string;
  tipo: TipoDeBalao;
  chave: string;
  titulo: string;
  texto: string;
  link?: string | null;
  /** Para o botão do balão (pacote → proposta; case → mandar o link). */
  ref?: Record<string, unknown> | null;
  em: string;
  dispensado?: boolean;
};

/** Depois disso o balão some da coluna (o resumo fica sempre). Em minutos. */
export const VIDA_DO_BALAO: Record<TipoDeBalao, number> = { pacote: 8, objecao: 5, case: 8, pergunta: 6, resumo: Number.POSITIVE_INFINITY };

export const baloesVivos = (lista: Balao[], agora = Date.now()) =>
  lista.filter((b) => !b.dispensado && agora - Date.parse(b.em) < VIDA_DO_BALAO[b.tipo] * 60_000);

/** Registro das ações tomadas na sala (botões da coluna Ações). */
export type AcaoDaSala = { em: string; tipo: string; texto: string; ok: boolean };

// Frases que o Whisper inventa em silêncio ou ruído (conhecidas em português).
export const ALUCINACAO =
  /^(legendas? (pela|por) .*|legendado por .*|obrigad[oa]( por assistir)?[.!]*|tchau[.!]*|\.+|inscreva-se.*|amara\.org.*|transcrição .*|música|\[música\]|\(música\))$/i;

/** Energia mandada pelo navegador: [[arthur, cliente], ...] com 0–100. Lixo vira lista vazia. */
export function lerEnergia(bruto: unknown): [number, number][] {
  try {
    const j = typeof bruto === 'string' ? JSON.parse(bruto) : bruto;
    if (!Array.isArray(j)) return [];
    return j.slice(0, 600).map((x) => [Math.max(0, Math.min(100, Number(x?.[0]) || 0)), Math.max(0, Math.min(100, Number(x?.[1]) || 0))] as [number, number]);
  } catch {
    return [];
  }
}

/**
 * Trechos de uma fatia transcrita (ao vivo ou no fim, com os pendentes). Com as palavras e o tempo de cada uma,
 * quem falou é decidido palavra a palavra (energia de 0,3 s em volta) e trocas de 1 palavra só são ignoradas
 * (ruído); sem palavras, vale segmento a segmento.
 */
export function trechosTranscritos(
  res: { texto: string; segmentos: { inicio: number; fim: number; texto: string }[]; palavras?: { inicio: number; fim: number; texto: string }[] },
  energia: [number, number][],
  t: number,
  quemFixo: Trecho['quem'] | null,
): Trecho[] {
  const segmentos = res.segmentos.filter((s) => !ALUCINACAO.test(s.texto));
  if (quemFixo && !energia.length)
    return segmentos.length ? [{ quem: quemFixo, t: Math.round(t), texto: segmentos.map((s) => s.texto).join(' ').slice(0, 4000) }] : [];
  const palavras = res.palavras ?? [];
  if (palavras.length && energia.length && segmentos.length) {
    let anterior: Trecho['quem'] | null = null;
    const corridas: { quem: Trecho['quem']; inicio: number; fim: number; palavras: string[] }[] = [];
    for (const w of palavras) {
      const quem = quemFalou(energia, Math.max(0, w.inicio - 0.3), w.fim + 0.3, anterior);
      anterior = quem;
      const u = corridas.at(-1);
      if (u && u.quem === quem) {
        u.palavras.push(w.texto);
        u.fim = w.fim;
      } else corridas.push({ quem, inicio: w.inicio, fim: w.fim, palavras: [w.texto] });
    }
    // Troca de uma palavra só no meio da fala de alguém: fica com quem estava falando.
    const limpas: typeof corridas = [];
    for (const c of corridas) {
      const u = limpas.at(-1);
      if (u && (c.palavras.length < 2 || u.quem === c.quem)) {
        u.palavras.push(...c.palavras);
        u.fim = c.fim;
      } else limpas.push({ ...c, palavras: [...c.palavras] });
    }
    return limpas
      .map((c) => ({ quem: c.quem, t: Math.round(t + c.inicio), texto: c.palavras.join(' ').replace(/\s+([,.!?;:])/g, '$1').slice(0, 4000) }))
      .filter((x) => x.texto && !ALUCINACAO.test(x.texto));
  }
  const r = trechosDaFatia(segmentos, energia, t);
  // Sem segmentos (alguns provedores não mandam): o texto todo, do lado com mais energia.
  if (!r.length && res.texto && !ALUCINACAO.test(res.texto)) return trechosDaFatia([{ inicio: 0, fim: 15, texto: res.texto }], energia, t);
  return r;
}
