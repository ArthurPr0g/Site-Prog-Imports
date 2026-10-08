'use client';

import { useState } from 'react';
import { formatBRL } from '@/lib/format';
import { ajustarCombosEMensalidades, type AjusteAutomatico } from '@/lib/combo-servicos';
import type { InternalService, ServiceOrderItem } from '@/lib/services';

// Combo e mensalidade única aplicados ao escolher serviços do catálogo, com o
// mesmo comportamento no Orçamento e na Prestação (regras em lib/combo-servicos).

type Aviso = Omit<AjusteAutomatico, 'items'>;

/** O aviso acumula o que foi aplicado no formulário; `antes` e `avisoAntes`
 *  guardam só a última escolha, que é o que o "Desfazer" volta. */
export type EstadoDoAjuste = Aviso & { antes: ServiceOrderItem[] | null; avisoAntes: Aviso | null };

export function useAjusteAutomatico(services: InternalService[]) {
  const [ajuste, setAjuste] = useState<EstadoDoAjuste | null>(null);
  // Desfeito, não reaplica até fechar o formulário.
  const [semAjuste, setSemAjuste] = useState(false);
  // Os campos de valor e prazo são não controlados: trocar as linhas de lugar
  // precisa remontá-los, senão mostram o número da linha que estava ali.
  const [versaoLinhas, setVersaoLinhas] = useState(0);

  /** Itens depois de uma escolha do catálogo, já com combo e mensalidade única. */
  function aplicar(items: ServiceOrderItem[]): ServiceOrderItem[] {
    const ajustado = semAjuste ? null : ajustarCombosEMensalidades(items, services);
    if (ajustado) {
      setAjuste({
        combo: ajustado.combo ?? ajuste?.combo ?? null,
        mensalidadesRemovidas: [...(ajuste?.mensalidadesRemovidas ?? []), ...ajustado.mensalidadesRemovidas],
        antes: items,
        avisoAntes: ajuste ? { combo: ajuste.combo, mensalidadesRemovidas: ajuste.mensalidadesRemovidas } : null,
      });
      setVersaoLinhas((v) => v + 1);
      return ajustado.items;
    }
    // O "desfazer" só vale para a última escolha: depois dela, voltaria atrás
    // também o que foi escolhido em seguida. O aviso continua.
    if (ajuste) setAjuste({ ...ajuste, antes: null, avisoAntes: null });
    return items;
  }

  /** Itens de antes da última escolha, ou null se não há o que desfazer. */
  function desfazer(): ServiceOrderItem[] | null {
    if (!ajuste?.antes) return null;
    const aviso = ajuste.avisoAntes;
    setAjuste(
      aviso && (aviso.combo || aviso.mensalidadesRemovidas.length) ? { ...aviso, antes: null, avisoAntes: null } : null
    );
    setSemAjuste(true);
    setVersaoLinhas((v) => v + 1);
    return ajuste.antes;
  }

  function reiniciar() {
    setAjuste(null);
    setSemAjuste(false);
  }

  return { ajuste, versaoLinhas, aplicar, desfazer, reiniciar };
}

export function AvisoAjusteAutomatico({
  ajuste,
  onDesfazer,
}: {
  ajuste: EstadoDoAjuste | null;
  onDesfazer: () => void;
}) {
  if (!ajuste) return null;
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-control border border-accent/40 bg-[rgb(var(--brand-accent-rgb)/.06)] px-4 py-3 text-[12.5px]">
      <div className="space-y-0.5">
        {ajuste.combo && (
          <div>
            🎁 <strong>Combo aplicado:</strong> {ajuste.combo.nome} por <strong>{formatBRL(ajuste.combo.valor)}</strong>{' '}
            <span className="text-fg-tertiary">
              (separados {formatBRL(ajuste.combo.separados)}, economia de{' '}
              {formatBRL(ajuste.combo.separados - ajuste.combo.valor)})
            </span>
          </div>
        )}
        {ajuste.mensalidadesRemovidas.length > 0 && (
          <div>
            🔁 <strong>Uma mensalidade só:</strong> ficou a mais cara; saiu {ajuste.mensalidadesRemovidas.join(', ')}.
          </div>
        )}
        <div className="text-[11px] text-fg-faded">O campo de desconto abaixo continua valendo por cima disso.</div>
      </div>
      {ajuste.antes && (
        <button
          type="button"
          onClick={onDesfazer}
          className="shrink-0 rounded-control border border-border-strong px-3 py-1.5 text-[12px] font-bold text-fg-secondary hover:border-accent hover:text-accent"
        >
          Desfazer
        </button>
      )}
    </div>
  );
}
