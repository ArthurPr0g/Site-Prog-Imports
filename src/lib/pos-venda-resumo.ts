// Avisos do pós-venda (P6; pedido do dono em 28/10/2026): uma vez por dia útil, às
// 9h, o Arthur recebe no WhatsApp as pendências dos projetos, só se houver alguma.
// E-mail ao cliente fica para quando a conta de e-mail estiver aquecida.

import type { DbDoAtendente } from '@/lib/atendente/db';
import type { ConfigDoAtendente } from '@/lib/atendente/regras';
import { avisarArthur } from '@/lib/atendente/avisos';
import { REGRAS_DO_CONTRATO } from '@/lib/contract';
import { SITE_URL } from '@/lib/seo';

function diasUteisDesde(iso: string, agora: number): number {
  const d = new Date(iso);
  let n = 0;
  for (;;) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getTime() > agora) return n;
    const s = d.getUTCDay();
    if (s !== 0 && s !== 6) n++;
  }
}

const agoraEmBrasilia = () => {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: 'numeric', hour12: false }).formatToParts(new Date());
  return { dia: p.find((x) => x.type === 'weekday')?.value, hora: Number(p.find((x) => x.type === 'hour')?.value) };
};
const hojeEmBrasilia = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const dataBR = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

export async function resumoDoPosVenda(db: DbDoAtendente, cfg: ConfigDoAtendente): Promise<number> {
  const { dia, hora } = agoraEmBrasilia();
  if (dia === 'Sat' || dia === 'Sun' || hora < 9 || hora >= 12) return 0;
  const hoje = hojeEmBrasilia();
  const { data: c } = await db.from('ia_config').select('posvenda_resumo_em').eq('id', true).maybeSingle();
  if (c?.posvenda_resumo_em === hoje) return 0;
  // Marca antes: o próximo tick não manda de novo.
  await db.from('ia_config').update({ posvenda_resumo_em: hoje }).eq('id', true);

  const agora = Date.now();
  const em = (dias: number) => new Date(agora + dias * 864e5).toISOString().slice(0, 10);
  const [{ data: projetos }, { data: reunioes }] = await Promise.all([
    db
      .from('projetos')
      .select('id, cliente, status, entrega_prevista, entregue_em, projeto_servicos(id, nome, suporte_dias), rodadas(numero, status, pedido_em, entregue_em, servico_id)')
      .neq('status', 'encerrado'),
    db
      .from('reunioes')
      .select('titulo, inicio, projeto_id')
      .not('projeto_id', 'is', null)
      .eq('status', 'marcada')
      .gte('inicio', new Date(agora).toISOString())
      .lte('inicio', new Date(agora + 2 * 864e5).toISOString()),
  ]);

  const linhas: string[] = [];
  for (const p of projetos ?? []) {
    const nomeDo = (id: string) => p.projeto_servicos?.find((s) => s.id === id)?.nome ?? 'serviço';
    for (const r of p.rodadas ?? []) {
      if (r.status === 'aberta' && diasUteisDesde(r.pedido_em, agora) >= 3)
        linhas.push(`• ${p.cliente}: rodada ${r.numero} de ${nomeDo(r.servico_id)} aberta há ${diasUteisDesde(r.pedido_em, agora)} dias úteis`);
      if (r.status === 'entregue' && r.entregue_em && diasUteisDesde(r.entregue_em, agora) >= REGRAS_DO_CONTRATO.aceiteDiasUteis)
        linhas.push(`• ${p.cliente}: rodada ${r.numero} de ${nomeDo(r.servico_id)} sem resposta há ${REGRAS_DO_CONTRATO.aceiteDiasUteis}+ dias úteis (pelo contrato já conta como aceita: registre)`);
    }
    if (p.status === 'em_andamento' && p.entrega_prevista) {
      if (p.entrega_prevista < hoje) linhas.push(`• ${p.cliente}: entrega prevista para ${dataBR(p.entrega_prevista)} está ATRASADA`);
      else if (p.entrega_prevista <= em(3)) linhas.push(`• ${p.cliente}: entrega prevista para ${dataBR(p.entrega_prevista)}`);
    }
    if (p.entregue_em) {
      for (const s of p.projeto_servicos ?? []) {
        if (!s.suporte_dias) continue;
        const fim = new Date(Date.parse(`${p.entregue_em}T12:00:00`) + s.suporte_dias * 864e5).toISOString().slice(0, 10);
        if (fim >= hoje && fim <= em(7)) linhas.push(`• ${p.cliente}: suporte de ${s.nome} termina em ${dataBR(fim)}`);
      }
    }
  }
  for (const r of reunioes ?? []) {
    const cliente = projetos?.find((p) => p.id === r.projeto_id)?.cliente ?? 'cliente';
    const quando = new Date(r.inicio).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit' });
    linhas.push(`• ${cliente}: reunião ${quando}`);
  }
  if (!linhas.length) return 0;
  await avisarArthur(db, cfg, { titulo: 'Pós-venda: pendências de hoje', texto: `\n${linhas.slice(0, 15).join('\n')}`, link: `${SITE_URL}/admin/pos-venda` });
  return linhas.length;
}
