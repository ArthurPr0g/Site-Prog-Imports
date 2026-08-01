// Busca da cotação USD/BRL de mercado.
//
// Usa a AwesomeAPI: gratuita, sem chave, sem cadastro. A escolha é deliberada —
// qualquer alternativa com chave viraria mais um segredo por loja para
// gerenciar, e este dado é público.
//
// O valor devolvido é a cotação de MERCADO, sem a taxa que a Prog paga por
// dólar. A soma acontece em `cotacaoComTaxa`, para que a taxa continue visível
// e configurável em vez de embutida silenciosamente aqui.

const ENDPOINT = 'https://economia.awesomeapi.com.br/json/last/USD-BRL';

export type CotacaoMercado = {
  valor: number;
  /** Quando a cotação foi apurada na origem, não quando buscamos. */
  atualizadaEm: string;
};

export async function buscarCotacaoMercado(): Promise<CotacaoMercado | null> {
  try {
    // Sem cache: cotação de ontem levaria a orçamento errado, e o custo de
    // buscar de novo é irrelevante perto disso.
    const resposta = await fetch(ENDPOINT, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!resposta.ok) return null;

    const dados = await resposta.json();
    const cotacao = dados?.USDBRL;
    const valor = Number(cotacao?.bid);

    // A API pode responder 200 com corpo inesperado. Sem esta checagem, um NaN
    // entraria como cotação e zeraria todos os orçamentos recalculados.
    if (!Number.isFinite(valor) || valor <= 0) return null;

    return { valor, atualizadaEm: cotacao?.create_date ?? '' };
  } catch {
    // Rede fora, timeout ou JSON inválido: quem chama decide o que fazer.
    // Nunca derruba a tela de configurações por causa de uma API externa.
    return null;
  }
}
