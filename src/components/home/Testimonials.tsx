'use client';

import { StarRating } from '@/components/ui/Price';
import { INSTAGRAM_HANDLE } from '@/lib/constants';
import type { Tables } from '@/lib/supabase/database.types';

/** A seção clara da home.
 *
 *  O playbook alterna ônix e marfim, e prova social é o modelo 3D — que é, não
 *  por acaso, uma das peças claras. Faz sentido além da regra: uma página
 *  inteiramente preta não tem onde respirar, e o depoimento é o único bloco da
 *  home que não é produto nem preço. Virar a superfície aqui separa "o que a
 *  loja vende" de "o que os clientes dizem" sem precisar de título para isso.
 *
 *  Nenhum ouro neste bloco. Sobre marfim ele fica em 2,2:1 de contraste e lê
 *  como amarelo sujo; quem faz esse papel na superfície clara é o bronze, que
 *  existe na paleta exatamente para isso. O único ouro é o da inicial do
 *  cliente, e só porque ela está sobre um disco ônix. */
export function Testimonials({ testimonials }: { testimonials: Tables<'testimonials'>[] }) {
  return (
    <section id="depoimentos" className="mt-22 scroll-mt-24 bg-surface-light py-20">
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="etiqueta mb-3 text-[11px] text-bronze">Quem compra, confia</div>
            <h2 className="titulo text-[36px] text-ink">Depoimentos</h2>
          </div>
          <a
            href={`https://instagram.com/${INSTAGRAM_HANDLE}`}
            target="_blank"
            rel="noreferrer"
            className="etiqueta text-[11px] text-bronze transition-opacity hover:opacity-70"
          >
            @{INSTAGRAM_HANDLE} ↗
          </a>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {testimonials.map((t) => (
            <div
              key={t.id}
              className="rounded-card-lg border border-surface-light-border bg-surface-light-alt p-7 transition-transform duration-300 hover:-translate-y-1"
            >
              <StarRating cor="text-bronze" corVazia="text-surface-light-border" />
              <p className="my-4 text-[14.5px] leading-relaxed text-ink-secondary">{t.text}</p>
              <div className="flex items-center gap-3">
                {/* O disco escuro sobre o claro é o cartão do 3D em miniatura:
                    é o contraste que faz o nome do cliente ter peso de assinatura
                    em vez de legenda. */}
                <div className="titulo grid h-10 w-10 place-items-center rounded-full bg-ink text-sm text-ouro-claro">
                  {t.name[0]}
                </div>
                <div>
                  <div className="text-sm font-extrabold text-ink">{t.name}</div>
                  <div className="text-xs text-ink-secondary/70">{t.bought}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
