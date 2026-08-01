// Busca da cotação USD/BRL de mercado.
//
// Duas fontes gratuitas e sem chave, tentadas em ordem. A redundância não é
// zelo excessivo: a primeira versão usava só a AwesomeAPI e falhou em produção
// enquanto funcionava da máquina local — API pública recusa requisição de
// datacenter com mais frequência do que de rede residencial, e a cotação é a
// base de todo preço do sistema.
//
// O valor devolvido é a cotação de MERCADO, sem a taxa que a Prog paga por
// dólar. A soma acontece em `cotacaoComTaxa`, para que a taxa continue visível
// e configurável em vez de embutida silenciosamente aqui.

export type CotacaoMercado = {
  valor: number;
  /** Quando a cotação foi apurada na origem, não quando buscamos. */
  atualizadaEm: string;
  fonte: string;
};

/** Falha com motivo. Sem isso, "não deu certo" não diz se foi rede, formato ou
 *  bloqueio — e o diagnóstico vira tentativa e erro em produção. */
export type ResultadoCotacao =
  | { ok: true; cotacao: CotacaoMercado }
  | { ok: false; motivo: string };

const TIMEOUT_MS = 8000;

/** AbortController em vez de AbortSignal.timeout: o segundo depende da versão
 *  do runtime e some sem aviso, derrubando a busca inteira num ambiente onde
 *  não dá para depurar com facilidade. */
async function buscarComTimeout(url: string): Promise<Response> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      cache: 'no-store',
      signal: controle.signal,
      // Algumas APIs públicas recusam requisição sem User-Agent identificável.
      headers: { Accept: 'application/json', 'User-Agent': 'ProgImports-ERP/1.0' },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function daAwesomeApi(): Promise<CotacaoMercado | null> {
  const r = await buscarComTimeout('https://economia.awesomeapi.com.br/json/last/USD-BRL');
  if (!r.ok) return null;
  const dados = await r.json();
  const valor = Number(dados?.USDBRL?.bid);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  return { valor, atualizadaEm: dados?.USDBRL?.create_date ?? '', fonte: 'AwesomeAPI' };
}

async function daOpenErApi(): Promise<CotacaoMercado | null> {
  const r = await buscarComTimeout('https://open.er-api.com/v6/latest/USD');
  if (!r.ok) return null;
  const dados = await r.json();
  const valor = Number(dados?.rates?.BRL);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  return { valor, atualizadaEm: dados?.time_last_update_utc ?? '', fonte: 'open.er-api' };
}

export async function buscarCotacaoMercado(): Promise<ResultadoCotacao> {
  const motivos: string[] = [];

  for (const [nome, buscar] of [
    ['AwesomeAPI', daAwesomeApi],
    ['open.er-api', daOpenErApi],
  ] as const) {
    try {
      const cotacao = await buscar();
      if (cotacao) return { ok: true, cotacao };
      motivos.push(`${nome}: resposta sem cotação válida`);
    } catch (erro) {
      const causa = erro instanceof Error ? erro.name : 'erro desconhecido';
      motivos.push(`${nome}: ${causa}`);
    }
  }

  return { ok: false, motivo: motivos.join(' · ') };
}
