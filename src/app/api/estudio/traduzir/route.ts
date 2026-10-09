import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { traduzirAssuntos } from '@/lib/estudio/traducao';

// Traduz a pauta, um lote por chamada.
//
// A primeira versão traduzia tudo dentro da ação que busca os feeds, e o
// resultado foi instrutivo: a pauta gravou, a tradução não, e ninguém ficou
// sabendo. Buscar cinco feeds e esperar dezenas de manchetes voltarem
// traduzidas não cabe no tempo de uma função — e quando o processo morre no
// meio, o que já tinha sido gravado fica, o resto evapora, sem erro na tela.
//
// Um lote pequeno por requisição resolve os dois lados: cabe no tempo com
// folga, e a tela mostra o progresso em vez de uma espera muda.

/** Quantos por chamada. Doze manchetes com resumo voltam em poucos segundos;
 *  é o tamanho que deixa margem larga para a função mais lenta de um dia
 *  ruim. */
const LOTE = 12;

/** Quantos itens da pauta valem tradução.
 *
 *  Exatamente os que a tela mostra. Traduzir os 87 que a busca trouxe seria
 *  pagar por 63 linhas que ninguém vai ver — e quando as de cima forem
 *  descartadas, as de baixo sobem e entram nesta janela na atualização
 *  seguinte. */
const JANELA = 24;

export const maxDuration = 60;

export async function POST() {
  const dono = await requireAdmin();
  if (!dono) return NextResponse.json({ erro: 'Só o gerenciamento usa o Estúdio.' }, { status: 403 });

  const supabase = await createClient();

  // A mesma ordem da tela: é o que define quem está na janela.
  const { data: janela, error } = await supabase
    .from('studio_topics')
    .select('id, titulo, resumo, titulo_pt')
    .eq('status', 'novo')
    .order('relevancia', { ascending: false })
    .order('publicado_em', { ascending: false, nullsFirst: false })
    .limit(JANELA);

  if (error) return NextResponse.json({ erro: 'Não consegui ler a pauta.' }, { status: 500 });

  const pendentes = (janela ?? []).filter((a) => !a.titulo_pt);
  if (pendentes.length === 0) return NextResponse.json({ traduzidos: 0, restantes: 0 });

  const lote = pendentes.slice(0, LOTE);
  const traduzidos = await traduzirAssuntos(
    lote.map((a) => ({ id: a.id, titulo: a.titulo, resumo: a.resumo }))
  );

  if (traduzidos.length === 0) {
    return NextResponse.json(
      { erro: 'Não consegui traduzir agora. A pauta continua em inglês; tente de novo.' },
      { status: 502 }
    );
  }

  // Uma linha por vez: o PostgREST não faz update em massa com valor
  // diferente por linha, e um upsert aqui arriscaria ressuscitar o que foi
  // descartado.
  const gravados = await Promise.allSettled(
    traduzidos.map((t) =>
      supabase
        .from('studio_topics')
        .update({ titulo_pt: t.titulo_pt, resumo_pt: t.resumo_pt })
        .eq('id', t.id)
    )
  );
  const ok = gravados.filter((r) => r.status === 'fulfilled' && !r.value.error).length;

  return NextResponse.json({ traduzidos: ok, restantes: Math.max(0, pendentes.length - ok) });
}
