// Modelos de mensagem da Meta (pedido do Arthur em 30/10/2026): tudo o que a Lia pode precisar mandar
// FORA da janela de 24 h (quando o cliente não escreve há mais de um dia), com emojis para facilitar a
// leitura e botões de resposta rápida para o cliente responder com um toque. Só no servidor.
//
// O relógio cria cada modelo na Meta uma vez e acompanha a aprovação (ia_config.modelos, 0094).
// Regras da Meta seguidas aqui: corpo não começa nem termina com variável; botão de resposta rápida
// com até 25 caracteres, texto único e sem emoji; até 10 botões. O toque no botão volta pelo webhook
// como texto (o título do botão) e, nos modelos com ação, com o payload em botaoId.

import type { DbDoAtendente } from './db';
import type { Json } from '@/lib/supabase/database.types';
import { criarModelo, enviarModelo, infoDoModelo, whatsappConfigurado, type ResultadoDoEnvio } from './whatsapp-api';
import { avisarArthur } from './avisos';
import { registrarDecisao, semTipos } from './central-decisoes';
import { SITE_URL } from '@/lib/seo';

export type ModeloDoCliente = {
  nome: string;
  /** Para o painel: quando a Lia usa. */
  quando: string;
  corpo: string;
  exemplo: string[];
  botoes: string[];
  /** Para o Arthur (decisões com payload) ou para o cliente. */
  para: 'cliente' | 'arthur';
};

export const MODELOS: ModeloDoCliente[] = [
  {
    nome: 'contato_indicacao',
    quando: 'Primeira mensagem a quem você indicou ("Lia, faça todo o projeto")',
    corpo:
      'Olá, {{1}}! 👋 Aqui é a Lia, assistente da Prog Soluções.\n\nO Arthur me pediu para falar com você sobre *{{2}}* 🚀\n\nPosso te fazer algumas perguntas rápidas por aqui para entender o que você precisa?',
    exemplo: ['Mariana', 'o novo site da sua clínica'],
    botoes: ['Pode perguntar', 'Prefiro uma ligação', 'Agora não'],
    para: 'cliente',
  },
  {
    nome: 'contato_portfolio',
    quando: 'Primeira mensagem a quem preencheu o formulário do portfólio e não escreveu no WhatsApp (só depois da pesquisa e do pré-briefing)',
    corpo:
      'Olá, {{1}}! 👋 Aqui é a Lia, da Prog Soluções.\n\nRecebi sua mensagem pelo nosso portfólio sobre *{{2}}* 🚀\n\nPosso te fazer algumas perguntas rápidas por aqui para entender o que você precisa?',
    exemplo: ['Mariana', 'o novo site da Clínica Sorriso'],
    botoes: ['Pode perguntar', 'Prefiro uma ligação', 'Agora não'],
    para: 'cliente',
  },
  {
    nome: 'retomar_conversa',
    quando: 'Cliente indicado que parou de responder há 2 dias (uma vez só)',
    corpo: 'Oi, {{1}}! 😊 Ficamos no meio da nossa conversa sobre *{{2}}*.\n\nQuer continuar de onde paramos?',
    exemplo: ['Mariana', 'o novo site da sua clínica'],
    botoes: ['Vamos continuar', 'Mais tarde'],
    para: 'cliente',
  },
  {
    nome: 'lembrete_reuniao',
    quando: 'Lembrete da reunião com o Arthur, ~2 h antes',
    corpo:
      'Oi, {{1}}! 📅 Lembrete da sua reunião com o Arthur, da Prog Soluções:\n\n🗓️ {{2}}\n🔗 {{3}}\n\nAté já!',
    exemplo: ['Mariana', 'quinta, 31/10, às 15:00', 'https://meet.google.com/abc-defg-hij'],
    botoes: ['Confirmo presença', 'Preciso remarcar'],
    para: 'cliente',
  },
  {
    nome: 'briefing_pendente',
    quando: 'Falta material do cliente (logo, fotos, textos, acessos)',
    corpo: 'Oi, {{1}}! 📋 Para seguirmos com *{{2}}*, ainda preciso de: {{3}}.\n\nPode me mandar por aqui quando puder?',
    exemplo: ['Mariana', 'o novo site da sua clínica', 'o logo em boa qualidade e as fotos do consultório'],
    botoes: ['Vou mandar agora', 'Tenho uma dúvida'],
    para: 'cliente',
  },
  {
    nome: 'etapa_para_aprovar',
    quando: 'Uma etapa do projeto ficou pronta para o cliente ver e aprovar',
    corpo: 'Oi, {{1}}! ✨ A etapa *{{2}}* do seu projeto está pronta para você ver:\n\n🔗 {{3}}\n\nO que achou?',
    exemplo: ['Mariana', 'layout da página inicial', 'https://exemplo.vercel.app'],
    botoes: ['Aprovado', 'Quero ajustes'],
    para: 'cliente',
  },
  {
    nome: 'novidade_projeto',
    quando: 'Atualização do andamento do projeto',
    corpo: 'Oi, {{1}}! 🚧 Novidade no seu projeto *{{2}}*:\n\n{{3}}\n\nQualquer dúvida, é só responder aqui.',
    exemplo: ['Mariana', 'site da clínica', 'a área de agendamento já está funcionando no ambiente de testes'],
    botoes: ['Entendi', 'Tenho uma dúvida'],
    para: 'cliente',
  },
  {
    nome: 'projeto_entregue',
    quando: 'Entrega: o projeto está no ar',
    corpo: 'Oi, {{1}}! 🎉 Seu projeto *{{2}}* está no ar:\n\n🔗 {{3}}\n\nDá uma olhada com calma e me conta o que achou.',
    exemplo: ['Mariana', 'site da clínica', 'https://clinicamariana.com.br'],
    botoes: ['Ficou ótimo', 'Tenho um ajuste'],
    para: 'cliente',
  },
  {
    nome: 'acompanhamento',
    quando: 'Acompanhamento depois da entrega (7, 30 e 90 dias)',
    corpo: 'Oi, {{1}}! 👋 Já faz {{2}} que *{{3}}* está no ar. Como está sendo para você?',
    exemplo: ['Mariana', '30 dias', 'o site da clínica'],
    botoes: ['Está ótimo', 'Preciso de ajuda'],
    para: 'cliente',
  },
  {
    nome: 'autorizacao_portfolio',
    quando: 'Pedir para mostrar o projeto no portfólio',
    corpo: 'Oi, {{1}}! 🌟 Gostamos muito de como ficou *{{2}}*.\n\nPodemos mostrar o projeto no portfólio da Prog Soluções?',
    exemplo: ['Mariana', 'o site da clínica'],
    botoes: ['Pode sim', 'Prefiro que não'],
    para: 'cliente',
  },
  {
    nome: 'decisao_arthur',
    quando: 'Decisão sua quando a janela de 24 h está fechada (aprovar desconto, assumir conversa, chamar cliente)',
    corpo: '🔔 {{1}}\n\nToque numa opção para eu seguir.',
    exemplo: ['Pedido de 5% de desconto extra para a Clínica Sorriso. Aprovo?'],
    botoes: ['Sim', 'Não'],
    para: 'arthur',
  },
];

export const modelo = (nome: string) => MODELOS.find((m) => m.nome === nome)!;
const FINAIS = new Set(['APPROVED', 'REJECTED', 'DISABLED']);

export async function statusDosModelos(db: DbDoAtendente): Promise<Record<string, string>> {
  const { data } = await db.from('ia_config').select('modelos').eq('id', true).maybeSingle();
  return (data?.modelos ?? {}) as Record<string, string>;
}

export async function modeloAprovado(db: DbDoAtendente, nome: string): Promise<boolean> {
  return (await statusDosModelos(db))[nome] === 'APPROVED';
}

/** Relógio: cria os modelos que faltam na Meta e acompanha os pendentes (até 4 por minuto). */
export async function garantirModelos(db: DbDoAtendente): Promise<number> {
  if (!whatsappConfigurado()) return 0;
  const { data: c } = await db.from('ia_config').select('waba_id, modelos, modelos_categoria').eq('id', true).maybeSingle();
  if (!c?.waba_id) return 0;
  const atual = { ...((c.modelos ?? {}) as Record<string, string>) };
  const categorias = { ...((c.modelos_categoria ?? {}) as Record<string, string>) };
  const abertos = MODELOS.filter((m) => !FINAIS.has(atual[m.nome] ?? ''));
  // Revezamento: quem nunca foi consultado primeiro; os pendentes giram a cada minuto (antes eram sempre os
  // mesmos 4 e os outros nunca saíam de "em análise" no banco, mesmo aprovados na Meta — 30/10/2026).
  const novos = abertos.filter((m) => !atual[m.nome]);
  const pendentes = abertos.filter((m) => atual[m.nome]);
  const giro = pendentes.length ? Math.floor(Date.now() / 60_000) % pendentes.length : 0;
  const fila = [...novos, ...pendentes.slice(giro), ...pendentes.slice(0, giro)];
  let mudou = 0;
  const mudancas: { nome: string; status: string; motivo: string | null }[] = [];
  for (const m of fila.slice(0, 4)) {
    const info = await infoDoModelo(c.waba_id, m.nome);
    let status = info?.status ?? null;
    if (info?.categoria && info.categoria !== categorias[m.nome]) {
      categorias[m.nome] = info.categoria;
      mudou++;
    }
    if (!status && !atual[m.nome]?.startsWith('ERRO')) {
      const r = await criarModelo(c.waba_id, {
        name: m.nome,
        language: 'pt_BR',
        category: 'UTILITY',
        allow_category_change: true,
        components: [
          { type: 'BODY', text: m.corpo, example: { body_text: [m.exemplo] } },
          { type: 'BUTTONS', buttons: m.botoes.map((text) => ({ type: 'QUICK_REPLY', text })) },
        ],
      });
      status = r.ok ? (r.status ?? 'PENDING') : `ERRO: ${r.erro}`.slice(0, 200);
    }
    if (status && status !== atual[m.nome]) {
      if (FINAIS.has(status)) mudancas.push({ nome: m.nome, status, motivo: info?.motivo ?? null });
      atual[m.nome] = status;
      mudou++;
    }
  }
  if (mudou) await db.from('ia_config').update({ modelos: atual as Json, modelos_categoria: categorias as Json }).eq('id', true);
  for (const x of mudancas) await avisarMudancaDoModelo(db, x.nome, x.status, x.motivo);
  return mudou;
}

/** O que cada modelo aprovado destrava (para o aviso de aprovação). */
const DESTRAVA: Record<string, string> = {
  contato_indicacao: 'a Lia já pode mandar a primeira mensagem a quem você indicar ("Lia, faça todo o projeto"), mesmo sem a pessoa ter escrito antes',
  contato_portfolio: 'a Lia já pode chamar sozinha quem preencheu o formulário do portfólio e não escreveu no WhatsApp (depois da pesquisa e do pré-briefing)',
  retomar_conversa: 'a Lia já pode retomar, uma vez, o cliente indicado que parou de responder há 2 dias',
  lembrete_reuniao: 'o lembrete da reunião chega ao cliente mesmo com a janela de 24 h fechada',
  briefing_pendente: 'a Lia já pode cobrar material do cliente (logo, fotos, acessos) fora da janela de 24 h',
  etapa_para_aprovar: 'a Lia já pode mandar uma etapa pronta para o cliente aprovar fora da janela de 24 h',
  novidade_projeto: 'a Lia já pode mandar novidades do andamento do projeto fora da janela de 24 h',
  projeto_entregue: 'a Lia já pode avisar a entrega do projeto fora da janela de 24 h',
  acompanhamento: 'o acompanhamento de 7, 30 e 90 dias depois da entrega já pode sair',
  autorizacao_portfolio: 'a Lia já pode pedir autorização para mostrar o projeto no portfólio',
  decisao_arthur: 'as decisões com botão (desconto, assumir conversa, chamar cliente) chegam a você mesmo com a janela de 24 h fechada',
};

/**
 * Aviso de mudança de status de um modelo (0117): aprovado, recusado ou desativado pela Meta. Uma vez por
 * mudança (ia_config.modelos_avisados guarda o último status avisado de cada modelo). Recusado vira card na
 * central de decisões.
 */
export async function avisarMudancaDoModelo(db: DbDoAtendente, nome: string, status: string, motivo: string | null): Promise<void> {
  const { data: c } = await semTipos(db).from('ia_config').select('modelos_avisados').eq('id', true).maybeSingle();
  const avisados = { ...((c?.modelos_avisados ?? {}) as Record<string, string>) };
  if (avisados[nome] === status) return;
  avisados[nome] = status;
  // Marca antes: o próximo minuto não repete.
  await semTipos(db).from('ia_config').update({ modelos_avisados: avisados }).eq('id', true);
  const { lerConfig } = await import('./agente');
  const cfg = await lerConfig(db);
  const m = MODELOS.find((x) => x.nome === nome);
  if (status === 'APPROVED') {
    await avisarArthur(db, cfg, {
      titulo: `✅ A Meta aprovou o modelo ${nome}`,
      texto: `O que ele destrava: ${DESTRAVA[nome] ?? m?.quando ?? 'o envio desta mensagem fora da janela de 24 h'}.`,
      link: `${SITE_URL}/admin/lia`,
    });
    return;
  }
  const verbo = status === 'REJECTED' ? 'recusou' : 'desativou';
  const porque = motivo ? `Motivo da Meta: ${motivo}.` : 'A Meta não informou o motivo.';
  const decisaoId = await registrarDecisao(db, {
    chave: `modelo:${nome}:${status}`,
    tipo: 'modelo',
    origem: 'Meta (modelo de mensagem)',
    titulo: `A Meta ${verbo} o modelo ${nome}`,
    resumo: `${porque}${m ? ` Uso do modelo: ${m.quando}.` : ''}${m ? `

Texto enviado à Meta:
${m.corpo}` : ''}`,
    pergunta: 'Peço ao Claude para reescrever e mandar de novo, ou deixa assim?',
    contexto: { links: [{ rotulo: 'Modelos na Meta', url: 'https://business.facebook.com/wa/manage/message-templates/' }] },
    opcoes: [
      { id: 'painel:prompt', titulo: 'Reescrever e reenviar' },
      { id: 'painel:ok', titulo: 'Deixar assim' },
    ],
  });
  await avisarArthur(db, cfg, {
    titulo: `❌ A Meta ${verbo} o modelo ${nome}`,
    texto: porque,
    decisaoId,
  });
}

/** Texto como o cliente vê (para o histórico da conversa, que a Lia lê). */
export function textoDoModelo(nome: string, params: string[]): string {
  const m = modelo(nome);
  const corpo = params.reduce((t, p, i) => t.replace(`{{${i + 1}}}`, p), m.corpo);
  return `${corpo}\n[botões: ${m.botoes.join(' | ')}]`;
}

/**
 * Manda um modelo ao cliente de uma conversa e grava no histórico (a Lia vê o que foi enviado).
 * Devolve o erro em texto quando não saiu (modelo não aprovado, WhatsApp fora...).
 */
export async function enviarModeloAoCliente(
  db: DbDoAtendente,
  conversaId: string,
  para: string,
  nome: string,
  params: string[],
): Promise<ResultadoDoEnvio> {
  if (!(await modeloAprovado(db, nome))) return { ok: false, erro: `modelo ${nome} ainda não aprovado pela Meta` };
  const r = await enviarModelo(para, nome, params);
  const agora = new Date().toISOString();
  await db.from('ia_messages').insert({
    conversation_id: conversaId,
    direction: 'out',
    author: 'ia',
    body: textoDoModelo(nome, params),
    ...(r.ok ? { external_id: r.id, status: 'sent' } : { status: 'failed', error: r.erro }),
  });
  if (r.ok) await db.from('ia_conversations').update({ last_message_at: agora }).eq('id', conversaId);
  return r;
}
