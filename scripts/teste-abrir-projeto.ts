/**
 * Teste do "projeto de graça / pago fora do Asaas abre o projeto" (30/10/2026), no banco de verdade e sem
 * deixar rastro: cria um lead e uma encomenda de teste, toca "Projeto de graça", confere o projeto no
 * Pós-venda e o pedido da Bia na fila, e apaga tudo (o pedido é apagado antes de o PC pegar).
 * O WhatsApp vai para um número inexistente (falha de propósito).
 *   npx -y tsx scripts/teste-abrir-projeto.ts
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RAIZ = resolve(__dirname, '..');
for (const l of readFileSync(join(RAIZ, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

async function main() {
  const { dbDoAtendente } = await import('../src/lib/atendente/db');
  const { decidirFinanceiro } = await import('../src/lib/atendente/encomenda');
  const db = dbDoAtendente();
  const de = '5500000000000';
  const { data: lead, error: el } = await db
    .from('leads')
    .insert({ name: 'TESTE abrir projeto (apagar)', phone: '5500000000001', source: 'teste-abrir-projeto', dedupe_key: `teste-abrir-${Date.now()}` } as never)
    .select('id')
    .single();
  if (el || !lead) throw new Error(`lead: ${el?.message}`);
  const { data: enc, error: ee } = await db
    .from('encomendas')
    .insert({ nome: 'TESTE abrir projeto', telefone: '5500000000001', lead_id: lead.id, status: 'contatado' } as never)
    .select('id')
    .single();
  let ok = false;
  try {
    if (ee || !enc) throw new Error(`encomenda: ${ee?.message}`);
    await decidirFinanceiro(db, 'pag', 'gratis', enc.id, de);
    const { data: pj } = await db.from('projetos').select('id, cliente, valor, vendido_por').eq('lead_id', lead.id).maybeSingle();
    const { data: bia } = await db.from('ideias').select('id, titulo, agente, status').eq('agente', 'bia').ilike('titulo', '%TESTE abrir projeto%');
    console.log('projeto:', pj ? `${pj.cliente} · valor ${pj.valor} · ${pj.vendido_por}` : 'NÃO CRIADO');
    console.log('Bia na fila:', bia?.length ? bia.map((b) => `${b.titulo} (${b.status})`).join('; ') : 'NÃO');
    // De novo: não pode duplicar projeto nem pedido.
    await decidirFinanceiro(db, 'pag', 'gratis', enc.id, de);
    const { count } = await db.from('ideias').select('id', { count: 'exact', head: true }).eq('agente', 'bia').ilike('titulo', '%TESTE abrir projeto%');
    console.log('pedidos da Bia depois do 2º toque:', count);
    ok = !!pj && bia?.length === 1 && count === 1;
  } finally {
    await db.from('ideias').delete().eq('agente', 'bia').ilike('titulo', '%TESTE abrir projeto%');
    const { data: pjs } = await db.from('projetos').select('id').eq('lead_id', lead.id);
    for (const p of pjs ?? []) {
      await db.from('projeto_servicos').delete().eq('projeto_id', p.id);
      await db.from('projetos').delete().eq('id', p.id);
    }
    if (enc) await db.from('encomendas').delete().eq('id', enc.id);
    await db.from('leads').delete().eq('id', lead.id);
    console.log('limpo.');
  }
  console.log(ok ? 'PASSOU' : 'FALHOU');
}
main().catch((e) => { console.error(e); process.exit(1); });
