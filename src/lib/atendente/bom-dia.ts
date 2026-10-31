// "Bom dia" da Lia às 8h (pedido do Arthur em 30/10/2026: "tenho muitas funções e acabo esquecendo").
// Uma mensagem por dia no WhatsApp dele com o que importa hoje, na ordem em que ele age:
//  1. o que depende dele (decisões, pedidos parados, cliente chamando por ele);
//  2. agenda do dia;
//  3. o que os agentes terminaram desde ontem;
//  4. pendências do pós-venda (antes uma mensagem separada às 9h);
//  5. movimento da captação e gasto de ontem;
//  6. saúde do sistema.
// Sai entre 8h e 11h de Brasília, todo dia, uma vez (ia_config.bom_dia_em, 0105). Só no servidor.

import type { DbDoAtendente } from './db';
import type { ConfigDoAtendente } from './regras';
import { avisarArthur } from './avisos';
import { problemasAtuais } from './saude';
import { rotuloDoAgente } from '@/lib/agentes/time';
import { pendenciasDoPosVenda } from '@/lib/pos-venda-resumo';
import { SITE_URL } from '@/lib/seo';
import { contarPendentes, linkDaCentral, semTipos } from './central-decisoes';
import { buscarCotacaoMercado } from '@/lib/usd-rate';
import { usoDoMes } from '@/lib/reunioes/sala';

const HORA = 3600_000;
const hojeEmBrasilia = () => new Date(Date.now() - 3 * HORA).toISOString().slice(0, 10);
const horaEmBrasilia = () =>
  Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }).format(new Date()));
/** Meia-noite de um dia de Brasília (UTC−3), em ISO. */
const meiaNoite = (dia: string) => new Date(`${dia}T03:00:00.000Z`).toISOString();

export async function bomDia(db: DbDoAtendente, cfg: ConfigDoAtendente, forcar = false): Promise<number> {
  const hoje = hojeEmBrasilia();
  if (!forcar) {
    const h = horaEmBrasilia();
    if (h < 8 || h >= 11) return 0;
    const { data: c } = await db.from('ia_config').select('bom_dia_em').eq('id', true).maybeSingle();
    if (c?.bom_dia_em === hoje) return 0;
    // Marca antes: o próximo tick não manda de novo.
    await db.from('ia_config').update({ bom_dia_em: hoje }).eq('id', true);
  }
  const ontem = new Date(Date.parse(meiaNoite(hoje)) - 24 * HORA).toISOString();
  const amanha = new Date(Date.parse(meiaNoite(hoje)) + 24 * HORA).toISOString();
  const desde18h = new Date(Date.now() - 18 * HORA).toISOString();

  const [encomendas, semFinanceiro, ideiasSemProjeto, descontos, chamando, esperando, reunioes, terminados, novosLeads, conversas, uso] = await Promise.all([
    db.from('encomendas').select('nome, telefone, status').in('status', ['aguardando_confirmacao', 'aguardando_resposta']).limit(10),
    db.from('encomendas').select('nome, telefone').is('pagamento', null).in('status', ['contatado', 'aguardando_modelo']).limit(10),
    db.from('ideias').select('titulo').eq('status', 'aguardando_projeto').limit(10),
    db.from('ia_discount_requests').select('id', { count: 'exact', head: true }).eq('status', 'aguardando'),
    db.from('ia_conversations').select('contact_name').eq('needs_human', true).eq('is_test', false).not('contact_id', 'like', 'simulador:%').limit(10),
    db.from('ideias').select('titulo, agente').eq('tipo', 'prompt').in('status', ['feito', 'parcial']).ilike('resultado', '%Aguardando você:%').not('resultado', 'ilike', '%[resolvido%').gte('atualizado_em', new Date(Date.now() - 72 * HORA).toISOString()).limit(8),
    db.from('reunioes').select('titulo, inicio').eq('status', 'marcada').gte('inicio', meiaNoite(hoje)).lt('inicio', amanha).order('inicio'),
    db.from('ideias').select('titulo, agente, status').eq('tipo', 'prompt').in('status', ['feito', 'parcial']).gte('atualizado_em', desde18h).order('atualizado_em', { ascending: false }).limit(8),
    db.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', ontem).lt('created_at', meiaNoite(hoje)).not('source', 'like', 'teste%'),
    db.from('ia_conversations').select('id', { count: 'exact', head: true }).gte('last_inbound_at', ontem).lt('last_inbound_at', meiaNoite(hoje)).eq('is_test', false),
    db.from('ia_usage').select('cost_usd').gte('created_at', ontem).lt('created_at', meiaNoite(hoje)).limit(20000),
  ]);
  const quem = (e: { nome: string | null; telefone: string | null }) => e.nome ?? e.telefone ?? 'contato';

  const blocos: string[] = [];
  const comVoce: string[] = [
    ...(encomendas.data ?? []).map((e) => `• ${quem(e)}: ${e.status === 'aguardando_confirmacao' ? 'confirmar se a Lia pode chamar' : 'responder uma dúvida da Lia'}`),
    ...(semFinanceiro.data ?? []).map((e) => `• ${quem(e)}: dizer como está o financeiro`),
    ...(ideiasSemProjeto.data ?? []).map((i) => `• Pedido "${i.titulo ?? 'sem título'}": escolher o projeto`),
    ...(descontos.count ? [`• ${descontos.count} pedido(s) de desconto esperando você`] : []),
    ...(chamando.data ?? []).map((c) => `• ${c.contact_name ?? 'Cliente'} pediu para falar com você`),
    ...(esperando.data ?? []).map((i) => `• ${rotuloDoAgente(i.agente) ?? 'Claude'}: "${i.titulo ?? 'pedido'}" espera algo seu`),
  ];
  blocos.push(comVoce.length ? `🧭 *Com você hoje*\n${comVoce.slice(0, 10).join('\n')}` : '🧭 *Com você hoje:* nada pendente 🙌');

  const agenda = (reunioes.data ?? []).map(
    (r) => `• ${new Date(r.inicio).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })} ${r.titulo}`,
  );
  if (agenda.length) blocos.push(`📅 *Agenda*\n${agenda.join('\n')}`);

  const feitos = (terminados.data ?? []).map((i) => `• ${i.status === 'feito' ? '✅' : '⏳'} ${rotuloDoAgente(i.agente) ? `${rotuloDoAgente(i.agente)}: ` : ''}${i.titulo ?? 'pedido'}`);
  if (feitos.length) blocos.push(`🤖 *Terminado desde ontem*\n${feitos.join('\n')}`);

  // Pré-venda (0117): propostas esperando resposta e leads parados (só fatos: dias desde o último movimento).
  const preVenda = await resumoDaPreVenda(db);
  if (preVenda.length) blocos.push(`🤝 *Pré-venda*\n${preVenda.join('\n')}`);

  // Ajustes de clientes em andamento (rodadas abertas do pós-venda).
  const { data: ajustes } = await semTipos(db).from('rodadas').select('numero, pedido, pedido_em, projetos(cliente)').eq('status', 'aberta').order('pedido_em', { ascending: true }).limit(8);
  const linhasDeAjuste = ((ajustes ?? []) as unknown as { numero: number; pedido: string | null; pedido_em: string | null; projetos: { cliente: string | null } | null }[]).map(
    (a) => `• ${a.projetos?.cliente ?? 'Cliente'} · ajuste ${a.numero}${a.pedido ? `: ${a.pedido.length > 70 ? a.pedido.slice(0, 69) + '…' : a.pedido}` : ''}${a.pedido_em ? ` (desde ${new Date(a.pedido_em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })})` : ''}`,
  );
  if (linhasDeAjuste.length) blocos.push(`🛠️ *Ajustes em andamento*\n${linhasDeAjuste.join('\n')}`);

  // Central de decisões: quantas esperam você (o botão do aviso abre a central quando houver alguma).
  const decisoes = await contarPendentes(db).catch(() => 0);
  blocos.push(decisoes ? `🗳️ *Decisões pendentes:* ${decisoes} (toque em *Abrir decisões*)` : '🗳️ *Decisões pendentes:* nenhuma');

  const posVenda = await pendenciasDoPosVenda(db);
  if (posVenda.length) blocos.push(`📦 *Pós-venda*\n${posVenda.slice(0, 8).join('\n')}`);

  const gasto = (uso.data ?? []).reduce((s, u) => s + Number(u.cost_usd), 0);
  const cot = await buscarCotacaoMercado().catch(() => null);
  const emReais = cot?.ok ? ` (R$ ${(gasto * cot.cotacao.valor).toFixed(2).replace('.', ',')})` : '';
  blocos.push(`📊 *Ontem:* ${novosLeads.count ?? 0} lead(s) novo(s) · ${conversas.count ?? 0} conversa(s) com clientes · IA US$ ${gasto.toFixed(2)}${emReais}`);

  const limites = await alertasDeLimites(db);
  if (limites.length) blocos.push(`📏 *Limites*\n${limites.join('\n')}`);

  const { problemas } = await problemasAtuais(db, cfg, 'bom_dia');
  blocos.push(problemas.length ? `🩺 *Atenção*\n${problemas.map((p) => p.texto).join('\n')}` : '🩺 Sistema: tudo funcionando');

  await avisarArthur(db, cfg, { titulo: '☀️ Bom dia, Arthur', texto: `\n${blocos.join('\n\n')}`, link: decisoes ? linkDaCentral() : `${SITE_URL}/admin/time` });
  return blocos.length;
}

const DIA = 24 * HORA;
const diasDesde = (iso: string | null | undefined) => (iso ? Math.floor((Date.now() - Date.parse(iso)) / DIA) : null);

/** Propostas esperando resposta e leads em negociação parados há mais de 3 dias (mesmo critério da Pré-venda). */
async function resumoDaPreVenda(db: DbDoAtendente): Promise<string[]> {
  const { data: leads } = await db
    .from('leads')
    .select('id, name, status, source, last_contact_at, replied_at, updated_at')
    .in('status', ['respondeu', 'reuniao', 'proposta'])
    .limit(200);
  const reais = (leads ?? []).filter((l) => !(l.source ?? '').startsWith('teste'));
  if (!reais.length) return [];
  const ids = reais.map((l) => l.id);
  const [{ data: pv }, { data: convs }] = await Promise.all([
    semTipos(db).from('prevenda').select('lead_id, proposta_enviada_em, updated_at').in('lead_id', ids),
    db.from('ia_conversations').select('lead_id, last_message_at').in('lead_id', ids),
  ]);
  const prevenda = new Map(((pv ?? []) as { lead_id: string; proposta_enviada_em: string | null; updated_at: string | null }[]).map((p) => [p.lead_id, p]));
  const ultimaConversa = new Map<string, string>();
  for (const c of convs ?? []) if (c.lead_id && c.last_message_at && (ultimaConversa.get(c.lead_id) ?? '') < c.last_message_at) ultimaConversa.set(c.lead_id, c.last_message_at);

  const propostas = reais
    .filter((l) => l.status === 'proposta')
    .map((l) => {
      const d = diasDesde(prevenda.get(l.id)?.proposta_enviada_em);
      return `• ${l.name}: proposta ${d === null ? 'enviada (sem data registrada)' : d === 0 ? 'enviada hoje' : `enviada há ${d} dia(s)`}`;
    });
  const parados = reais
    .map((l) => {
      const ultimo = [l.last_contact_at, l.replied_at, l.updated_at, ultimaConversa.get(l.id), prevenda.get(l.id)?.updated_at].filter(Boolean).sort().at(-1) as string | undefined;
      return { l, dias: diasDesde(ultimo) };
    })
    .filter((x) => x.dias !== null && x.dias > 3)
    .sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0))
    .map((x) => `• ${x.l.name} (${x.l.status}): parado há ${x.dias} dias`);
  return [
    ...(propostas.length ? [`Propostas esperando resposta: ${propostas.length}`, ...propostas.slice(0, 5)] : []),
    ...(parados.length ? [`Leads parados: ${parados.length}`, ...parados.slice(0, 5)] : []),
  ];
}

/** Minutos da Daily, créditos do ElevenLabs e armazenamento do Supabase (só o que der para medir). */
async function alertasDeLimites(db: DbDoAtendente): Promise<string[]> {
  const r: string[] = [];
  const pct = (n: number) => `${Math.floor(n)}%`;
  try {
    const u = await usoDoMes(db);
    r.push(`${u.pct >= 70 ? '⚠️' : '•'} Daily: ${Math.round(u.minutos).toLocaleString('pt-BR')} de ${u.limites.reunioes_minutos_gratis.toLocaleString('pt-BR')} min grátis do mês (${pct(u.pct)})`);
  } catch {
    /* sem medição */
  }
  const chave = process.env.ELEVENLABS_API_KEY;
  if (chave) {
    try {
      const resp = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': chave }, signal: AbortSignal.timeout(10_000), cache: 'no-store' });
      if (resp.ok) {
        const j = (await resp.json()) as { character_count?: number; character_limit?: number };
        const usados = Number(j.character_count ?? 0);
        const limite = Number(j.character_limit ?? 0);
        if (limite > 0) {
          const p = (usados / limite) * 100;
          r.push(`${p >= 80 ? '⚠️' : '•'} ElevenLabs (voz): ${usados.toLocaleString('pt-BR')} de ${limite.toLocaleString('pt-BR')} caracteres (${pct(p)})`);
        }
      }
    } catch {
      /* API fora */
    }
  }
  try {
    const { data } = await semTipos(db).rpc('uso_do_armazenamento');
    const u = data as { banco?: number; buckets?: { bytes?: number }[] } | null;
    if (u) {
      const arquivos = (u.buckets ?? []).reduce((s, b) => s + Number(b.bytes ?? 0), 0);
      const pA = (arquivos / 1024 ** 3) * 100;
      const pB = (Number(u.banco ?? 0) / (500 * 1024 ** 2)) * 100;
      r.push(`${pA >= 80 || pB >= 80 ? '⚠️' : '•'} Armazenamento: arquivos ${pct(pA)} de 1 GB · banco ${pct(pB)} de 500 MB`);
    }
  } catch {
    /* função indisponível */
  }
  return r;
}
