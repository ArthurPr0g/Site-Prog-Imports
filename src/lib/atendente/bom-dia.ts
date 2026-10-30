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

  const posVenda = await pendenciasDoPosVenda(db);
  if (posVenda.length) blocos.push(`📦 *Pós-venda*\n${posVenda.slice(0, 8).join('\n')}`);

  const gasto = (uso.data ?? []).reduce((s, u) => s + Number(u.cost_usd), 0);
  blocos.push(`📊 *Ontem:* ${novosLeads.count ?? 0} lead(s) novo(s) · ${conversas.count ?? 0} conversa(s) com clientes · IA US$ ${gasto.toFixed(2)}`);

  const { problemas } = await problemasAtuais(db, cfg, 'bom_dia');
  blocos.push(problemas.length ? `🩺 *Atenção*\n${problemas.map((p) => p.texto).join('\n')}` : '🩺 Sistema: tudo funcionando');

  await avisarArthur(db, cfg, { titulo: '☀️ Bom dia, Arthur', texto: `\n${blocos.join('\n\n')}`, link: `${SITE_URL}/admin/time` });
  return blocos.length;
}
