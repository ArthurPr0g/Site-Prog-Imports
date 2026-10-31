// Avisos ao Arthur no WhatsApp dele (pedido do dono em 28/10/2026): o número da
// Lia manda para o dele quando um cliente pede o Arthur, a venda fecha, chega um
// pedido de desconto, uma reunião é marcada ou o vendedor marca reunião/proposta.
//
// Regra do WhatsApp: texto livre só dentro de 24 h da última mensagem do Arthur
// para o número da Lia. Fora disso, só modelo aprovado pela Meta
// ("aviso_ao_arthur", categoria utilidade, criado sozinho pelo relógio). Se o
// Arthur responder qualquer coisa a um aviso, a janela abre e os próximos saem
// como texto. Sem WhatsApp nem modelo aprovado, vai por e-mail (se configurado).

import type { DbDoAtendente } from '@/lib/atendente/db';
import type { ConfigDoAtendente } from '@/lib/atendente/regras';
import { enviarTexto, enviarComOpcoes, enviarComLink, enviarModelo, criarModelo, statusDoModelo, whatsappConfigurado, JANELA_MS } from '@/lib/atendente/whatsapp-api';
import { modeloAprovado } from '@/lib/atendente/modelos';
import { enviarEmail, emailConfigurado } from '@/lib/atendente/email';
import { SITE_URL } from '@/lib/seo';
import { chaveDoBotao, linkDaCentral, linksDoContexto, registrarDecisao, tipoDoBotao } from '@/lib/atendente/central-decisoes';

export const MODELO_DO_AVISO = 'aviso_ao_arthur';

/** Mesmo número com ou sem o 9 (o WhatsApp manda os celulares do Brasil sem ele). */
export function mesmoTelefone(a: string | null | undefined, b: string | null | undefined): boolean {
  const chave = (t: string) => {
    const d = t.replace(/\D/g, '');
    const nacional = d.startsWith('55') && d.length >= 12 ? d.slice(2) : d;
    return `${nacional.slice(0, 2)}${nacional.slice(-8)}`;
  };
  return !!a && !!b && a.replace(/\D/g, '').length >= 10 && chave(a) === chave(b);
}

type Dono = { whatsapp: string | null; janelaAte: number; modeloAprovado: boolean };

async function lerDono(db: DbDoAtendente): Promise<Dono> {
  const { data } = await db
    .from('ia_config')
    .select('owner_whatsapp, owner_last_inbound_at, aviso_template_status')
    .eq('id', true)
    .maybeSingle();
  return {
    whatsapp: data?.owner_whatsapp?.replace(/\D/g, '') || null,
    janelaAte: data?.owner_last_inbound_at ? new Date(data.owner_last_inbound_at).getTime() + JANELA_MS : 0,
    modeloAprovado: data?.aviso_template_status === 'APPROVED',
  };
}

/** Rótulo do botão do aviso pelo destino do link (até 20 caracteres). */
function rotuloDoLink(link: string): string {
  if (link.includes('/decisoes')) return 'Abrir decisões';
  if (link.includes('/ideias')) return 'Abrir Ideias';
  if (link.includes('/reunioes')) return 'Abrir reunião';
  if (link.includes('conversa=')) return 'Abrir conversa';
  if (link.includes('/gastos')) return 'Abrir Gastos';
  if (link.includes('/pos-venda')) return 'Abrir Pós-venda';
  if (link.includes('/captacao')) return 'Abrir Captação';
  return 'Abrir';
}

const linkDaConversa = (conversaId: string | null) =>
  conversaId ? `${SITE_URL}/admin/atendimento?conversa=${conversaId}` : `${SITE_URL}/admin/atendimento`;

/** Avisa o Arthur pelo melhor canal disponível e registra o aviso. Nunca lança erro. */
export async function avisarArthur(
  db: DbDoAtendente,
  cfg: ConfigDoAtendente,
  a: {
    titulo: string;
    texto: string;
    conversaId?: string | null;
    leadId?: string | null;
    link?: string;
    /**
     * Decisão do Arthur com botões (pedido de 30/10/2026): dentro das 24 h, mensagem interativa com
     * até 3 opções; fora, o modelo decisao_arthur ("Sim" = 1ª opção, "Não" = 2ª). O toque volta pelo
     * webhook com o id da opção (decisoes.ts).
     */
    opcoes?: { id: string; titulo: string }[];
    pergunta?: string;
    /** Pedido da fila que este aviso conclui (0109): responder o aviso no WhatsApp continua esse pedido. */
    ideiaId?: string | null;
    /** Card já criado na central de decisões (0117): o botão do aviso vira "Abrir decisões" no card. */
    decisaoId?: string | null;
  }
): Promise<void> {
  try {
    const dono = await lerDono(db);
    // Decisão com botões (0117): vira card na central, com as mesmas opções, e o aviso ganha "Abrir decisões".
    let decisaoId = a.decisaoId ?? null;
    if (!decisaoId && a.opcoes?.length) {
      const { tipo, origem } = tipoDoBotao(a.opcoes[0].id);
      let cliente: string | null = null;
      if (a.leadId) cliente = (await db.from('leads').select('name').eq('id', a.leadId).maybeSingle()).data?.name ?? null;
      decisaoId = await registrarDecisao(db, {
        chave: chaveDoBotao(a.opcoes[0].id),
        tipo,
        origem,
        titulo: a.titulo,
        resumo: a.texto,
        pergunta: a.pergunta ?? null,
        contexto: { cliente, links: linksDoContexto(a.conversaId, a.leadId) },
        opcoes: a.opcoes,
        conversaId: a.conversaId ?? null,
        leadId: a.leadId ?? null,
        ideiaId: a.ideiaId ?? null,
      });
    }
    const link = decisaoId && !a.opcoes?.length ? linkDaCentral(decisaoId) : (a.link ?? linkDaConversa(a.conversaId ?? null));
    const base = { titulo: a.titulo, texto: a.texto, conversation_id: a.conversaId ?? null, lead_id: a.leadId ?? null, ideia_id: a.ideiaId ?? null };

    if (dono.whatsapp && whatsappConfigurado() && a.opcoes?.length) {
      const pergunta = a.pergunta ? `\n\n❓ ${a.pergunta}` : '';
      if (Date.now() < dono.janelaAte) {
        const r = await enviarComOpcoes(
          dono.whatsapp,
          `🔔 *${a.titulo}*\n${a.texto}${pergunta}\n\n${link}`,
          a.opcoes.map((o) => o.titulo),
          a.opcoes.map((o) => o.id),
        );
        await db.from('ia_avisos').insert({ ...base, via: 'texto', ...(r.ok ? { external_id: r.id, status: 'sent' } : { status: 'failed', error: r.erro }) });
        if (r.ok) {
          // Os botões rápidos continuam; o card da central vem logo abaixo, com contexto e resposta livre.
          if (decisaoId) await enviarComLink(dono.whatsapp, '📋 Também está na *central de decisões*, com o contexto e espaço para responder do seu jeito.', linkDaCentral(decisaoId), 'Abrir decisões');
          return;
        }
      }
      if (a.opcoes.length >= 2 && (await modeloAprovado(db, 'decisao_arthur'))) {
        const r = await enviarModelo(dono.whatsapp, 'decisao_arthur', [`${a.titulo}: ${a.texto} ${a.pergunta ?? ''}`.trim()], [a.opcoes[0].id, a.opcoes[1].id]);
        await db.from('ia_avisos').insert({ ...base, via: 'modelo', ...(r.ok ? { external_id: r.id, status: 'sent' } : { status: 'failed', error: r.erro }) });
        if (r.ok) return;
      }
    }

    if (dono.whatsapp && whatsappConfigurado()) {
      if (Date.now() < dono.janelaAte) {
        // Botão "Abrir" no lugar do link colado (a prévia automática vinha borrada); sem botão, texto com o link.
        // A mensagem com botão aceita até 1024 caracteres: texto maior (ex.: Bom dia) vai inteiro e o botão logo depois.
        const corpo = `🔔 *${a.titulo}*\n${a.texto}`;
        let r =
          corpo.length <= 1024
            ? await enviarComLink(dono.whatsapp, corpo, link, rotuloDoLink(link))
            : await enviarTexto(dono.whatsapp, corpo);
        if (r.ok && corpo.length > 1024) await enviarComLink(dono.whatsapp, '👇 Para abrir no painel:', link, rotuloDoLink(link));
        if (!r.ok) r = await enviarTexto(dono.whatsapp, `🔔 *${a.titulo}*\n${a.texto}\n\n${link}`);
        await db.from('ia_avisos').insert({ ...base, via: 'texto', ...(r.ok ? { external_id: r.id, status: 'sent' } : { status: 'failed', error: r.erro }) });
        if (r.ok) return;
      }
      if (dono.modeloAprovado) {
        const r = await enviarModelo(dono.whatsapp, MODELO_DO_AVISO, [`${a.titulo}: ${a.texto}`]);
        await db.from('ia_avisos').insert({ ...base, via: 'modelo', ...(r.ok ? { external_id: r.id, status: 'sent' } : { status: 'failed', error: r.erro }) });
        if (r.ok) return;
      }
    }

    if (cfg.ownerEmail && emailConfigurado()) {
      const r = await enviarEmail({
        para: cfg.ownerEmail,
        assunto: `[Atendente] ${a.titulo}`,
        texto: `${a.texto}\n\nAbrir: ${link}`,
        nomeDoRemetente: `${cfg.personaName} (atendente)`,
      });
      await db.from('ia_avisos').insert({ ...base, via: 'email', ...(r.ok ? { status: 'sent' } : { status: 'failed', error: r.erro }) });
      if (r.ok) return;
    }
    // Nenhum canal funcionou: fica registrado no painel (lista de avisos).
    await db.from('ia_avisos').insert({ ...base, via: 'nenhum', status: 'failed', error: 'Sem canal disponível' });
  } catch (e) {
    console.error('[avisos] falha ao avisar o Arthur', e);
  }
}

/**
 * Aviso em texto livre que a Meta recusou (janela fechada, erro 131047): se o
 * modelo está aprovado, manda de novo por ele. Chamado pelo webhook de status.
 */
export async function reenviarAvisoPeloModelo(db: DbDoAtendente, externalId: string): Promise<void> {
  const { data: aviso } = await db.from('ia_avisos').select('*').eq('external_id', externalId).maybeSingle();
  if (!aviso || aviso.via !== 'texto') return;
  const dono = await lerDono(db);
  if (!dono.whatsapp || !dono.modeloAprovado) return;
  const r = await enviarModelo(dono.whatsapp, MODELO_DO_AVISO, [`${aviso.titulo}: ${aviso.texto}`]);
  await db.from('ia_avisos').insert({
    titulo: aviso.titulo,
    texto: aviso.texto,
    conversation_id: aviso.conversation_id,
    lead_id: aviso.lead_id,
    via: 'modelo',
    ...(r.ok ? { external_id: r.id, status: 'sent' } : { status: 'failed', error: r.erro }),
  });
}

/**
 * Cria o modelo do aviso na Meta (uma vez) e acompanha a aprovação. Roda no
 * relógio; precisa do id da conta do WhatsApp Business, que o webhook grava.
 */
export async function garantirModeloDoAviso(db: DbDoAtendente): Promise<string | null> {
  if (!whatsappConfigurado()) return null;
  const { data: c } = await db.from('ia_config').select('waba_id, aviso_template_status').eq('id', true).maybeSingle();
  if (!c?.waba_id || c.aviso_template_status === 'APPROVED') return c?.aviso_template_status ?? null;
  let status = await statusDoModelo(c.waba_id, MODELO_DO_AVISO);
  if (!status) {
    const r = await criarModelo(c.waba_id, {
      name: MODELO_DO_AVISO,
      language: 'pt_BR',
      category: 'UTILITY',
      components: [
        {
          type: 'BODY',
          text: 'Aviso da atendente: {{1}}\n\nVeja os detalhes no painel da Captação.',
          example: { body_text: [['Felipe Sousa pediu exemplos de sites antes de fechar o Site Essencial']] },
        },
      ],
    });
    status = r.ok ? (r.status ?? 'PENDING') : `ERRO: ${r.erro}`.slice(0, 200);
  }
  if (status !== c.aviso_template_status) await db.from('ia_config').update({ aviso_template_status: status }).eq('id', true);
  return status;
}
