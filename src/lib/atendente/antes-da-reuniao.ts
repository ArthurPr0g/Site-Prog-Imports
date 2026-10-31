// Antes de cada reunião (pedido do Arthur, 31/10/2026, 0117). Só no servidor; roda no relógio a cada minuto.
//  - ~15 min antes: resumo do cliente ao Arthur (pesquisa, conversa com a Lia, pacote, próximos passos, sala).
//  - ~10 min antes: lembrete ao CLIENTE com o link da sala. Dentro das 24 h, texto livre; fora, o modelo
//    lembrete_reuniao (aprovado). O lembrete de ~2 h (lembrete-reuniao.ts) continua igual; este só acrescenta.
// Uma vez cada: a marca fica na reunião (resumo_arthur_em, lembrete_10min_em) antes de mandar.

import type { DbDoAtendente } from './db';
import type { ConfigDoAtendente } from './regras';
import { avisarArthur } from './avisos';
import { enviarTexto, JANELA_MS } from './whatsapp-api';
import { enviarModeloAoCliente } from './modelos';
import { SIMULADOR } from './agente';
import { semTipos } from './central-decisoes';
import { linkDaSalaDoArthur, linkDoCliente } from '@/lib/reunioes/sala';
import { atualizacoesDoJson, pendenciasDoJson } from '@/lib/pre-venda';

const MIN = 60_000;
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
const corta = (t: string | null | undefined, n: number) => (t ? (t.length > n ? t.slice(0, n - 1) + '…' : t) : '');
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type Reuniao = { id: string; titulo: string; inicio: string; meet_link: string | null; sala_token: string | null; conversation_id: string | null; lead_id: string | null };

export async function antesDasReunioes(db: DbDoAtendente, cfg: ConfigDoAtendente): Promise<{ resumos: number; lembretes: number }> {
  const agora = Date.now();
  const t = semTipos(db);
  let resumos = 0;
  let lembretes = 0;

  // 1. Resumo ao Arthur, ~15 min antes (janela de 5 a 16 min, para não perder se um minuto do relógio falhar).
  const { data: paraResumo } = await t
    .from('reunioes')
    .select('id, titulo, inicio, meet_link, sala_token, conversation_id, lead_id')
    .eq('status', 'marcada')
    .is('resumo_arthur_em', null)
    .gte('inicio', new Date(agora + 5 * MIN).toISOString())
    .lte('inicio', new Date(agora + 16 * MIN).toISOString())
    .limit(3);
  for (const r of (paraResumo ?? []) as Reuniao[]) {
    await t.from('reunioes').update({ resumo_arthur_em: new Date().toISOString() }).eq('id', r.id);
    await avisarArthur(db, cfg, {
      titulo: `📅 Reunião às ${hora(r.inicio)}: ${corta(r.titulo, 80)}`,
      texto: await resumoDoCliente(db, r),
      leadId: r.lead_id,
      conversaId: r.conversation_id,
      link: r.sala_token ? linkDaSalaDoArthur(r.id) : (r.meet_link ?? linkDaSalaDoArthur(r.id)),
    });
    resumos++;
  }

  // 2. Lembrete ao cliente, ~10 min antes (janela de 3 a 11 min).
  const { data: paraLembrar } = await t
    .from('reunioes')
    .select('id, titulo, inicio, meet_link, sala_token, conversation_id, lead_id, leads(name)')
    .eq('status', 'marcada')
    .is('lembrete_10min_em', null)
    .not('conversation_id', 'is', null)
    .gte('inicio', new Date(agora + 3 * MIN).toISOString())
    .lte('inicio', new Date(agora + 11 * MIN).toISOString())
    .limit(3);
  for (const r of (paraLembrar ?? []) as unknown as (Reuniao & { leads: { name: string } | null })[]) {
    await t.from('reunioes').update({ lembrete_10min_em: new Date().toISOString() }).eq('id', r.id);
    const { data: c } = await db.from('ia_conversations').select('contact_id, contact_name, last_inbound_at, is_test').eq('id', r.conversation_id!).maybeSingle();
    if (!c || c.contact_id.startsWith(SIMULADOR) || c.contact_id.includes('#')) continue;
    const nome = (c.contact_name ?? r.leads?.name ?? '').trim().split(/\s+/)[0] || 'tudo bem';
    const link = r.sala_token ? linkDoCliente(r.sala_token) : (r.meet_link ?? null);
    if (!link) continue;
    const janela = !!c.last_inbound_at && agora - new Date(c.last_inbound_at).getTime() < JANELA_MS - 5 * MIN;
    if (janela) {
      const texto = `Oi, ${nome}! ⏰ Nossa reunião começa em 10 minutos (${hora(r.inicio)}).\n\n🔗 Para entrar: ${link}\n\nTe espero lá!`;
      const e = await enviarTexto(c.contact_id, texto);
      await db.from('ia_messages').insert({
        conversation_id: r.conversation_id!,
        direction: 'out',
        author: 'ia',
        body: texto,
        ...(e.ok ? { external_id: e.id, status: 'sent' } : { status: 'failed', error: e.erro }),
      });
      if (e.ok) lembretes++;
    } else {
      const quando = `hoje às ${hora(r.inicio)} (começa em 10 minutos)`;
      const e = await enviarModeloAoCliente(db, r.conversation_id!, c.contact_id, 'lembrete_reuniao', [nome, quando, link]);
      if (e.ok) lembretes++;
    }
  }
  return { resumos, lembretes };
}

/** Resumo do cliente para o Arthur ler antes de entrar: só fatos do que está registrado. */
async function resumoDoCliente(db: DbDoAtendente, r: Reuniao): Promise<string> {
  const linhas: string[] = [];
  const { data: l } = r.lead_id
    ? await semTipos(db)
        .from('leads')
        .select('name, category, city, status, pesquisa, notes, atualizacoes_do_dono, closed_value')
        .eq('id', r.lead_id)
        .maybeSingle()
    : { data: null };
  if (l) linhas.push(`👤 *${l.name}*${l.category ? ` · ${l.category}` : ''}${l.city ? ` · ${l.city}` : ''} · etapa: ${l.status}`);

  const pesquisa = (l?.pesquisa ?? null) as { resumo?: unknown } | null;
  if (pesquisa && typeof pesquisa.resumo === 'string' && pesquisa.resumo.trim()) linhas.push(`🔎 *Pesquisa:* ${corta(pesquisa.resumo, 500)}`);

  const conversaId = r.conversation_id;
  if (conversaId) {
    const { data: c } = await db.from('ia_conversations').select('summary').eq('id', conversaId).maybeSingle();
    if (c?.summary) linhas.push(`💬 *Conversa com a Lia:* ${corta(c.summary, 600)}`);
  }

  if (r.lead_id) {
    const { data: p } = await semTipos(db).from('prevenda').select('*').eq('lead_id', r.lead_id).maybeSingle();
    const itens = Array.isArray(p?.itens) ? (p.itens as { tipo?: string; nome?: string; preco?: number }[]).filter((i) => i.tipo !== 'portfolio' && i.nome) : [];
    const pacote = [
      ...(itens.length ? [itens.map((i) => `${i.nome}${typeof i.preco === 'number' ? ` (${brl(i.preco)} de catálogo)` : ''}`).join(', ')] : []),
      ...(p?.valor_proposta ? [`valor combinado ${brl(Number(p.valor_proposta))}`] : []),
      ...(p?.valor_mensal ? [`mensalidade ${brl(Number(p.valor_mensal))}`] : []),
      ...(p?.desconto ? [`desconto ${brl(Number(p.desconto))}`] : []),
    ];
    if (pacote.length) linhas.push(`📦 *Pacote:* ${pacote.join(' · ')}`);
    const falta = pendenciasDoJson(p?.pendencias).filter((x) => !x.feito).map((x) => x.texto);
    if (falta.length) linhas.push(`📋 *Falta do cliente:* ${falta.slice(0, 5).join(', ')}`);

    const atualizacoes = atualizacoesDoJson(l?.atualizacoes_do_dono);
    const proximos = p?.proximo_passo
      ? [`${p.proximo_passo}${p.proximo_prazo ? ` (até ${String(p.proximo_prazo).split('-').reverse().join('/')})` : ''}`]
      : (atualizacoes.at(-1)?.proximosPassos ?? []).map((x) => `${x.oQue}${x.quem ? ` (${x.quem})` : ''}${x.quando ? ` · ${x.quando}` : ''}`);
    if (proximos.length) linhas.push(`➡️ *Próximos passos:* ${proximos.slice(0, 4).join('; ')}`);
  }

  linhas.push(r.sala_token ? '🎥 Sala própria pronta: toque no botão para entrar.' : r.meet_link ? `🎥 Google Meet: ${r.meet_link}` : '🎥 Ainda sem link da sala.');
  return linhas.length > 1 ? linhas.join('\n') : `${linhas.join('\n')}\nSem dados do cliente registrados (pesquisa, conversa ou pré-venda).`;
}
