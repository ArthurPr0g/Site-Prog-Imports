/**
 * Ensaio do "atualizar a negociação" pelo WhatsApp da Lia (0112), antes do uso real (reunião de 31/10/2026).
 * WhatsApp FALSO: um servidor local recebe e mostra o que a Lia mandaria (nada sai para ninguém). Usa o banco de
 * produção e a API da Anthropic (custa centavos). Cria o lead "TESTE Reunião (apagar)" e apaga tudo no fim.
 *
 *   npx -y tsx scripts/teste-negociacao.ts
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';

const RAIZ = resolve(__dirname, '..');
for (const l of readFileSync(join(RAIZ, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const PORTA = 4599;
process.env.WHATSAPP_API_BASE = `http://127.0.0.1:${PORTA}`;
process.env.WHATSAPP_TOKEN = 'falso';
process.env.WHATSAPP_PHONE_NUMBER_ID = 'falso';

const DONO = '5500000000001'; // número fictício do "Arthur"
const CONTATO_TESTE = '5500000000099'; // número fictício do cliente de teste
const enviados: { para: string; texto: string; botoes: string[] }[] = [];
let seq = 0;
const servidor = createServer((req, res) => {
  let corpo = '';
  req.on('data', (c) => (corpo += c));
  req.on('end', () => {
    try {
      const j = JSON.parse(corpo || '{}');
      const texto = j.text?.body ?? j.interactive?.body?.text ?? JSON.stringify(j).slice(0, 300);
      const botoes = (j.interactive?.action?.buttons ?? []).map((b: { reply: { id: string; title: string } }) => `${b.reply.title} [${b.reply.id.split(':').slice(0, 2).join(':')}]`);
      const linhas = (j.interactive?.action?.sections?.[0]?.rows ?? []).map((r: { id: string; title: string }) => `${r.title} [${r.id.split(':').slice(0, 2).join(':')}]`);
      enviados.push({ para: j.to, texto, botoes: [...botoes, ...linhas] });
      console.log(`\n   📲 Lia → ${j.to === DONO ? 'Arthur' : j.to}:\n${texto.replace(/^/gm, '      ')}${[...botoes, ...linhas].length ? `\n      [botões] ${[...botoes, ...linhas].join(' | ')}` : ''}`);
    } catch {
      /* ignora */
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ messages: [{ id: `wamid.falso.${++seq}` }] }));
  });
});

const msg = (texto: string) => ({
  id: `teste-neg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  de: DONO,
  nome: 'Arthur',
  texto,
  quando: new Date().toISOString(),
  midia: null,
  reacao: false,
  botaoId: null,
  respondeA: null,
});

async function main() {
  await new Promise<void>((r) => servidor.listen(PORTA, '127.0.0.1', r));
  const { dbDoAtendente } = await import('../src/lib/atendente/db');
  const { tratarNegociacao, decidirNegociacao, lerLink } = await import('../src/lib/atendente/negociacao');
  const db = dbDoAtendente();
  const passo = (t: string) => console.log(`\n=== ${t}`);
  const criados: { lead?: string; conv?: string; sessoes: string[] } = { sessoes: [] };
  const sessao = async () => {
    const { data } = await db.from('negociacao_sessoes').select('*').eq('dono', DONO).order('criado_em', { ascending: false }).limit(1).maybeSingle();
    if (data && !criados.sessoes.includes(data.id)) criados.sessoes.push(data.id);
    return data;
  };
  let falhas = 0;
  const confere = (ok: boolean, o: string) => {
    console.log(`${ok ? '   ✅' : '   ❌'} ${o}`);
    if (!ok) falhas++;
  };

  try {
    passo('0. lead e conversa de teste');
    const agora = new Date().toISOString();
    const { data: lead, error: e1 } = await db
      .from('leads')
      .insert({ name: 'TESTE Reunião (apagar)', dedupe_key: `teste-negociacao:${Date.now()}`, phone: CONTATO_TESTE, source: 'teste', status: 'respondeu', notes: 'Lead de teste do fluxo de negociação (apagar).', origem_contato: 'sistema' })
      .select('id')
      .single();
    if (e1 || !lead) throw e1 ?? new Error('lead não criado');
    criados.lead = lead.id;
    const { data: conv } = await db
      .from('ia_conversations')
      .insert({ channel: 'whatsapp', contact_id: CONTATO_TESTE, contact_name: 'TESTE Reunião (apagar)', lead_id: lead.id, last_message_at: agora })
      .select('id')
      .single();
    criados.conv = conv!.id;
    // O banco marca número fictício como teste (gatilho ia_conversa_de_teste); aqui precisa aparecer na busca.
    await db.from('ia_conversations').update({ is_test: false }).eq('id', conv!.id);
    await db.from('ia_messages').insert([
      { conversation_id: conv!.id, direction: 'in', author: 'lead', body: 'Quero um sistema', created_at: agora },
      { conversation_id: conv!.id, direction: 'out', author: 'ia', body: 'Legal! Como você controla tudo hoje?', created_at: agora },
      { conversation_id: conv!.id, direction: 'in', author: 'lead', body: 'Outro sistema, mas é muito limitado. Prefiro marcar uma reunião com o Arthur.', created_at: agora },
    ]);
    console.log('lead', lead.id, 'conversa', conv!.id);

    passo('1. ideias comuns NÃO podem disparar');
    for (const t of [
      'Ideia: mandar lembrete de reunião para os clientes um dia antes',
      'Melhorar o PDF da proposta com as cores novas da marca',
      'Comprar pão amanhã cedo',
      'Quero que a Lia mande o relatório do andamento das reuniões toda sexta',
    ]) {
      const r = await tratarNegociacao(db, msg(t), t, 'whatsapp');
      confere(!r, `"${t}" → ${r ? 'CAPTUROU (errado)' : 'segue o caminho normal'}`);
    }
    await sessao(); // registra sessões que a dúvida possa ter aberto

    passo('2. gatilho com nome: "atualiza a negociação do TESTE Reunião apagar"');
    await tratarNegociacao(db, msg('atualiza a negociação do TESTE Reunião apagar'), 'atualiza a negociação do TESTE Reunião apagar', 'whatsapp');
    let s = await sessao();
    console.log('sessão:', s?.status, '| nome falado:', s?.nome_falado, '| candidatos:', JSON.stringify(s?.candidatos)?.slice(0, 300));
    if (s?.status === 'confirmando') {
      const c0 = (s.candidatos as { leadId: string }[])[0];
      confere(c0?.leadId === lead.id, 'um candidato só, e é o lead de teste');
      await decidirNegociacao(db, 'sim', s.id, DONO);
    } else if (s?.status === 'escolhendo') {
      const i = ((s.candidatos ?? []) as { leadId: string }[]).findIndex((k) => k.leadId === lead.id);
      confere(i >= 0, 'lead de teste está entre as opções');
      await decidirNegociacao(db, 'abc'[Math.max(i, 0)], s.id, DONO);
    }
    s = await sessao();
    confere(s?.status === 'aguardando_conteudo' && s.lead_id === lead.id && s.conversation_id === conv!.id, `sessão aguardando o relato (${s?.status})`);

    const comIa = !!process.env.ANTHROPIC_API_KEY;
    if (!comIa) console.log('\n(sem ANTHROPIC_API_KEY local: o processamento pela IA falha de propósito aqui; o teste da IA é feito no servidor)');
    passo('3. relato em duas partes + "pronto"');
    const p1 =
      'Fiz a reunião com ele agora. Ele tem uma empresa de consultoria financeira com 5 pessoas e usa um sistema genérico que não faz o que ele precisa. Quer um sistema próprio para gerenciar os clientes da consultoria: cadastro de clientes, controle de contratos, agenda de reuniões e relatórios mensais em PDF para cada cliente.';
    const p2 =
      'Ele falou que tem uns 15 mil reais para investir e quer usar em fevereiro. Ficou combinado que eu mando a proposta até segunda-feira e ele me manda exemplos dos relatórios que usa hoje. Também quer integrar com o Google Agenda.';
    const t1 = tratarNegociacao(db, msg(p1), p1, 'whatsapp');
    await new Promise((r) => setTimeout(r, 2500));
    const t2 = tratarNegociacao(db, msg(p2), p2, 'whatsapp');
    await new Promise((r) => setTimeout(r, 2500));
    await tratarNegociacao(db, msg('pronto'), 'pronto', 'whatsapp');
    s = await sessao();
    confere(comIa ? s?.status === 'concluida' : s?.status === 'aguardando_conteudo' && s?.erro === 'IA falhou', `processado (${s?.status}${s?.erro ? `, erro: ${s.erro}` : ''})`);
    console.log('   (esperando as execuções das partes 1 e 2 terminarem a espera de 1 min...)');
    await Promise.all([t1, t2]);
    s = await sessao();
    if (comIa) confere(s?.status === 'concluida', 'as partes não processaram de novo');
    else {
      const { data: l0 } = await db.from('ia_usage').select('id').eq('finalidade', 'negociacao_reuniao').gte('created_at', agora);
      confere(!l0?.length, 'sem IA: nada gravado como processado');
      await tratarNegociacao(db, msg('cancela'), 'cancela', 'whatsapp');
    }

    if (comIa) {
    passo('4. o que mudou no banco');
    const { data: l } = await db.from('leads').select('status, notes, briefing, atualizacoes_do_dono').eq('id', lead.id).single();
    console.log('etapa:', l?.status);
    console.log('notas:', l?.notes);
    console.log('briefing:', JSON.stringify(l?.briefing, null, 1));
    confere(Array.isArray(l?.atualizacoes_do_dono) && (l!.atualizacoes_do_dono as unknown[]).length === 1, 'atualizacoes_do_dono com 1 registro (painel)');
    confere(l?.status === 'proposta' || l?.status === 'reuniao', `etapa avançou (${l?.status})`);
    const { data: aviso } = await db.from('ia_messages').select('body').eq('conversation_id', conv!.id).eq('author', 'sistema');
    confere(!!aviso?.length, 'aviso interno gravado na conversa da Lia');
    console.log('aviso:', aviso?.[0]?.body);
    const { data: ideias } = await db.from('ideias').select('id, titulo, texto').like('external_id', `neg:${s!.id}:%`);
    console.log('ideias do Arthur:', ideias?.map((i) => i.titulo));
    confere(!enviados.some((e) => e.para === CONTATO_TESTE), 'nada foi enviado ao cliente');

    passo('5. botão "Só registrar"');
    await decidirNegociacao(db, 'registrar', s!.id, DONO);
    await decidirNegociacao(db, 'registrar', s!.id, DONO); // repetido: "já tratado"
    }

    passo('6. sem nome: "quero atualizar a negociação de um cliente" → opções + cancela');
    await tratarNegociacao(db, msg('quero atualizar a negociação de um cliente'), 'quero atualizar a negociação de um cliente', 'whatsapp');
    s = await sessao();
    console.log('sessão:', s?.status, '| opções:', ((s?.candidatos ?? []) as { nome: string }[]).map((k) => k.nome));
    await tratarNegociacao(db, msg('cancela'), 'cancela', 'whatsapp');
    s = await sessao();
    confere(s?.status === 'cancelada', 'cancelada');

    passo('7. nome escrito depois + relato junto na mesma mensagem');
    const junto = 'Reunião com o TESTE Reunião: ele desistiu do projeto, disse que vai continuar com o sistema atual por enquanto.';
    await tratarNegociacao(db, msg(junto), junto, 'whatsapp');
    s = await sessao();
    console.log('sessão:', s?.status, '| conteúdo guardado:', !!s?.conteudo);
    if (s?.status === 'confirmando') await decidirNegociacao(db, 'nao', s.id, DONO);
    s = await sessao();
    console.log('depois do "Não":', s?.status);
    await tratarNegociacao(db, msg('cancela'), 'cancela', 'whatsapp');

    passo('8. links de transcrição');
    const pub = await lerLink('https://pt.wikipedia.org/wiki/WhatsApp');
    confere(!!pub && pub.length > 1000, `página pública lida (${pub?.length ?? 0} caracteres)`);
    const priv = await lerLink('https://docs.google.com/document/d/1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/edit');
    confere(priv === null, 'Google Docs privado/inexistente → null (a Lia pede para colar)');
    const local = await lerLink('https://127.0.0.1/x');
    confere(local === null, 'endereço interno bloqueado');

    console.log(`\nMensagens que a Lia mandaria ao Arthur: ${enviados.filter((e) => e.para === DONO).length}; ao cliente: ${enviados.filter((e) => e.para !== DONO).length}`);
  } finally {
    passo('limpeza');
    for (const id of criados.sessoes) await db.from('ideias').delete().like('external_id', `neg:${id}:%`);
    if (criados.sessoes.length) await db.from('negociacao_sessoes').delete().in('id', criados.sessoes);
    await db.from('negociacao_sessoes').delete().eq('dono', DONO);
    if (criados.conv) {
      await db.from('ia_messages').delete().eq('conversation_id', criados.conv);
      const { error } = await db.from('ia_conversations').delete().eq('id', criados.conv);
      if (error) console.log('conversa não apagada:', error.message, criados.conv);
    }
    if (criados.lead) {
      const { error } = await db.from('leads').delete().eq('id', criados.lead);
      console.log(error ? `lead NÃO apagado (${error.message}): delete from leads where id = '${criados.lead}';` : 'lead de teste apagado');
    }
    servidor.close();
    console.log(falhas ? `\n${falhas} conferência(s) falharam` : '\nTudo certo.');
    process.exit(falhas ? 1 : 0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
