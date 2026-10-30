import { NextRequest, NextResponse, after } from 'next/server';
import { dbDoAtendente, type DbDoAtendente } from '@/lib/atendente/db';
import { assinaturaValida, baixarMidia, lerWebhook, marcarLidaEDigitando, type MensagemRecebida } from '@/lib/atendente/whatsapp-api';
import { transcrever, transcricaoConfigurada } from '@/lib/atendente/transcricao';
import { responderConversa } from '@/lib/atendente/agente';
import { empresaDoTexto } from '@/lib/atendente/regras';
import { mesmoTelefone, reenviarAvisoPeloModelo } from '@/lib/atendente/avisos';
import { PEDIDO_DE_RELATORIO, relatorioDaCaptacao } from '@/lib/atendente/relatorio';
import { lerConfig } from '@/lib/atendente/agente';
import { enviarTexto } from '@/lib/atendente/whatsapp-api';
import { anotarDoDono, mandarCodigoDasIdeias, pedeCodigo } from '@/lib/atendente/ideias';
import { ehDoManual, repassarAoManual } from '@/lib/atendente/manual';
import { conversaDaEncomenda, temProjetoAtivo } from '@/lib/atendente/encomenda';
import { conversaDoPortfolio, segurarResposta } from '@/lib/atendente/portfolio';
import { ehDecisao, tratarDecisao } from '@/lib/atendente/decisoes';
import { kitDoVendedor, textoDaFila, relatorioDoVendedor, PEDIDO_DE_FILA, PEDIDO_DE_RELATORIO_DO_VENDEDOR } from '@/lib/atendente/fila-do-vendedor';

// Webhook do WhatsApp Cloud API (configurado no app da Meta).
// GET: verificação do endereço. POST: mensagens e status de entrega.
// Responde 200 na hora (a Meta reenvia se demorar) e a IA trabalha depois
// (after), esperando uns segundos: se o cliente mandar várias mensagens
// seguidas, só a última dispara a resposta.

export const maxDuration = 60;

const ESPERA_MS = 7000;

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(p.get('hub.challenge') ?? '', { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  const corpo = await req.text();
  if (!assinaturaValida(corpo, req.headers.get('x-hub-signature-256'))) {
    return new NextResponse('Assinatura inválida', { status: 401 });
  }
  let json: unknown;
  try {
    json = JSON.parse(corpo);
  } catch {
    return NextResponse.json({ ok: true });
  }
  const { mensagens, status, wabaId } = lerWebhook(json);
  const db = dbDoAtendente();

  // Id da conta do WhatsApp Business: o relógio precisa dele para criar o modelo do aviso ao Arthur.
  if (wabaId) await db.from('ia_config').update({ waba_id: wabaId }).eq('id', true).is('waba_id', null);

  for (const s of status) {
    await db.from('ia_messages').update({ status: s.status, error: s.erro }).eq('external_id', s.id);
    await db.from('ia_avisos').update({ status: s.status, error: s.erro }).eq('external_id', s.id);
    // Aviso em texto livre com a janela do Arthur fechada (131047): vai pelo modelo aprovado.
    if (s.status === 'failed' && s.codigo === 131047) await reenviarAvisoPeloModelo(db, s.id);
  }

  const { data: cfg } = await db.from('ia_config').select('owner_whatsapp').eq('id', true).maybeSingle();
  const paraResponder = new Map<string, string>();
  const audios: MensagemRecebida[] = [];
  for (const m of mensagens) {
    // PROVISÓRIO: número do Manual do Empreendedorismo Médico (Ian, LM) só é repassado à porta do Manual.
    // A Lia não responde nem grava nada dele (ver src/lib/atendente/manual.ts).
    if (ehDoManual(m.de)) {
      if (!m.reacao) after(() => repassarAoManual(m));
      continue;
    }
    // O Arthur escrevendo para o número da Lia (ex.: respondendo a um aviso) não é
    // lead: só abre a janela de 24 h para os próximos avisos saírem como texto.
    if (mesmoTelefone(m.de, cfg?.owner_whatsapp)) {
      await db.from('ia_config').update({ owner_last_inbound_at: m.quando }).eq('id', true);
      // Toque num botão de decisão (chamar cliente, financeiro, desconto, assumir conversa), 0095.
      if (ehDecisao(m)) {
        after(async () => {
          await marcarLidaEDigitando(m.id);
          await tratarDecisao(db, m);
        });
      } else if (PEDIDO_DE_RELATORIO.test(m.texto)) {
        // "relatório" / "como está a captação?": responde ao dono com funil, meta e custo da IA.
        const para = m.de;
        after(async () => {
          await marcarLidaEDigitando(m.id);
          const texto = await relatorioDaCaptacao(db, await lerConfig(db));
          const r = await enviarTexto(para, texto);
          await db.from('ia_avisos').insert({
            titulo: 'Relatório da captação',
            texto: texto.slice(0, 2000),
            via: 'texto',
            ...(r.ok ? { external_id: r.id, status: 'sent' } : { status: 'failed', error: r.erro }),
          });
        });
      } else if (pedeCodigo(m.texto)) {
        // "qual o código das ideias?": só responde ao dono (este bloco é do número dele).
        const para = m.de;
        after(async () => {
          await marcarLidaEDigitando(m.id);
          await mandarCodigoDasIdeias(db, para);
        });
      } else if (!m.reacao) {
        // Qualquer outra coisa (texto ou áudio) é ideia ou prompt para o Claude Code (0088).
        after(async () => {
          await marcarLidaEDigitando(m.id);
          await anotarDoDono(db, m);
        });
      }
      continue;
    }
    // Vendedor (Felipe) escrevendo para a Lia: abre a janela de 24 h para a fila do dia.
    // "fila" e "relatório" são pedidos dele; o resto segue para a Lia como cliente (testes).
    const kit = await kitDoVendedor(db, m.de);
    if (kit) {
      await db.from('lead_seller_kits').update({ ultima_msg_em: m.quando }).eq('id', kit.id);
      // Vendedor que também é cliente de um projeto (o Felipe no piloto): "Hoje eu uso planilha..." não pode
      // virar a fila do dia. Com projeto ativo, o comando só vale se a mensagem for só a palavra.
      const exato = /^\s*(fila|hoje|leads do dia|relat[oó]rio|meus n[uú]meros|placar)\s*[?!.]*\s*$/i.test(m.texto);
      const vale = exato || !(await temProjetoAtivo(db, m.de));
      const fila = vale && PEDIDO_DE_FILA.test(m.texto);
      if (fila || (vale && PEDIDO_DE_RELATORIO_DO_VENDEDOR.test(m.texto))) {
        const para = m.de;
        after(async () => {
          await marcarLidaEDigitando(m.id);
          const texto = fila ? (await textoDaFila(db, kit)).texto : await relatorioDoVendedor(db, kit);
          await enviarTexto(para, texto);
          if (fila) await db.from('lead_seller_kits').update({ fila_enviada_em: new Date().toISOString() }).eq('id', kit.id);
        });
        continue;
      }
    }
    const conversaId = await gravarRecebida(db, m, !!kit);
    // Reação (emoji numa mensagem) fica no histórico, mas não pede resposta.
    if (conversaId && !m.reacao) paraResponder.set(conversaId, m.id);
    if (conversaId && m.midia?.tipo === 'audio') audios.push(m);
  }

  if (paraResponder.size) {
    after(async () => {
      for (const id of paraResponder.values()) await marcarLidaEDigitando(id);
      // Áudio vira texto antes de a IA ler (o Claude não recebe áudio).
      for (const a of audios) await transcreverAudio(db, a);
      await new Promise((r) => setTimeout(r, ESPERA_MS));
      for (const [conversaId, msgId] of paraResponder) {
        // Chegou outra mensagem depois desta: a execução daquela responde tudo.
        const { data: ultima } = await db
          .from('ia_messages')
          .select('external_id')
          .eq('conversation_id', conversaId)
          .eq('direction', 'in')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (ultima?.external_id !== msgId) continue;
        // Formulário do portfólio (0111): a resposta espera a pesquisa e o pré-briefing (até ~10 min).
        if (await segurarResposta(db, conversaId)) continue;
        try {
          await responderConversa(conversaId);
        } catch (e) {
          console.error('[atendente] falha ao responder', conversaId, e);
        }
      }
    });
  }
  return NextResponse.json({ ok: true });
}

/** Grava a mensagem (uma vez só) e liga a conversa ao lead. Devolve a conversa, ou null se já existia. */
async function gravarRecebida(db: DbDoAtendente, m: MensagemRecebida, ehVendedor = false): Promise<string | null> {
  const { data: existente } = await db
    .from('ia_conversations')
    .select('id, lead_id, unread')
    .eq('channel', 'whatsapp')
    .eq('contact_id', m.de)
    .maybeSingle();

  let conversaId = existente?.id;
  let leadId = existente?.lead_id ?? null;
  // Cliente indicado pelo Arthur (0093) respondendo de um número escrito diferente (sem o 9).
  if (!conversaId) {
    const daEncomenda = await conversaDaEncomenda(db, m.de);
    if (daEncomenda) {
      const { data: c } = await db.from('ia_conversations').select('id, lead_id').eq('id', daEncomenda).maybeSingle();
      conversaId = c?.id;
      leadId = c?.lead_id ?? null;
    }
  }
  // Quem preencheu o formulário do portfólio (0111) escrevendo de um número sem o 9.
  if (!conversaId) {
    const doPortfolio = await conversaDoPortfolio(db, m.de);
    if (doPortfolio) {
      const { data: c } = await db.from('ia_conversations').select('id, lead_id').eq('id', doPortfolio).maybeSingle();
      conversaId = c?.id;
      leadId = c?.lead_id ?? null;
    }
  }
  if (!conversaId) {
    const achado = await acharLead(db, m);
    leadId = achado?.leadId ?? null;
    // Contato novo de verdade (não é lead da captação, indicação registrada nem vendedor): vira lead na hora,
    // para a Lia perguntar como a pessoa chegou e seguir o processo completo com pesquisa (0107, 30/10/2026).
    if (!leadId && !ehVendedor) leadId = await leadDoContatoNovo(db, m);
    const { data: nova, error } = await db
      .from('ia_conversations')
      .insert({
        channel: 'whatsapp',
        contact_id: m.de,
        contact_name: m.nome,
        lead_id: leadId,
        kit_id: achado?.kitId ?? null,
      })
      .select('id')
      .single();
    if (error || !nova) {
      // Corrida entre dois webhooks do mesmo contato: a outra execução criou.
      const { data: outra } = await db.from('ia_conversations').select('id').eq('contact_id', m.de).maybeSingle();
      if (!outra) return null;
      conversaId = outra.id;
    } else conversaId = nova.id;
  } else if (!leadId) {
    // Conversa que começou sem lead (ex.: o telefone só foi gravado no lead depois,
    // caso do Felipe em 28/10/2026): tenta ligar de novo a cada mensagem.
    const achado = await acharLead(db, m);
    if (achado) {
      leadId = achado.leadId;
      await db.from('ia_conversations').update({ lead_id: achado.leadId, kit_id: achado.kitId }).eq('id', conversaId).is('lead_id', null);
    }
  }

  const { error } = await db.from('ia_messages').insert({
    conversation_id: conversaId,
    direction: 'in',
    author: 'lead',
    body: m.texto,
    external_id: m.id,
    created_at: m.quando,
    media_type: m.midia?.tipo ?? null,
    media_id: m.midia?.id ?? null,
    media_mime: m.midia?.mime ?? null,
    media_name: m.midia?.nome ?? null,
  });
  if (error) return null; // webhook repetido (external_id único)

  await db
    .from('ia_conversations')
    .update({
      last_inbound_at: m.quando,
      last_message_at: m.quando,
      unread: (existente?.unread ?? 0) + 1,
      ...(m.nome ? { contact_name: m.nome } : {}),
    })
    .eq('id', conversaId);

  // O lead respondeu: sobe para "Respondeu" (nunca volta etapa).
  if (leadId) {
    const { data: l } = await db.from('leads').select('status, first_contact_at, replied_at').eq('id', leadId).maybeSingle();
    if (l && (l.status === 'novo' || l.status === 'contatado')) {
      await db
        .from('leads')
        .update({
          status: 'respondeu',
          first_contact_at: l.first_contact_at ?? m.quando,
          replied_at: l.replied_at ?? m.quando,
          next_contact: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);
    }
  }
  return conversaId;
}

/** Troca o "[o cliente mandou um áudio]" pela transcrição (ou por um aviso para a IA pedir texto). */
async function transcreverAudio(db: DbDoAtendente, m: MensagemRecebida): Promise<void> {
  const arquivo = m.midia ? await baixarMidia(m.midia.id) : null;
  const texto = arquivo ? await transcrever(arquivo.dados, arquivo.mime || m.midia!.mime) : null;
  const corpo = texto
    ? `[Áudio do cliente, transcrito] ${texto}`
    : transcricaoConfigurada()
      ? '[o cliente mandou um áudio que não consegui transcrever: peça com gentileza para escrever ou mandar de novo]'
      : '[o cliente mandou um áudio, mas ainda não consigo ouvir áudios: peça com gentileza para escrever]';
  await db.from('ia_messages').update({ body: corpo }).eq('external_id', m.id);
}

const digitos = (s: string | null) => (s ?? '').replace(/\D/g, '');

/** Lead de quem chamou a Lia primeiro sem ninguém ter mandado o contato antes (0107). */
async function leadDoContatoNovo(db: DbDoAtendente, m: MensagemRecebida): Promise<string | null> {
  const tel = digitos(m.de);
  // Mesmo telefone já é lead (com ou sem o 9)? Usa esse.
  const fim8 = tel.slice(-8);
  const { data: candidatos } = await db.from('leads').select('id, phone').ilike('phone', `%${fim8.slice(0, 4)}%${fim8.slice(4)}%`).limit(20);
  const mesmo = (candidatos ?? []).find((l) => digitos(l.phone).slice(-8) === fim8 && digitos(l.phone).slice(0, 4) === tel.slice(0, 4));
  if (mesmo) return mesmo.id;
  const nome = (m.nome ?? '').trim() || `Contato do WhatsApp (+${tel})`;
  const { data: l } = await db
    .from('leads')
    .insert({
      name: nome.slice(0, 120),
      responsible_name: (m.nome ?? '').trim().split(/\s+/)[0] || null,
      dedupe_key: `whatsapp:${tel}`,
      phone: tel,
      source: 'whatsapp_direto',
      status: 'respondeu',
      first_contact_at: m.quando,
      replied_at: m.quando,
      notes: `Chamou a Lia primeiro pelo WhatsApp em ${new Date(m.quando).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`,
    })
    .select('id')
    .single();
  return l?.id ?? null;
}

/**
 * Lead do contato novo: pelo texto do botão ("Vi o diagnóstico de <empresa>"),
 * preferindo os leads que estão com a IA; senão pelo telefone do Maps (últimos
 * 8 dígitos + DDD, que é o que sobra igual com ou sem o 9).
 */
async function acharLead(db: DbDoAtendente, m: MensagemRecebida): Promise<{ leadId: string; kitId: string | null } | null> {
  const { data: itens } = await db
    .from('lead_kit_items')
    .select('lead_id, kit_id, lead_seller_kits!inner(kind, active), leads!inner(name, phone)')
    .eq('lead_seller_kits.kind', 'ia')
    .eq('lead_seller_kits.active', true);

  const empresa = empresaDoTexto(m.texto)?.toLowerCase();
  if (empresa) {
    const it = (itens ?? []).find((i) => i.leads.name.trim().toLowerCase() === empresa);
    if (it) return { leadId: it.lead_id, kitId: it.kit_id };
  }
  const tel = digitos(m.de);
  const chave = (t: string) => {
    const nacional = t.startsWith('55') && t.length >= 12 ? t.slice(2) : t;
    return `${nacional.slice(0, 2)}${nacional.slice(-8)}`;
  };
  const it = (itens ?? []).find((i) => digitos(i.leads.phone).length >= 10 && chave(digitos(i.leads.phone)) === chave(tel));
  if (it) return { leadId: it.lead_id, kitId: it.kit_id };

  if (empresa) {
    const { data: l } = await db.from('leads').select('id').ilike('name', empresa).limit(1).maybeSingle();
    if (l) return { leadId: l.id, kitId: null };
  }
  return null;
}
