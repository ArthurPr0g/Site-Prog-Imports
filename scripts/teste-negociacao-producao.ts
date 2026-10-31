/**
 * Teste de ponta a ponta do "atualizar a negociação" (0112) no SITE NO AR, pelo webhook assinado, como se
 * o Arthur escrevesse para a Lia. Usa a IA de verdade (a chave só existe na Vercel). Manda no máximo 3
 * mensagens ao Arthur (pergunta "É o TESTE...?", "processando" e o resumo), todas com "TESTE" no nome.
 * Nada vai a cliente: o lead "TESTE Reunião (apagar)" tem número fictício e é apagado no fim.
 *
 *   npx -y tsx scripts/teste-negociacao-producao.ts
 */
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RAIZ = resolve(__dirname, '..');
for (const l of readFileSync(join(RAIZ, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const WEBHOOK = 'https://www.prog-imports.com/api/whatsapp/webhook';
const CONTATO_TESTE = '5500000000099';
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postar(de: string, mensagem: Record<string, unknown>) {
  const corpo = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ value: { contacts: [{ wa_id: de, profile: { name: 'Arthur' } }], messages: [{ from: de, timestamp: String(Math.floor(Date.now() / 1000)), ...mensagem }] } }] }],
  });
  const assinatura = 'sha256=' + createHmac('sha256', process.env.WHATSAPP_APP_SECRET ?? '').update(corpo, 'utf8').digest('hex');
  const r = await fetch(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': assinatura }, body: corpo });
  console.log('   webhook →', r.status, await r.text());
}

async function main() {
  const { dbDoAtendente } = await import('../src/lib/atendente/db');
  const db = dbDoAtendente();
  const { data: cfg } = await db.from('ia_config').select('owner_whatsapp').eq('id', true).single();
  const dono = cfg!.owner_whatsapp!;
  const inicio = new Date().toISOString();
  const criados: { lead?: string; conv?: string; sessao?: string } = {};
  let falhas = 0;
  const confere = (ok: boolean, o: string) => {
    console.log(`${ok ? '   ✅' : '   ❌'} ${o}`);
    if (!ok) falhas++;
  };
  const sessao = async () =>
    (await db.from('negociacao_sessoes').select('*').eq('dono', dono).ilike('pedido', '%TESTE automático%').is('erro', null).order('criado_em', { ascending: false }).limit(1).maybeSingle()).data;

  try {
    const { data: lead } = await db
      .from('leads')
      .insert({ name: 'TESTE Reunião (apagar)', dedupe_key: `teste-negociacao:${Date.now()}`, phone: CONTATO_TESTE, source: 'teste', status: 'respondeu', notes: 'Lead de teste do fluxo de negociação (apagar).', origem_contato: 'sistema' })
      .select('id')
      .single();
    criados.lead = lead!.id;
    const { data: conv } = await db
      .from('ia_conversations')
      .insert({ channel: 'whatsapp', contact_id: CONTATO_TESTE, contact_name: 'TESTE Reunião (apagar)', lead_id: lead!.id, last_message_at: inicio })
      .select('id')
      .single();
    criados.conv = conv!.id;
    await db.from('ia_conversations').update({ is_test: false }).eq('id', conv!.id);
    await db.from('ia_messages').insert({ conversation_id: conv!.id, direction: 'in', author: 'lead', body: 'Quero um sistema. Prefiro marcar uma reunião com o Arthur.', created_at: inicio });
    console.log('lead', lead!.id);

    console.log('\n=== 1. Arthur (simulado): gatilho + relato na mesma mensagem');
    const relato =
      'Reunião com o TESTE Reunião apagar (isto é um TESTE automático, pode ignorar): ele tem uma consultoria financeira com 5 pessoas e quer um sistema próprio de gestão, com cadastro de clientes, controle de contratos, agenda e relatórios mensais em PDF. Falou em uns 15 mil de orçamento e quer usar em fevereiro. Combinamos que eu mando a proposta até segunda e ele me manda exemplos dos relatórios de hoje.';
    await postar(dono, { id: `wamid.teste.${Date.now()}`, type: 'text', text: { body: relato } });
    let s = null;
    for (let i = 0; i < 12 && !(s && s.status !== 'escolhendo'); i++) {
      await espera(3000);
      s = await sessao();
    }
    criados.sessao = s?.id;
    console.log('sessão:', s?.status, '| nome:', s?.nome_falado, '| relato guardado:', !!s?.conteudo);
    confere(s?.status === 'confirmando', 'Lia perguntou "É o TESTE Reunião (apagar)?"');
    confere(!!s?.conteudo, 'relato da mesma mensagem guardado');

    console.log('\n=== 2. Arthur (simulado) toca "Sim"');
    await postar(dono, { id: `wamid.teste.${Date.now()}b`, type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: `neg:sim:${s!.id}`, title: 'Sim' } } });
    for (let i = 0; i < 40; i++) {
      await espera(4000);
      s = await sessao();
      if (s?.status === 'concluida' || s?.erro) break;
    }
    confere(s?.status === 'concluida', `processado (${s?.status}${s?.erro ? `, erro: ${s.erro}` : ''})`);
    console.log('resultado:', JSON.stringify(s?.resultado, null, 1)?.slice(0, 2500));

    const { data: l } = await db.from('leads').select('status, notes, briefing, atualizacoes_do_dono').eq('id', lead!.id).single();
    console.log('etapa:', l?.status, '\nnotas:', l?.notes, '\nbriefing:', JSON.stringify(l?.briefing));
    confere(['reuniao', 'proposta'].includes(l?.status ?? ''), `etapa avançou (${l?.status})`);
    confere(Array.isArray(l?.atualizacoes_do_dono) && (l!.atualizacoes_do_dono as unknown[]).length === 1, 'histórico do painel gravado');
    const { data: aviso } = await db.from('ia_messages').select('body').eq('conversation_id', conv!.id).eq('author', 'sistema');
    confere(!!aviso?.length, 'aviso interno gravado');
    const { data: saida } = await db.from('ia_messages').select('id').eq('conversation_id', conv!.id).eq('direction', 'out').neq('author', 'sistema');
    confere(!saida?.length, 'nada foi mandado ao cliente');
    const { data: ideias } = await db.from('ideias').select('titulo').like('external_id', `neg:${s!.id}:%`);
    console.log('ideias do Arthur:', ideias?.map((i) => i.titulo));
  } finally {
    console.log('\n=== limpeza');
    // Nenhuma sessão de teste pode ficar aberta no número do Arthur (pegaria a próxima mensagem dele).
    const { data: sessoes } = await db.from('negociacao_sessoes').select('id').eq('dono', dono).ilike('pedido', '%TESTE automático%');
    for (const x of sessoes ?? []) {
      await db.from('ideias').delete().like('external_id', `neg:${x.id}:%`);
      await db.from('negociacao_sessoes').delete().eq('id', x.id);
    }
    if (criados.conv) {
      await db.from('ia_messages').delete().eq('conversation_id', criados.conv);
      await db.from('ia_conversations').delete().eq('id', criados.conv);
    }
    if (criados.lead) {
      const { error } = await db.from('leads').delete().eq('id', criados.lead);
      console.log(error ? `lead NÃO apagado (${error.message}): delete from leads where id = '${criados.lead}';` : 'lead de teste apagado');
    }
    console.log(falhas ? `\n${falhas} conferência(s) falharam` : '\nTudo certo.');
    process.exit(falhas ? 1 : 0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
