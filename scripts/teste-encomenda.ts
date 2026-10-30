/**
 * Ensaio do "Lia, faça todo o projeto" (30/10/2026), antes do piloto real do Felipe.
 * Cliente fictício e WhatsApp desligado (WHATSAPP_TOKEN vazio): nada sai para ninguém. Usa o banco de
 * produção e a API da Anthropic (custa centavos). No fim apaga tudo o que criou.
 *
 *   WHATSAPP_TOKEN= npx -y tsx scripts/teste-encomenda.ts
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RAIZ = resolve(__dirname, '..');
for (const l of readFileSync(join(RAIZ, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
process.env.WHATSAPP_TOKEN = '';

const DONO = '5500000000001'; // número fictício: as respostas ao "Arthur" falham sem sair
const CLIENTE = '5562900000042';

async function main() {
  const { dbDoAtendente } = await import('../src/lib/atendente/db');
  const { tratarEncomenda, decidirEncomenda, decidirFinanceiro } = await import('../src/lib/atendente/encomenda');
  const { responderConversa } = await import('../src/lib/atendente/agente');
  const { pesquisarProximo } = await import('../src/lib/atendente/pesquisa');
  const { lerConfig } = await import('../src/lib/atendente/agente');
  const db = dbDoAtendente();
  const criados: { enc?: string; lead?: string; conv?: string } = {};
  const ultima = async () => (await db.from('encomendas').select('*').order('criado_em', { ascending: false }).limit(1).single()).data!;
  const passo = (t: string) => console.log(`\n=== ${t}`);

  try {
    passo('1. contato');
    await tratarEncomenda(db, DONO, `[o cliente mandou um contato: Piloto Teste Personal +55 62 90000-0042]`);
    let e = await ultima();
    criados.enc = e.id;
    console.log(e.status, e.nome, e.telefone);

    passo('2. pedido (áudio transcrito)');
    await tratarEncomenda(
      db,
      DONO,
      'Lia, faça todo o projeto dele. É personal trainer em Goiânia e quer um site com um sistema de gerenciamento dos alunos: cadastro, treinos, pagamentos e evolução. Ele já sabe que você vai chamar.',
    );
    e = await ultima();
    console.log(e.status, '| assunto:', e.assunto, '| dúvidas:', JSON.stringify(e.duvidas));

    passo('3. respondendo dúvidas (se houver)');
    for (let i = 0; i < 4 && e.status === 'aguardando_resposta'; i++) {
      await tratarEncomenda(db, DONO, 'Site com sistema, para a pessoa física dele');
      e = await ultima();
      console.log(e.status);
    }

    passo('4. confirmação "sim"');
    if (e.status === 'aguardando_confirmacao') await tratarEncomenda(db, DONO, 'sim');
    else await decidirEncomenda(db, e.id, true, DONO);
    e = await ultima();
    criados.lead = e.lead_id ?? undefined;
    criados.conv = e.conversation_id ?? undefined;
    console.log(e.status, '| lead', e.lead_id, '| conversa', e.conversation_id, '| erro', e.erro);
    const { data: lead } = await db.from('leads').select('source, status, pesquisa_status, notes').eq('id', e.lead_id!).single();
    console.log('lead:', lead);

    passo('5. financeiro: de graça');
    await decidirFinanceiro(db, 'pag', 'gratis', e.id, DONO);
    console.log((await ultima()).pagamento);

    passo('6. cliente responde (simulador: não sai pelo WhatsApp)');
    await db.from('ia_conversations').update({ contact_id: `simulador:piloto-${Date.now()}` }).eq('id', e.conversation_id!);
    const fala = async (t: string) => {
      await db.from('ia_messages').insert({ conversation_id: e.conversation_id!, direction: 'in', author: 'lead', body: t });
      await db.from('ia_conversations').update({ last_inbound_at: new Date().toISOString() }).eq('id', e.conversation_id!);
      const motivo = await responderConversa(e.conversation_id!);
      const { data: r } = await db.from('ia_messages').select('author, body').eq('conversation_id', e.conversation_id!).order('created_at', { ascending: false }).limit(1).single();
      console.log(`CLIENTE: ${t}\nLIA (${motivo ?? 'ok'}): ${r?.body}`);
    };
    await fala('Pode perguntar');
    await fala('Meu Instagram profissional é @felipesousam_. Hoje eu controlo tudo numa planilha e no WhatsApp, é uma bagunça. Quanto vai custar?');
    const { data: l2 } = await db.from('leads').select('briefing, instagram, pesquisa_status').eq('id', e.lead_id!).single();
    console.log('briefing/insta/pesquisa:', JSON.stringify(l2));

    passo('7. pesquisa na internet (busca web)');
    const feito = await pesquisarProximo(db, await lerConfig(db));
    const { data: l3 } = await db.from('leads').select('pesquisa_status, pesquisa, website, instagram, city').eq('id', e.lead_id!).single();
    console.log('pesquisado:', feito, l3?.pesquisa_status, JSON.stringify(l3?.pesquisa)?.slice(0, 1500));

    passo('8. custo do ensaio');
    const { data: custo } = await db.from('ia_usage').select('finalidade, cost_usd').or(`lead_id.eq.${e.lead_id},conversation_id.eq.${e.conversation_id}`);
    console.log(custo);
  } finally {
    passo('limpeza');
    if (criados.conv) {
      await db.from('ia_messages').delete().eq('conversation_id', criados.conv);
      await db.from('ia_avisos').delete().eq('conversation_id', criados.conv);
    }
    if (criados.enc) await db.from('encomendas').delete().eq('id', criados.enc);
    if (criados.conv) await db.from('ia_conversations').delete().eq('id', criados.conv);
    if (criados.lead) {
      await db.from('lead_search_requests').delete().eq('lead_id', criados.lead);
      await db.from('ia_avisos').delete().eq('lead_id', criados.lead);
      await db.from('leads').delete().eq('id', criados.lead);
    }
    console.log('apagado:', criados);
  }
}
main().catch((e) => {
  console.error(e);
});
