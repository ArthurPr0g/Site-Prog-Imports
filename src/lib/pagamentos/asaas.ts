// Asaas (cobranças da Prog Soluções). Só no servidor.
//
// Conferido na documentação oficial em 28/10/2026 (docs.asaas.com):
// - chave no cabeçalho `access_token`; sandbox em api-sandbox.asaas.com, produção em api.asaas.com;
// - POST /v3/customers exige name e cpfCnpj;
// - POST /v3/payments exige customer, billingType, value e dueDate (AAAA-MM-DD);
//   billingType UNDEFINED deixa o cliente escolher Pix, boleto ou cartão na fatura (invoiceUrl);
// - o webhook manda o authToken no cabeçalho `asaas-access-token`.
// ASAAS_AMBIENTE = sandbox | producao (padrão sandbox: nada de dinheiro de verdade por engano).

const AMBIENTE = process.env.ASAAS_AMBIENTE === 'producao' ? 'producao' : 'sandbox';
const BASE = AMBIENTE === 'producao' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';

export const asaasConfigurado = () => !!process.env.ASAAS_API_KEY;
export const ambienteAsaas = () => AMBIENTE;

type ErroAsaas = { errors?: { code?: string; description?: string }[] };

async function chamar<T>(caminho: string, init?: { method?: string; corpo?: unknown }): Promise<{ ok: true; dados: T } | { ok: false; erro: string }> {
  const chave = process.env.ASAAS_API_KEY;
  if (!chave) return { ok: false, erro: 'Asaas não configurado (ASAAS_API_KEY).' };
  try {
    const r = await fetch(`${BASE}${caminho}`, {
      method: init?.method ?? 'GET',
      headers: { access_token: chave, 'Content-Type': 'application/json', 'User-Agent': 'prog-imports' },
      body: init?.corpo === undefined ? undefined : JSON.stringify(init.corpo),
      signal: AbortSignal.timeout(20000),
    });
    const j = (await r.json().catch(() => ({}))) as T & ErroAsaas;
    if (!r.ok) return { ok: false, erro: j.errors?.map((e) => e.description).join('; ') || `HTTP ${r.status}` };
    return { ok: true, dados: j };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'falha de rede' };
  }
}

/** Só os dígitos; CPF tem 11 e CNPJ 14. */
export function documentoValido(doc: string): string | null {
  const d = doc.replace(/\D/g, '');
  return d.length === 11 || d.length === 14 ? d : null;
}

export async function criarCliente(c: {
  nome: string;
  documento: string;
  email?: string | null;
  celular?: string | null;
  referencia: string;
}) {
  return chamar<{ id: string }>('/customers', {
    method: 'POST',
    corpo: {
      name: c.nome,
      cpfCnpj: c.documento,
      ...(c.email ? { email: c.email } : {}),
      ...(c.celular ? { mobilePhone: c.celular } : {}),
      externalReference: c.referencia,
    },
  });
}

export async function criarCobranca(c: {
  cliente: string;
  valor: number;
  vencimento: string;
  descricao: string;
  referencia: string;
}) {
  return chamar<{ id: string; invoiceUrl: string; status: string }>('/payments', {
    method: 'POST',
    corpo: {
      customer: c.cliente,
      billingType: 'UNDEFINED',
      value: Math.round(c.valor * 100) / 100,
      dueDate: c.vencimento,
      description: c.descricao.slice(0, 500),
      externalReference: c.referencia,
    },
  });
}

/** Data de hoje + n dias, em Brasília, no formato do Asaas (AAAA-MM-DD). */
export function daquiA(dias: number): string {
  const d = new Date(Date.now() - 3 * 3600_000 + dias * 24 * 3600_000);
  return d.toISOString().slice(0, 10);
}
