// Selo de pronta entrega: o produto tem unidade física em mãos, então não
// depende do prazo de importação. É o argumento mais forte da loja para quem
// não quer esperar, por isso ganha destaque com pulso — mas discreto, para não
// competir com o selo de promoção, que fica no mesmo canto do card.
//
// A ausência do selo não significa indisponível: o catálogo funciona por
// encomenda e todo produto continua à venda. Por isso o texto afirma o que
// existe, em vez de sugerir escassez.
export function ReadyToShipBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={
        compact
          ? 'inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/12 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[.06em] text-success sm:px-2.5 sm:py-1 sm:text-[10.5px]'
          : 'inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/12 px-3 py-1 text-[11.5px] font-extrabold uppercase tracking-[.06em] text-success'
      }
      title="Temos esta unidade em estoque, pronta para envio imediato"
    >
      {/* Ponto pulsante: sinaliza "agora" sem precisar de texto extra. */}
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
      </span>
      Pronta entrega
    </span>
  );
}
