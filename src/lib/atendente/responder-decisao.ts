// Resposta do Arthur a um card da central de decisões (/admin/decisoes, 0117). Só no servidor.
//
// Regra do Arthur (31/10/2026): nada aqui chama a API da Anthropic.
//  - Botão rápido = a mesma ação do botão do WhatsApp (tratarDecisao): aprovar/negar desconto, chamar cliente,
//    assumir conversa, financeiro... Direto, sem IA.
//  - Botões só do painel ("painel:..."): já resolvi, adiar/feito do prazo da pré-venda, reescrever o modelo.
//  - Texto livre = pedido na fila do PC (ideias tipo prompt, status pendente), com o contexto do card. O executor
//    do PC roda com a assinatura do Claude e avisa a conclusão no WhatsApp. O card fica "enviada" até o pedido
//    terminar (sincronizarDecisoes o passa a resolvida).

import { randomUUID } from 'node:crypto';
import type { DbDoAtendente } from './db';
import { resolverDecisao, semTipos, type ContextoDaDecisao, type OpcaoDaDecisao } from './central-decisoes';
import { ehDecisao, tratarDecisao } from './decisoes';
import { gravarContinuacao, PROJETOS } from './ideias';
import type { MensagemRecebida } from './whatsapp-api';

type Card = {
  id: string;
  chave: string;
  tipo: string;
  origem: string;
  titulo: string;
  resumo: string | null;
  pergunta: string | null;
  contexto: ContextoDaDecisao;
  opcoes: OpcaoDaDecisao[];
  conversation_id: string | null;
  lead_id: string | null;
  ideia_id: string | null;
  status: string;
};

export type RespostaDaCentral = { ok: true; mensagem: string } | { ok: false; erro: string };

export async function responderDecisao(db: DbDoAtendente, id: string, r: { opcaoId?: string; texto?: string }): Promise<RespostaDaCentral> {
  const { data } = await semTipos(db).from('decisoes').select('*').eq('id', id).maybeSingle();
  const d = data as Card | null;
  if (!d) return { ok: false, erro: 'Não achei essa decisão.' };
  if (d.status !== 'pendente') return { ok: false, erro: 'Essa decisão já foi respondida.' };

  const texto = r.texto?.trim();
  if (texto) return mandarParaFila(db, d, texto);

  const opcao = d.opcoes.find((o) => o.id === r.opcaoId);
  if (!opcao) return { ok: false, erro: 'Opção inválida para esta decisão.' };

  if (opcao.id === 'painel:ok') {
    await resolverDecisao(db, { id }, { por: 'painel', resposta: opcao.titulo });
    return { ok: true, mensagem: 'Marcada como resolvida.' };
  }
  if (opcao.id === 'painel:feito' || opcao.id === 'painel:adiar2') {
    if (!d.lead_id) return { ok: false, erro: 'Decisão sem lead.' };
    const { data: p } = await semTipos(db).from('prevenda').select('proximo_prazo').eq('lead_id', d.lead_id).maybeSingle();
    if (opcao.id === 'painel:feito') {
      await semTipos(db).from('prevenda').update({ proximo_passo: null, proximo_responsavel: null, proximo_prazo: null, updated_at: new Date().toISOString() }).eq('lead_id', d.lead_id);
    } else {
      const base = p?.proximo_prazo ? Date.parse(`${p.proximo_prazo}T12:00:00-03:00`) : Date.now();
      const novo = new Date(Math.max(base, Date.now()) + 2 * 24 * 3600_000 - 3 * 3600_000).toISOString().slice(0, 10);
      await semTipos(db).from('prevenda').update({ proximo_prazo: novo, updated_at: new Date().toISOString() }).eq('lead_id', d.lead_id);
    }
    await resolverDecisao(db, { id }, { por: 'painel', resposta: opcao.titulo });
    return { ok: true, mensagem: opcao.id === 'painel:feito' ? 'Próximo passo marcado como feito na pré-venda.' : 'Prazo adiado em 2 dias na pré-venda.' };
  }
  if (opcao.id === 'painel:prompt') {
    return mandarParaFila(db, d, 'Reescreva o texto do modelo seguindo as regras da Meta para a categoria utilidade, crie o modelo de novo com outro nome (ou o mesmo, se a Meta deixar) e atualize o código que o usa.');
  }

  // Mesma ação do botão do WhatsApp: a confirmação também chega lá.
  const { data: cfg } = await db.from('ia_config').select('owner_whatsapp').eq('id', true).maybeSingle();
  const m: MensagemRecebida = {
    id: `painel:${randomUUID()}`,
    de: cfg?.owner_whatsapp?.replace(/\D/g, '') ?? '',
    nome: 'Arthur',
    texto: opcao.titulo,
    quando: new Date().toISOString(),
    midia: null,
    reacao: false,
    botaoId: opcao.id,
    respondeA: null,
  };
  if (!ehDecisao(m)) return { ok: false, erro: 'Esta opção não tem ação ligada.' };
  await tratarDecisao(db, m, 'painel');
  // Ações sem card pendente por chave (raro): garante que este saia da lista.
  await resolverDecisao(db, { id }, { por: 'painel', resposta: opcao.titulo });
  return { ok: true, mensagem: `Feito: ${opcao.titulo}. A confirmação também foi para o seu WhatsApp.` };
}

/** Texto livre vira pedido na fila do PC (assinatura do Claude), com o contexto do card. */
async function mandarParaFila(db: DbDoAtendente, d: Card, resposta: string): Promise<RespostaDaCentral> {
  const externo = `painel:${d.id}:${Date.now()}`;
  let ideiaId: string | undefined;

  if (d.tipo === 'prompt' && d.ideia_id) {
    // Pedido "Aguardando você": continuação com o mesmo agente e projeto (igual à resposta pelo WhatsApp).
    const r = await gravarContinuacao(db, d.ideia_id, resposta, 'hub', externo);
    if (!r?.ok) return { ok: false, erro: 'Não consegui pôr a continuação na fila agora.' };
    ideiaId = r.id;
  } else {
    const proj = PROJETOS.solucoes;
    const ctx = d.contexto ?? {};
    const linhas = [
      `[Projeto: ${proj.nome} — pasta ${proj.pasta}]`,
      'Decisão respondida pelo Arthur na central de decisões do painel (/admin/decisoes). Execute o que ele decidiu.',
      '',
      `Decisão: ${d.titulo}`,
      `De onde veio: ${d.origem}`,
      ...(d.resumo ? [`O que estava em jogo: ${d.resumo}`] : []),
      ...(d.pergunta ? [`Pergunta: ${d.pergunta}`] : []),
      ...(ctx.cliente ? [`Cliente: ${ctx.cliente}`] : []),
      ...(ctx.valores?.length ? [`Valores: ${ctx.valores.join(' · ')}`] : []),
      ...(ctx.links?.length ? [`Links: ${ctx.links.map((l) => `${l.rotulo} ${l.url}`).join(' · ')}`] : []),
      ...(d.opcoes.length ? [`Opções que existiam (id da ação em decisoes.ts): ${d.opcoes.map((o) => `${o.titulo} = ${o.id}`).join(' · ')}`] : []),
      `Ids: decisão ${d.id} (chave ${d.chave})${d.conversation_id ? `, conversa ${d.conversation_id}` : ''}${d.lead_id ? `, lead ${d.lead_id}` : ''}${d.ideia_id ? `, pedido ${d.ideia_id}` : ''}.`,
      '',
      `Resposta do Arthur (siga isto):\n${resposta}`,
      '',
      'Banco: MCP prog-supabase-arthurmatos003 (ref oduimaztcoxbvtlsjjcy). Use os fluxos que já existem (decisoes.ts, encomenda.ts, agente.ts). ' +
        'Se a resposta pedir uma mensagem a um cliente, escreva-a no painel do atendimento como o Arthur (ou deixe pronta para ele mandar), sem inventar condição que ele não deu.',
    ];
    const { data: nova, error } = await db
      .from('ideias')
      .insert({
        tipo: 'prompt',
        origem: 'hub',
        status: 'pendente',
        titulo: `Decisão: ${d.titulo}`.slice(0, 120),
        texto: linhas.join('\n').slice(0, 8000),
        original: resposta.slice(0, 8000),
        projeto: proj.nome,
        external_id: externo,
      })
      .select('id')
      .single();
    if (error || !nova) return { ok: false, erro: 'Não consegui pôr o pedido na fila agora.' };
    ideiaId = nova.id;
  }

  await semTipos(db)
    .from('decisoes')
    .update({ status: 'enviada', resposta: resposta.slice(0, 4000), resposta_ideia_id: ideiaId ?? null, resolvida_por: 'painel', atualizada_em: new Date().toISOString() })
    .eq('id', d.id)
    .eq('status', 'pendente');
  return { ok: true, mensagem: 'Enviado ao Claude (fila do PC). Você recebe o aviso no WhatsApp quando terminar.' };
}
