import type { SupabaseClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { dbDoAtendente } from '@/lib/atendente/db';
import { escolhaDoJson } from '@/lib/pos-venda';
import { NOMES } from '@/lib/simulador';
import { LEAD_STATUS_LABEL, type LeadStatus } from '@/lib/captacao';
import { URL_PUBLICA } from '@/lib/seo';
import { linkDoCliente, pastaDoCliente, prepararSala } from '@/lib/reunioes/sala';
import { SalaDoArthur, type DadosDaSala } from '@/components/reunioes/SalaDoArthur';
import { baloesVivos, type Balao, type Trecho } from '@/lib/reunioes/comum';

// Sala do Arthur (31/10/2026): vídeo no centro, painel do lead ao lado, transcrição ao vivo, a coluna do Copiloto
// (Fase 2: balões da IA) e os botões de ação (Fase 3). Lido pela chave do servidor, já com o admin
// conferido (o layout do admin também confere).
// Encerrar roda o processamento depois da resposta (after): transcrição, negociação, aviso e custo.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SalaDeReuniaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id) || !(await requireAdmin())) notFound();
  const db = dbDoAtendente();
  // Reunião antiga (sem link) ganha o link e a sala ao abrir.
  await prepararSala(db, id);
  const { data: r } = await db
    .from('reunioes')
    .select('id, titulo, inicio, status, sala_status, sala_meio, sala_token, meet_link, consentimento_em, inicio_em, fim_em, trechos, copiloto, anotacoes, trechos_pendentes, resumo, audio_path, video_arquivo, minutos_participante, custo_usd, processamento, lead_id, conversation_id')
    .eq('id', id)
    .maybeSingle();
  if (!r) notFound();

  const [{ data: lead }, { data: conv }, pasta] = await Promise.all([
    r.lead_id
      ? db
          .from('leads')
          .select('id, name, responsible_name, category, niche, city, state, phone, email, website, instagram, status, notes, briefing, pacote, suggested_services, public_token, rating, review_count')
          .eq('id', r.lead_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    r.conversation_id
      ? db.from('ia_conversations').select('summary').eq('id', r.conversation_id).maybeSingle()
      : r.lead_id
        ? db.from('ia_conversations').select('summary').eq('lead_id', r.lead_id).order('last_message_at', { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
    pastaDoCliente(db, r.lead_id),
  ]);
  // Áudio que o PC arquivou (0116): saiu do Storage e ficou na pasta do cliente no OneDrive.
  const { data: arquivado } = r.audio_path
    ? await (db as unknown as SupabaseClient<any>) // eslint-disable-line @typescript-eslint/no-explicit-any -- tabela da 0116 fora dos tipos gerados
        .from('arquivos_arquivados')
        .select('onedrive_path, local_path')
        .eq('bucket', 'reunioes')
        .eq('caminho', r.audio_path)
        .maybeSingle()
    : { data: null };

  const escolha = escolhaDoJson(lead?.pacote);
  const pacote = escolha
    ? [
        NOMES.BRL[escolha.produto][escolha.nivel],
        escolha.comGestao && escolha.produto !== 'erp' ? NOMES.BRL.erp[escolha.nivelGestao] : null,
        escolha.marca ? NOMES.BRL.marca[escolha.marca - 1] : null,
      ].filter((x): x is string => !!x)
    : [];
  const briefing = Object.entries((lead?.briefing ?? {}) as Record<string, unknown>)
    .filter(([, v]) => (Array.isArray(v) ? v.length : String(v ?? '').trim()))
    .slice(0, 14)
    .map(([k, v]) => ({ campo: k.replace(/_/g, ' '), valor: Array.isArray(v) ? v.join(', ') : String(v) }));

  const dados: DadosDaSala = {
    id: r.id,
    titulo: r.titulo,
    inicio: r.inicio,
    salaStatus: r.sala_status,
    meio: r.sala_meio === 'meet' ? 'meet' : 'daily',
    linkCliente: r.sala_token ? linkDoCliente(r.sala_token) : null,
    meet: r.meet_link,
    consentimentoEm: r.consentimento_em,
    trechos: (Array.isArray(r.trechos) ? r.trechos : []) as Trecho[],
    baloes: baloesVivos((Array.isArray(r.copiloto) ? r.copiloto : []) as Balao[]),
    anotacoes: r.anotacoes,
    pendentes: Array.isArray(r.trechos_pendentes) ? r.trechos_pendentes.length : 0,
    resumo: r.resumo,
    temAudio: !!r.audio_path,
    audioArquivado: (arquivado as { onedrive_path: string | null; local_path: string } | null)?.onedrive_path ?? (arquivado as { local_path: string } | null)?.local_path ?? null,
    videoArquivo: r.video_arquivo,
    minutos: r.minutos_participante === null ? null : Number(r.minutos_participante),
    custoUsd: Number(r.custo_usd ?? 0),
    processamento: r.processamento,
    pasta,
    lead: lead
      ? {
          id: lead.id,
          nome: lead.name,
          contato: lead.responsible_name,
          ramo: lead.niche || lead.category,
          local: [lead.city, lead.state].filter(Boolean).join(' / ') || null,
          telefone: lead.phone,
          email: lead.email,
          site: lead.website,
          instagram: lead.instagram,
          etapa: LEAD_STATUS_LABEL[lead.status as LeadStatus] ?? lead.status,
          notas: lead.notes ? lead.notes.slice(-900) : null,
          diagnostico: lead.public_token ? `${URL_PUBLICA}/diagnostico/${lead.public_token}` : null,
          google: lead.rating !== null ? `${lead.rating} ★ (${lead.review_count ?? 0} avaliações)` : null,
          pacote: pacote.length ? pacote : (lead.suggested_services ?? []),
          pacoteDaLia: pacote.length > 0,
          briefing,
        }
      : null,
    resumoDaConversa: conv?.summary ?? null,
  };

  return <SalaDoArthur d={dados} />;
}
