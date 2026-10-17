// Gera o SQL da aba "Desempenho" a partir da coleta do Bench Promos e dos casamentos revisados.
// Uso: node scripts/benchmarks/gerar-sql.mjs <coleta.json> > saida.sql
//
// Para cada produto casado: apaga os resultados antigos DELE (where product_id = ...) e insere
// os atuais, com a colocação de cada resultado entre todos os notebooks testados.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const coleta = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const casamentos = JSON.parse(fs.readFileSync(fileURLToPath(new URL('./casamentos.json', import.meta.url)), 'utf8'));
const data = coleta.coletadoEm.slice(0, 10);
const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const limpa = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// Colocação: dentro de cada teste, quantas configurações foram melhores (respeitando "menor é melhor")
const porTeste = new Map();
for (const r of coleta.resultados) {
  if (!porTeste.has(r.benchmark)) porTeste.set(r.benchmark, []);
  porTeste.get(r.benchmark).push(r);
}
function colocacao(r) {
  const lista = porTeste.get(r.benchmark);
  const melhores = lista.filter((x) => (r.menorMelhor ? x.resultado < r.resultado : x.resultado > r.resultado)).length;
  return [melhores + 1, lista.length];
}
function grupoDe(r) {
  if (/^fps$/i.test(r.unidade)) return 'jogo';
  if (/^autonomia/i.test(r.nome)) return 'bateria';
  if (/ru[ií]do/i.test(r.nome)) return 'ruido';
  return 'programa';
}
function separa(nome) {
  const partes = limpa(nome).replace(/\(menor é melhor\)/i, '').split(/\s+-\s+/).map(limpa).filter(Boolean);
  return [partes[0], partes.slice(1).join(' · ') || null];
}

const linhas = [];
for (const [sku, c] of Object.entries(casamentos)) {
  if (sku.startsWith('_')) continue;
  const resultados = coleta.resultados.filter((r) => c.testados.includes(r.testado));
  // Mesmo teste repetido para a mesma máquina: fica o que não tem observação especial (ou o primeiro)
  const unicos = new Map();
  for (const r of resultados) { const atual = unicos.get(r.benchmark); if (!atual || (atual.descricao && !r.descricao)) unicos.set(r.benchmark, r); }
  const ordenados = [...unicos.values()].sort((a, b) => grupoDe(a).localeCompare(grupoDe(b)) || a.nome.localeCompare(b.nome));
  linhas.push(`-- ${c.produto}: ${ordenados.length} resultados`);
  linhas.push(`delete from public.product_benchmarks where product_id = (select id from public.products where sku = ${q(sku)});`);
  ordenados.forEach((r, i) => {
    const [teste, ajuste] = separa(r.nome);
    const [pos, total] = colocacao(r);
    const condicao = limpa(r.descricao.replace(/\(Descontinuado\)/gi, '')) || null;
    linhas.push(`insert into public.product_benchmarks (product_id, grupo, teste, ajuste, resultado, unidade, menor_melhor, posicao_ranking, total_ranking, config_testada, condicao, fonte_url, coletado_em, ordem) select id, ${q(grupoDe(r))}, ${q(teste)}, ${q(ajuste)}, ${r.resultado}, ${q(r.unidade)}, ${r.menorMelhor}, ${pos}, ${total}, ${q(r.testado)}, ${q(condicao)}, ${q('https://benchpromos.com.br/benchmarks/' + r.benchmark)}, ${q(data)}, ${i} from public.products where sku = ${q(sku)};`);
  });
}
process.stdout.write(linhas.join('\n') + '\n');
