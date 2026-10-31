// Fim da reunião na sala (Fase 1, 31/10/2026). Só no servidor; roda depois da resposta (after()).
// 1. Transcrição completa (trechos em ordem) e minutos de participante (Daily).
// 2. A mesma lógica do "Atualizar a negociação" (negociacao.ts): notas, briefing, etapa, aviso interno à Lia e o
//    resumo no WhatsApp do Arthur, com os botões de sempre. Nada vai ao cliente.
// 3. Custo da reunião: IA (ia_usage, finalidade 'reuniao'), transcrição (preço/hora da configuração) e minutos
//    da Daily acima do grátis do mês.

import type { DbDoAtendente } from '@/lib/atendente/db';
import { processar } from '@/lib/atendente/negociacao';
import { avisarArthur } from '@/lib/atendente/avisos';
import { lerConfig } from '@/lib/atendente/agente';
import { apagarSalaDaily, minutosDaDaily } from './daily';
import { linkDaSalaDoArthur, usoDoMes } from './sala';
import { transcricaoEmTexto, type Trecho } from './comum';

/** Segundos de áudio que cada trecho representa (o navegador manda a cada ~15 s). */
export const SEGUNDOS_POR_TRECHO = 15;

export async function processarReuniao(db: DbDoAtendente, id: string): Promise<void> {
  const { data: r } = await db
    .from('reunioes')
    .select('id, titulo, lead_id, conversation_id, sala_meio, sala_nome, inicio_em, fim_em, trechos, leads(name)')
    .eq('id', id)
    .maybeSingle();
  if (!r) return;
  const trechos = (Array.isArray(r.trechos) ? r.trechos : []) as Trecho[];
  const transcricao = transcricaoEmTexto(trechos);
  await db.from('reunioes').update({ transcricao: transcricao.slice(0, 400000), processamento: 'processando' }).eq('id', id);

  // Minutos de participante: apaga a sala (quem sobrou sai e não gasta mais) e soma as sessões dela.
  let minutos: number | null = null;
  if (r.sala_meio === 'daily' && r.sala_nome) {
    await apagarSalaDaily(r.sala_nome);
    const de = new Date(new Date(r.inicio_em ?? Date.now()).getTime() - 3 * 3600_000);
    const m = await minutosDaDaily(de, new Date(Date.now() + 60_000), r.sala_nome);
    if (m) minutos = Math.round(m.total * 100) / 100;
  }

  // Mesma lógica do "Atualizar a negociação": a transcrição é o relato.
  const comecou = new Date().toISOString();
  let resumo: string | null = null;
  let erro = false;
  if (transcricao.replace(/\[[^\]]*\]\s*(Arthur|Cliente):/g, '').trim().length >= 40) {
    const { data: cfg } = await db.from('ia_config').select('owner_whatsapp').eq('id', true).maybeSingle();
    const dono = (cfg?.owner_whatsapp ?? '').replace(/\D/g, '') || '0';
    const quando = new Date(r.inicio_em ?? Date.now()).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
    const { data: sessao } = await db
      .from('negociacao_sessoes')
      .insert({
        dono,
        status: 'aguardando_conteudo',
        pedido: `Sala de reunião: ${r.titulo}`.slice(0, 8000),
        lead_id: r.lead_id,
        conversation_id: r.conversation_id,
        conteudo:
          `[Transcrição automática da reunião na sala da Prog Soluções, ${quando}. "Arthur:" é o Arthur; "Cliente:" é o cliente. ` +
          `Pode ter erros de transcrição.]\n${transcricao}`.slice(0, 60000),
        ultima_parte_em: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (sessao) {
      await processar(db, sessao.id, { daSala: linkDaSalaDoArthur(id) });
      const { data: s } = await db.from('negociacao_sessoes').select('status, resultado').eq('id', sessao.id).maybeSingle();
      resumo = ((s?.resultado ?? null) as { resumo?: string } | null)?.resumo ?? null;
      erro = s?.status !== 'concluida';
    } else erro = true;
  }

  // Custo: IA medida + transcrição (preço/hora configurado) + Daily acima do grátis.
  const [{ data: usos }, uso] = await Promise.all([
    db.from('ia_usage').select('cost_usd').eq('finalidade', 'reuniao').gte('created_at', comecou),
    usoDoMes(db),
  ]);
  const { data: cfgCustos } = await db.from('ia_config').select('custos').eq('id', true).maybeSingle();
  const porHora = Number((cfgCustos?.custos as { transcricao_usd_hora?: number } | null)?.transcricao_usd_hora ?? 0);
  const iaUsd = (usos ?? []).reduce((s, u) => s + Number(u.cost_usd), 0);
  const transcricaoUsd = (trechos.length * SEGUNDOS_POR_TRECHO * porHora) / 3600;
  const acimaDoGratis = Math.max(0, uso.minutos - uso.limites.reunioes_minutos_gratis);
  const dailyUsd = Math.min(minutos ?? 0, acimaDoGratis) * uso.limites.reunioes_usd_minuto;

  await db
    .from('reunioes')
    .update({
      ...(minutos !== null ? { minutos_participante: minutos } : {}),
      ...(resumo ? { resumo: resumo.slice(0, 20000) } : {}),
      custo_usd: Math.round((iaUsd + transcricaoUsd + dailyUsd) * 10000) / 10000,
      processamento: erro ? 'erro' : 'feito',
      status: 'realizada',
    })
    .eq('id', id);

  const nome = r.leads?.name ?? r.titulo;
  const duracao = r.inicio_em && r.fim_em ? Math.max(1, Math.round((new Date(r.fim_em).getTime() - new Date(r.inicio_em).getTime()) / 60_000)) : null;
  await avisarArthur(db, await lerConfig(db), {
    titulo: `Reunião encerrada: ${nome}`,
    texto: [
      [duracao ? `${duracao} min` : null, `${trechos.length} trecho(s) transcritos`, minutos !== null ? `${Math.round(minutos)} min de participante na Daily` : null]
        .filter(Boolean)
        .join(' · ') + '.',
      resumo ? `Resumo: ${resumo.slice(0, 600)}` : trechos.length ? (erro ? 'A IA não processou a transcrição: abra a reunião e toque em Processar de novo.' : '') : 'Sem transcrição (ninguém falou ou o microfone não foi captado).',
    ]
      .filter(Boolean)
      .join('\n'),
    leadId: r.lead_id,
    conversaId: r.conversation_id,
    link: linkDaSalaDoArthur(id),
  });
}
