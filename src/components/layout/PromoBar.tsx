/** A faixa de recados do topo.
 *
 *  Era uma barra inteira preenchida na cor de destaque. Em ouro isso vira a
 *  primeira coisa que a página mostra, atravessada de ponta a ponta — a mesma
 *  quantidade de ouro que o playbook gasta numa peça inteira, gasta antes de o
 *  cliente ver qualquer produto.
 *
 *  Aqui ela é o que o playbook faria: ônix, um fio de ouro embaixo e o texto em
 *  mono maiúscula, que é a voz de ficha técnica da marca. */
export function PromoBar() {
  return (
    <div className="border-b border-ouro/25 bg-page px-4 py-2.5 text-center">
      <span className="etiqueta text-[10.5px] text-fg-secondary sm:text-[11px]">
        Frete grátis acima de R$ 5.000
        <span className="mx-2 text-ouro">·</span>
        Importados direto dos EUA
        <span className="mx-2 text-ouro">·</span>
        Até 3× sem juros
      </span>
    </div>
  );
}
