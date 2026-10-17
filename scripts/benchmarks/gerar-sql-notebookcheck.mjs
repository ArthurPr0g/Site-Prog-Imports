// Gera o SQL dos testes do Notebookcheck (scripts/benchmarks/notebookcheck.json).
// Uso: node scripts/benchmarks/gerar-sql-notebookcheck.mjs > saida.sql
//
// Apaga só as linhas do Notebookcheck de cada produto (as do Bench Promos ficam) e insere as atuais.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const dados = JSON.parse(fs.readFileSync(fileURLToPath(new URL('./notebookcheck.json', import.meta.url)), 'utf8'));
const DATA = '2026-10-17';
const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);

const linhas = [];
for (const a of dados.analises) {
  const itens = [
    ...a.bateria.map(([ajuste, min]) => ['bateria', 'Autonomia de bateria', ajuste, min, 'Minutos', false]),
    ...a.jogos.map(([jogo, ajuste, fps]) => ['jogo', jogo, ajuste, fps, 'FPS', false]),
    ...a.programas.map(([teste, ajuste, v, un, menor]) => ['programa', teste, ajuste, v, un, menor]),
    ...a.ruido.map(([teste, ajuste, db]) => ['ruido', teste, ajuste, db, 'dB', true]),
  ];
  const skus = a.skus.map(q).join(', ');
  linhas.push(`-- ${a.skus.join(' + ')}: ${itens.length} resultados cada (${a.config})`);
  linhas.push(`delete from public.product_benchmarks where fonte = 'Notebookcheck' and product_id in (select id from public.products where sku in (${skus}));`);
  const valores = itens.map(([grupo, teste, ajuste, v, un, menor], i) => `(${q(grupo)}, ${q(teste)}, ${q(ajuste)}, ${v}, ${q(un)}, ${menor}, ${i})`);
  linhas.push(`insert into public.product_benchmarks (product_id, grupo, teste, ajuste, resultado, unidade, menor_melhor, ordem, config_testada, condicao, fonte, fonte_url, coletado_em)
select p.id, v.grupo, v.teste, v.ajuste, v.resultado, v.unidade, v.menor_melhor, v.ordem, ${q(a.config)}, ${q(a.condicao)}, 'Notebookcheck', ${q(a.url)}, ${q(DATA)}
from public.products p cross join (values
  ${valores.join(',\n  ')}
) as v(grupo, teste, ajuste, resultado, unidade, menor_melhor, ordem)
where p.sku in (${skus});`);
}
process.stdout.write(linhas.join('\n') + '\n');
