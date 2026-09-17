// Sobe as fotos de um produto para o Supabase, do mesmo jeito que o admin faz:
// arquivo no bucket product-images sob a pasta do produto, linha em
// product_images com label = nome do produto e position em sequência.
//
// Uso: node subir-fotos.mjs <SKU> <pasta-com-as-fotos>
//
// A chave secreta vem do .env.local do projeto e nunca é impressa.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const PROJETO = 'C:/Apps/1 - Dev/Prog Soluções/Prog Imports/site-prog-imports';
const BUCKET = 'product-images';
const MAX_POR_PRODUTO = 8;
const MAX_BYTES = 5 * 1024 * 1024;

const [sku, pasta, modo] = process.argv.slice(2);
if (!sku || !pasta) {
  console.error('Uso: node subir-fotos.mjs <SKU> <pasta> [--substituir]');
  process.exit(1);
}
const substituir = modo === '--substituir';

const env = Object.fromEntries(
  readFileSync(path.join(PROJETO, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const { data: produto, error: erroProduto } = await supabase
  .from('products')
  .select('id, name')
  .eq('sku', sku)
  .maybeSingle();

if (erroProduto || !produto) {
  console.error('Produto não encontrado para o SKU', sku, erroProduto?.message ?? '');
  process.exit(1);
}
console.log(`Produto: ${produto.name}`);

const { data: existentes } = await supabase
  .from('product_images')
  .select('id, url, position')
  .eq('product_id', produto.id)
  .order('position');

// Linhas sem url são o placeholder listrado do site. Elas só ocupam lugar na
// galeria depois que existe foto de verdade.
const placeholders = (existentes ?? []).filter((i) => !i.url);
if (placeholders.length) {
  await supabase.from('product_images').delete().in('id', placeholders.map((i) => i.id));
  console.log(`${placeholders.length} placeholder(s) removido(s).`);
}

// Troca do conjunto inteiro: apaga a linha E o arquivo no bucket, senão o
// storage vira depósito de imagem órfã a cada nova tentativa.
if (substituir) {
  const antigas = (existentes ?? []).filter((i) => i.url);
  if (antigas.length) {
    const caminhos = antigas
      .map((i) => i.url.split(`/${BUCKET}/`)[1])
      .filter(Boolean)
      .map((c) => decodeURIComponent(c));
    if (caminhos.length) await supabase.storage.from(BUCKET).remove(caminhos);
    await supabase.from('product_images').delete().in('id', antigas.map((i) => i.id));
    console.log(`${antigas.length} foto(s) anterior(es) removida(s) do banco e do bucket.`);
    existentes.length = 0;
  }
}

const reais = substituir ? [] : (existentes ?? []).filter((i) => i.url);
const arquivos = readdirSync(pasta)
  .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
  .sort();

if (reais.length + arquivos.length > MAX_POR_PRODUTO) {
  console.error(`O produto já tem ${reais.length} foto(s); o limite do site é ${MAX_POR_PRODUTO}.`);
  process.exit(1);
}

const tipos = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
let posicao = reais.length ? Math.max(...reais.map((i) => i.position)) + 1 : 0;

for (const arquivo of arquivos) {
  const completo = path.join(pasta, arquivo);
  const bytes = readFileSync(completo);
  if (bytes.length > MAX_BYTES) {
    console.error(`${arquivo}: ${Math.round(bytes.length / 1024)} KB passa do limite de 5 MB do site. Pulando.`);
    continue;
  }

  const ext = path.extname(arquivo).toLowerCase();
  const destino = `${produto.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

  const { error: erroUpload } = await supabase.storage
    .from(BUCKET)
    .upload(destino, bytes, { contentType: tipos[ext] ?? 'image/jpeg', upsert: false });
  if (erroUpload) {
    console.error(`${arquivo}: falha no upload — ${erroUpload.message}`);
    continue;
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(destino);

  const { error: erroLinha } = await supabase.from('product_images').insert({
    product_id: produto.id,
    label: produto.name.toLowerCase(),
    url: pub.publicUrl,
    position: posicao,
  });

  if (erroLinha) {
    // Sem a linha, o arquivo vira lixo no bucket: desfaz para não acumular.
    await supabase.storage.from(BUCKET).remove([destino]);
    console.error(`${arquivo}: falha ao gravar a linha — ${erroLinha.message}`);
    continue;
  }

  console.log(`${arquivo} -> posição ${posicao} (${Math.round(bytes.length / 1024)} KB)`);
  posicao++;
}

const { count } = await supabase
  .from('product_images')
  .select('id', { count: 'exact', head: true })
  .eq('product_id', produto.id);
console.log(`\nTotal de imagens no produto: ${count}`);
