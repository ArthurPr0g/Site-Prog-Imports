import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { modelosPorSecao, DIMENSOES } from '@/lib/estudio/modelos';

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

  return (
    <div>
      <AdminPageHeader
        area="estudio"
        title="Estúdio"
        subtitle="Peças de Instagram no padrão do playbook — arte em 1080, pronta para baixar"
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
              <div
                key={p.id}
                className="grid grid-cols-[1.6fr_1fr_140px_150px] items-center gap-3 border-b border-divider py-3.5 text-[13px]"
              >
                <div className="truncate font-bold">{p.titulo}</div>
                <div className="font-mono text-fg-secondary">{p.modelo.toUpperCase()}</div>
                <div className="text-fg-secondary">{p.formato}</div>
                <div className="text-fg-secondary">{p.status}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {secoes.map(({ secao, modelos }) => (
        <div key={secao} className="mb-7">
          <div className="mb-3.5 font-mono text-[11px] font-bold tracking-[.14em] text-accent">
            {secao.toUpperCase()}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {modelos.map((m) => {
              const d = DIMENSOES[m.formato];
              return (
                <div
                  key={m.codigo}
                  className="flex flex-col gap-2.5 rounded-[18px] border border-border bg-card p-5"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="font-display text-[15px] font-bold">{m.nome}</div>
                    <span className="font-mono text-[11px] text-fg-tertiary">
                      {m.codigo.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[13px] leading-relaxed text-fg-secondary">{m.descricao}</div>
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px] text-fg-tertiary">
                    <span>
                      {d.largura}×{d.altura}
                    </span>
                    <span>·</span>
                    <span>{m.superficie}</span>
                    {m.slides > 1 && (
                      <>
                        <span>·</span>
                        <span>{m.slides} slides</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
