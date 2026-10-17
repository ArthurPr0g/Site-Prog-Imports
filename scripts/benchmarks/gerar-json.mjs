// Mesmo conteúdo do gerar-sql.mjs, mas em JSON compacto (um registro por resultado), para
// carregar tudo de uma vez com jsonb_to_recordset. Uso: node gerar-json.mjs <coleta.json>
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const coleta = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const casamentos = JSON.parse(fs.readFileSync(fileURLToPath(new URL('./casamentos.json', import.meta.url)), 'utf8'));
const data = coleta.coletadoEm.slice(0, 10);
const limpa = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const porTeste = new Map();
for (const r of coleta.resultados) { if (!porTeste.has(r.benchmark)) porTeste.set(r.benchmark, []); porTeste.get(r.benchmark).push(r); }
const colocacao = (r) => { const l = porTeste.get(r.benchmark); return [l.filter((x) => (r.menorMelhor ? x.resultado < r.resultado : x.resultado > r.resultado)).length + 1, l.length]; };
const grupoDe = (r) => (/^fps$/i.test(r.unidade) ? 'jogo' : /^autonomia/i.test(r.nome) ? 'bateria' : /ru[ií]do/i.test(r.nome) ? 'ruido' : 'programa');
const separa = (nome) => { const p = limpa(nome).replace(/\(menor é melhor\)/i, '').split(/\s+-\s+/).map(limpa).filter(Boolean); return [p[0], p.slice(1).join(' · ') || null]; };

const linhas = [];
for (const [sku, c] of Object.entries(casamentos)) {
  if (sku.startsWith('_')) continue;
  const unicos = new Map();
  for (const r of coleta.resultados.filter((x) => c.testados.includes(x.testado))) { const a = unicos.get(r.benchmark); if (!a || (a.descricao && !r.descricao)) unicos.set(r.benchmark, r); }
  [...unicos.values()].sort((a, b) => grupoDe(a).localeCompare(grupoDe(b)) || a.nome.localeCompare(b.nome)).forEach((r, i) => {
    const [teste, ajuste] = separa(r.nome), [pos, total] = colocacao(r);
    linhas.push({ s: sku, g: grupoDe(r), t: teste, a: ajuste, r: r.resultado, u: r.unidade, m: r.menorMelhor, p: pos, n: total, c: r.testado, o: limpa(r.descricao.replace(/\(Descontinuado\)/gi, '')) || null, b: r.benchmark, d: data, i });
  });
}
process.stdout.write(JSON.stringify(linhas));
