import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { modelosPorSecao, DIMENSOES } from '@/lib/estudio/modelos';
import { MiniaturaDoModelo } from '@/components/estudio/MiniaturaDoModelo';
import { listarProdutosDoEstudio } from '@/lib/estudio/catalogo';
import { PautaDeAssuntos, type AssuntoNaPauta } from '@/components/estudio/PautaDeAssuntos';

export const metadata: Metadata = { title: 'Estúdio' };

type Peca = {
  id: string;
  modelo: string;
  formato: string;
  titulo: string;
  status: string;
  created_at: string;
};

export default async function EstudioPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('studio_pieces')
    .select('id, modelo, formato, titulo, status, created_at')
    .order('created_at', { ascending: false })
    .limit(60);

  const pecas = (data ?? []) as Peca[];
  const secoes = modelosPorSecao();

  // Uma foto real do catálogo nas miniaturas. Com um retângulo cinza no lugar
  // do produto, metade dos modelos fica impossível de distinguir — é o produto
  // que define o enquadramento de quase todos eles.
  const produtos = await listarProdutosDoEstudio();
  const capaDeExemplo = produtos.find((p) => p.capa)?.capa ?? null;

  // Só o que ainda não foi lido e decidido. Descartado e produzido somem da
  // mesa: pauta que acumula o que já foi resolvido deixa de ser pauta.
  const { data: pauta } = await supabase
    .from('studio_topics')
    .select('id, titulo, resumo, titulo_pt, resumo_pt, fonte, url, publicado_em, relevancia, marcas')
    .eq('status', 'novo')
    .order('relevancia', { ascending: false })
    .order('publicado_em', { ascending: false, nullsFirst: false })
    .limit(24);
  const assuntos = (pauta ?? []) as AssuntoNaPauta[];

  return (
    <div>
      <AdminPageHeader
        area="estudio"
        title="Estúdio"
        subtitle="Peças de Instagram no padrão do playbook — arte em 1080, pronta para baixar"
        action={
          <Link
            href="/admin/estudio/instagram"
            className="rounded-control border border-border-strong px-4 py-2 text-[13px] font-extrabold text-fg-secondary hover:border-accent hover:text-accent"
          >
            Instagram
          </Link>
        }
      />

      <div className="mb-7 rounded-[18px] border border-border bg-card p-6">
        <div className="mb-1 font-display text-lg font-bold">Peças</div>
        <div className="mb-4 text-[13px] text-fg-tertiary">
          Cada peça guarda só o texto e o produto. A arte é redesenhada no tamanho final toda vez que
          você abre — então, se o playbook mudar, as peças antigas acompanham.
        </div>
        {pecas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-strong px-5 py-8 text-center text-[13px] text-fg-tertiary">
            Nenhuma peça ainda. Escolha um modelo abaixo para começar.
          </div>
        ) : (
          <div className="min-w-[640px]">
            <div className="grid grid-cols-[1.6fr_1fr_140px_150px] gap-3 border-b border-border pb-2.5 text-[11px] font-bold tracking-[.08em] text-fg-tertiary">
              <div>PEÇA</div>
              <div>MODELO</div>
              <div>FORMATO</div>
              <div>SITUAÇÃO</div>
            </div>
            {pecas.map((p) => (
              <Link
                key={p.id}
                href={`/admin/estudio/${p.id}`}
                className="grid grid-cols-[1.6fr_1fr_140px_150px] items-center gap-3 border-b border-divider py-3.5 text-[13px] hover:text-accent"
              >
                <div className="truncate font-bold">{p.titulo}</div>
                <div className="font-mono text-fg-secondary">{p.modelo.toUpperCase()}</div>
                <div className="text-fg-secondary">{p.formato}</div>
                <div className="text-fg-secondary">{p.status}</div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <PautaDeAssuntos assuntos={assuntos} />

      {secoes.map(({ secao, modelos }) => (
        <div key={secao} className="mb-7">
          <div className="mb-3.5 font-mono text-[11px] font-bold tracking-[.14em] text-accent">
            {secao.toUpperCase()}
          </div>
          {/* Grade de miniaturas desenhadas, e não de descrições.

              O que faz escolher entre o 3A e o 3C não é ler "post de produto
              escuro" e "post de oferta": é ver quanto texto cabe, onde o preço
              fica e como o produto sangra na borda. As miniaturas são a peça de
              verdade desenhada pequena, pelo mesmo desenhista — então a grade
              não tem como ficar desatualizada em relação ao que o botão gera. */}
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {modelos.map((m) => {
              const d = DIMENSOES[m.formato];
              return (
                <Link
                  key={m.codigo}
                  href={`/admin/estudio/nova?modelo=${m.codigo}`}
                  className="group flex flex-col gap-2.5 rounded-card-lg border border-border bg-card p-3 transition-all hover:-translate-y-1 hover:border-border-hover hover:shadow-[0_18px_40px_rgba(0,0,0,.45)]"
                >
                  <MiniaturaDoModelo modelo={m} capa={capaDeExemplo} />
                  <div className="flex items-baseline justify-between gap-2 px-1">
                    <div className="truncate text-[13.5px] font-extrabold">{m.nome}</div>
                    <span className="etiqueta flex-shrink-0 text-[9px] text-fg-muted">
                      {m.codigo.toUpperCase()}
                    </span>
                  </div>
                  <div className="line-clamp-2 px-1 text-[12px] leading-snug text-fg-tertiary">
                    {m.descricao}
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-1.5 px-1 pt-1">
                    <span className="etiqueta text-[9px] text-fg-muted">
                      {d.largura}×{d.altura}
                    </span>
                    {m.slides > 1 && (
                      <span className="etiqueta rounded-full border border-border-strong px-1.5 py-0.5 text-[9px] text-fg-tertiary">
                        {m.slides} slides
                      </span>
                    )}
                    {m.animado && (
                      <span className="etiqueta rounded-full border border-ouro/40 px-1.5 py-0.5 text-[9px] text-ouro">
                        vídeo
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
