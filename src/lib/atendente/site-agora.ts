// Confere na hora se o site do lead abre. Só no servidor.
//
// A marca "fora do ar" vem da checagem feita na captação, às vezes semanas
// antes, e uma falha passageira (tempo esgotado, rede instável) também virava
// "fora". Em 28/10/2026 a Lia disse a um lead que o site estava fora do ar e
// ele estava no ar. Por isso, antes de a IA falar disso, conferimos de novo.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

/** true se o site respondeu (qualquer código HTTP, ou só o certificado com problema). */
export async function siteAbreAgora(url: string): Promise<boolean> {
  const alvo = /^https?:\/\//i.test(url) ? url : `http://${url}`;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const r = await fetch(alvo, { redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': UA } });
      await r.body?.cancel();
      // Respondeu, mesmo que com 403/503 de proteção anti-robô: o site existe.
      return true;
    } catch (e) {
      // Certificado inválido: no navegador abre com aviso. Não é "fora do ar".
      const codigo = String((e as { cause?: { code?: string } }).cause?.code ?? '');
      if (/CERT|TLS|SSL|SELF_SIGNED|UNABLE_TO_VERIFY|HOSTNAME/i.test(codigo)) return true;
    }
  }
  return false;
}
