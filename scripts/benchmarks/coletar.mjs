// Coleta única dos resultados de benchmark do Bench Promos (robots.txt permite /benchmarks).
// Uma página por vez, com pausa de 1 s. Salva tudo num JSON (backup + base do casamento de produtos).
import fs from 'node:fs';

const saida = process.argv[2];
const UA = 'Mozilla/5.0 (compatible; ProgImports-catalogo/1.0)';
const sitemap = await (await fetch('https://benchpromos.com.br/sitemap.xml', { headers: { 'User-Agent': UA } })).text();
// No sitemap os testes aparecem como https://benchpromos.com.br/<slug> (um segmento só, que não é categoria)
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname.split('/').filter(Boolean));
const contagem = new Map(); for (const p of locs) contagem.set(p[0], (contagem.get(p[0]) || 0) + 1);
const slugs = [...new Set(locs.filter((p) => p.length === 1 && contagem.get(p[0]) === 1 && p[0] !== 'benchmarks').map((p) => p[0]))];
const urls = slugs.map((s) => `https://benchpromos.com.br/benchmarks/${s}`);
console.log('páginas de teste:', urls.length);

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const todos = [];
for (const [i, url] of urls.entries()) {
  try {
    const html = await (await fetch(url, { headers: { 'User-Agent': UA } })).text();
    // Os dados vêm no payload do Next.js, com aspas escapadas: desfaz o escape e pega cada "results":[...]
    // Cada pedaço vem como self.__next_f.push([1,"<texto em string JS>"]): decodifica de verdade com JSON.parse
    const bruto = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)].map((m) => JSON.parse(m[1])).join('');
    const slug = url.split('/').pop();
    let n = 0;
    // A lista termina em ...,"lowerIsBetter":false}}] (fim do benchmark, do resultado e da lista)
    for (const m of bruto.matchAll(/"results":(\[\{"__typename":"BenchmarkResult".*?"lowerIsBetter":(?:true|false)\}\}\])/g)) {
      let lista;
      try { lista = JSON.parse(m[1]); } catch (e) { console.log('  falha ao ler um bloco:', e.message.slice(0, 80)); continue; }
      for (const r of lista) {
        if (r.hidden) continue;
        todos.push({
          benchmark: r.benchmark?.slug || slug, nome: r.benchmark?.name, menorMelhor: !!r.benchmark?.lowerIsBetter,
          resultado: r.result, unidade: r.unit, descricao: (r.description || '').trim(), testado: r.productAlias,
          produtos: (r.products || []).map((p) => ({ nome: p.name, slug: p.slug })), id: r.id,
        });
        n++;
      }
    }
    console.log(`${i + 1}/${urls.length} ${slug}: ${n}`);
  } catch (e) { console.log(`${i + 1}/${urls.length} ERRO ${url} ${e.message}`); }
  await espera(1000);
}
// Um mesmo resultado pode aparecer repetido no payload: remove duplicados pelo id
const unicos = [...new Map(todos.map((r) => [r.id + r.benchmark, r])).values()];
fs.writeFileSync(saida, JSON.stringify({ fonte: 'https://benchpromos.com.br/benchmarks', coletadoEm: new Date().toISOString(), resultados: unicos }, null, 1));
console.log('resultados:', unicos.length, 'configurações testadas:', new Set(unicos.map((r) => r.testado)).size);
