'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Loader2, Save, Trash2, Video, Wand2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { DIMENSOES, type Modelo, type Campo } from '@/lib/estudio/modelos';
import { carregarImagens, desenharPeca } from '@/lib/estudio/desenhistas';
import type { Imagens } from '@/lib/estudio/desenhistas/tipos';
import { aplicarSugestoes, sugestoesDoProduto, type ProdutoDoEstudio } from '@/lib/estudio/produto';
import { salvarPecaAction, excluirPecaAction } from '@/app/actions/estudio';
import { gravarPeca } from '@/lib/estudio/video';
import { SeletorDeIcone } from '@/components/estudio/SeletorDeIcone';
import type { Ctx } from '@/lib/estudio/marca';

const HALOS = [
  { valor: 'roxo', rotulo: 'Roxo' },
  { valor: 'magenta', rotulo: 'Magenta' },
  { valor: 'turquesa', rotulo: 'Turquesa' },
  { valor: 'rubi', rotulo: 'Rubi' },
  { valor: 'ouro', rotulo: 'Ouro' },
];

export function EditorDePeca({
  modelo,
  produtos,
  peca,
  assuntoInicial,
}: {
  modelo: Modelo;
  produtos: ProdutoDoEstudio[];
  /** Vem da pauta, quando a peça nasceu de uma notícia. */
  assuntoInicial?: string;
  peca?: {
    id: string;
    titulo: string;
    conteudo: Record<string, string>;
    product_id: string | null;
    legenda: string;
    status: string;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const { largura, altura } = DIMENSOES[modelo.formato];

  const [titulo, setTitulo] = useState(peca?.titulo ?? '');
  const [conteudo, setConteudo] = useState<Record<string, string>>(peca?.conteudo ?? {});
  const [produtoId, setProdutoId] = useState<string | null>(peca?.product_id ?? null);
  const [legenda, setLegenda] = useState(peca?.legenda ?? '');
  const [status, setStatus] = useState(peca?.status ?? 'Rascunho');
  const [slide, setSlide] = useState(1);
  const [assunto, setAssunto] = useState(assuntoInicial ?? '');
  const [redigindo, setRedigindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [desenhando, setDesenhando] = useState(true);
  const [gravando, setGravando] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // As imagens ficam em cache pela URL: redesenhar a cada tecla é o que dá a
  // sensação de edição ao vivo, e rebaixar a foto do produto a cada letra
  // digitada tornaria isso impossível.
  const cacheRef = useRef<Map<string, Imagens>>(new Map());
  // O que o produto escolhido sugeriu da ultima vez. Serve para saber, na troca
  // de produto, qual campo ainda e do produto e qual o dono reescreveu.
  const sugestoesRef = useRef<Record<string, string>>({});
  // O que a geração por assunto escreveu da última vez. Mesmo papel do anterior,
  // e separado dele porque as duas fontes convivem: um post de venda tem título
  // escrito e preço vindo do cadastro.
  const redacaoRef = useRef<Record<string, string>>({});

  const produto = useMemo(
    () => produtos.find((p) => p.id === produtoId) ?? null,
    [produtos, produtoId]
  );
  const produtoA = useMemo(
    () => produtos.find((p) => p.id === conteudo.produtoA) ?? null,
    [produtos, conteudo.produtoA]
  );
  const produtoB = useMemo(
    () => produtos.find((p) => p.id === conteudo.produtoB) ?? null,
    [produtos, conteudo.produtoB]
  );

  const chaveDasImagens = [produto?.capa, produtoA?.capa, produtoB?.capa, conteudo.imagem]
    .map((s) => s ?? '')
    .join('|');

  const redesenhar = useCallback(async () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d') as Ctx | null | undefined;
    if (!ctx) return;
    setDesenhando(true);

    let imagens = cacheRef.current.get(chaveDasImagens);
    if (!imagens) {
      imagens = await carregarImagens({
        produto: produto?.capa,
        produtoA: produtoA?.capa,
        produtoB: produtoB?.capa,
        fundo: conteudo.imagem,
      });
      cacheRef.current.set(chaveDasImagens, imagens);
    }

    await desenharPeca(ctx, modelo.codigo, conteudo, imagens, slide);
    setDesenhando(false);
  }, [chaveDasImagens, conteudo, modelo.codigo, produto, produtoA, produtoB, slide]);

  useEffect(() => {
    // Um respiro curto evita redesenhar a cada tecla de uma frase longa, sem a
    // edição parecer travada.
    const t = setTimeout(() => void redesenhar(), 120);
    return () => clearTimeout(t);
  }, [redesenhar]);

  function mudar(chave: string, valor: string) {
    setConteudo((atual) => ({ ...atual, [chave]: valor }));
  }

  function escolherProduto(id: string) {
    const p = produtos.find((x) => x.id === id) ?? null;
    setProdutoId(p?.id ?? null);
    if (!p) return;
    const sugestoes = sugestoesDoProduto(p);
    // As sugestões anteriores são capturadas AQUI, e não lidas dentro do
    // atualizador: o atualizador roda depois, e nessa hora a referência já
    // carrega as sugestões novas — a comparação viraria produto novo contra
    // ele mesmo, e nada seria atualizado.
    const anteriores = sugestoesRef.current;
    sugestoesRef.current = sugestoes;
    setConteudo((atual) => aplicarSugestoes(atual, sugestoes, anteriores));
  }

  /** Pede o texto da peça a partir do assunto e aplica sobre o formulário.
   *
   *  Usa a mesma regra da troca de produto: campo vazio ou com exatamente o que
   *  a geração anterior escreveu é atualizado; o que o dono digitou à mão fica.
   *  Sem isso, pedir para reescrever apagaria a correção que ele acabou de
   *  fazer — e aí ninguém pede duas vezes. */
  async function redigir() {
    if (redigindo || assunto.trim().length < 3) return;
    setRedigindo(true);
    try {
      const r = await fetch('/api/estudio/redigir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelo: modelo.codigo, assunto }),
      });
      const dados = await r.json();
      if (!r.ok) {
        toast({ ok: false, message: dados?.erro ?? 'Não consegui redigir agora.' });
        return;
      }
      const campos: Record<string, string> = dados.campos ?? {};
      const anteriores = redacaoRef.current;
      redacaoRef.current = campos;
      setConteudo((atual) => aplicarSugestoes(atual, campos, anteriores));
      toast({ ok: true, message: `${Object.keys(campos).length} campos escritos` });
    } catch {
      toast({ ok: false, message: 'Não consegui falar com o servidor.' });
    } finally {
      setRedigindo(false);
    }
  }

  function nomeDoArquivo() {
    const sufixo = modelo.slides > 1 ? `-${slide}` : '';
    const nome = (titulo || conteudo.titulo || modelo.nome)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `prog-${modelo.codigo}-${nome}${sufixo}`;
  }

  function baixar() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${nomeDoArquivo()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  async function baixarTodos() {
    for (let i = 1; i <= modelo.slides; i++) {
      setSlide(i);
      // Espera o canvas terminar o slide antes de exportar: sem a pausa, os
      // arquivos saem todos com o desenho do slide anterior.
      await new Promise((r) => setTimeout(r, 400));
      baixar();
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  async function baixarVideo() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d') as Ctx | null | undefined;
    if (!canvas || !ctx) return;

    setGravando(true);
    const imagens =
      cacheRef.current.get(chaveDasImagens) ??
      (await carregarImagens({
        produto: produto?.capa,
        produtoA: produtoA?.capa,
        produtoB: produtoB?.capa,
        fundo: conteudo.imagem,
      }));
    cacheRef.current.set(chaveDasImagens, imagens);

    const r = await gravarPeca(canvas, (t) =>
      desenharPeca(ctx, modelo.codigo, conteudo, imagens, slide, t)
    );
    setGravando(false);

    if (!r.ok) {
      toast({ ok: false, message: r.motivo });
      void redesenhar();
      return;
    }

    const url = URL.createObjectURL(r.blob);
    const link = document.createElement('a');
    link.download = `${nomeDoArquivo()}.${r.extensao}`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    // A taxa real aparece no aviso porque ela é a única coisa da exportação que
    // não dá para conferir olhando o arquivo. Abaixo de 50 o vídeo saiu
    // engasgado, e é melhor saber antes de publicar que depois.
    toast({ ok: true, message: `Vídeo pronto · ${r.fps} quadros por segundo` });
    void redesenhar();
  }

  async function salvar() {
    setSalvando(true);
    const r = await salvarPecaAction({
      id: peca?.id,
      modelo: modelo.codigo,
      titulo,
      conteudo,
      productId: produtoId,
      legenda,
      status: status as 'Rascunho' | 'Pronta' | 'Publicada',
    });
    setSalvando(false);
    toast(r);
    if (r.ok && !peca?.id && r.id) router.replace(`/admin/estudio/${r.id}`);
    else if (r.ok) router.refresh();
  }

  async function excluir() {
    if (!peca?.id) return;
    if (!confirm('Excluir esta peça? A arte não é recuperável, mas o modelo continua lá.')) return;
    const r = await excluirPecaAction(peca.id);
    toast(r);
    if (r.ok) router.push('/admin/estudio');
  }

  const camposDoSlide = modelo.campos.filter((c) => !c.slide || c.slide === slide);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      {/* ------------------------------------------------------- formulário */}
      <div className="flex flex-col gap-5">
        <div className="rounded-[18px] border border-border bg-card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-display text-lg font-bold">{modelo.nome}</div>
              <div className="text-[13px] text-fg-tertiary">{modelo.descricao}</div>
            </div>
            <span className="font-mono text-[11px] text-fg-tertiary">
              {modelo.codigo.toUpperCase()} · {largura}×{altura}
            </span>
          </div>

          <Rotulo texto="Nome da peça" ajuda="Só para você achar na lista. Não é desenhado.">
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Legion 9i — pronta entrega"
              className="w-full rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13.5px]"
            />
          </Rotulo>

          {/* Escrever a peça a partir de um assunto.

              Fica acima dos campos porque é o ponto de partida: você diz do que
              a peça trata e os campos abaixo chegam preenchidos para corrigir.
              Preço, parcela e desconto continuam vindo do cadastro do produto —
              esses têm fonte, e inventá-los seria o único erro caro que esta
              tela poderia cometer. */}
          <Rotulo
            texto="Escrever a partir de um assunto"
            ajuda="Uma linha basta. O que você já tiver digitado à mão não é sobrescrito."
          >
            <div className="flex gap-2">
              <input
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void redigir();
                  }
                }}
                placeholder="Ex.: por que importar dos EUA sai mais barato que comprar aqui"
                className="w-full rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13.5px]"
              />
              <button
                onClick={() => void redigir()}
                disabled={redigindo || assunto.trim().length < 3}
                className="flex flex-shrink-0 items-center gap-1.5 rounded-control bg-surface-light px-4 text-[13px] font-extrabold text-ink transition-all hover:bg-surface-light-alt disabled:cursor-not-allowed disabled:opacity-50"
              >
                {redigindo ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
                Escrever
              </button>
            </div>
          </Rotulo>

          {modelo.slides > 1 && (
            <div className="mb-4">
              <div className="mb-1.5 text-[12.5px] font-bold">Slide</div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: modelo.slides }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => setSlide(n)}
                    className={`h-9 w-9 rounded-control border text-[13px] font-extrabold transition-colors ${
                      slide === n
                        ? 'border-accent bg-accent text-page'
                        : 'border-border-strong text-fg-secondary hover:border-accent'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {camposDoSlide.map((campo) => (
            <CampoDoFormulario
              key={campo.chave}
              campo={campo}
              valor={conteudo[campo.chave] ?? ''}
              produtos={produtos}
              onChange={(v) =>
                campo.tipo === 'produto' && campo.chave === 'produto'
                  ? escolherProduto(v)
                  : mudar(campo.chave, v)
              }
              produtoEscolhido={campo.chave === 'produto' ? (produtoId ?? '') : undefined}
              codigoDoModelo={modelo.codigo}
            />
          ))}
        </div>

        <div className="rounded-[18px] border border-border bg-card p-6">
          <Rotulo
            texto="Legenda"
            ajuda="L1 gancho até 8 palavras · L2–4 três fatos com número · L5 CTA com palavra-chave · 3 a 5 hashtags de nicho."
          >
            <textarea
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              rows={6}
              className="w-full rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13.5px] leading-relaxed"
            />
          </Rotulo>
          <div className="text-[12px] text-fg-tertiary">
            {legenda.trim() ? `${legenda.trim().split(/\s+/).length} palavras` : 'Vazia'}
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------- preview */}
      <div className="xl:sticky xl:top-6 xl:self-start">
        <div className="rounded-[18px] border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-[13px] font-bold">Prévia</div>
            {desenhando && <Loader2 size={14} className="animate-spin text-fg-tertiary" />}
          </div>

          <div className="rounded-control border border-border bg-input-alt p-3">
            <canvas
              ref={canvasRef}
              width={largura}
              height={altura}
              className="mx-auto block h-auto w-full rounded-[6px] shadow-[0_8px_28px_rgba(0,0,0,.45)]"
            />
          </div>

          <div className="mt-3 text-[12px] leading-relaxed text-fg-tertiary">
            O arquivo baixa em {largura}×{altura}. A prévia aqui é reduzida só para caber na tela.
          </div>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <button
              onClick={baixar}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-control bg-accent px-5 py-2.5 text-[13.5px] font-extrabold text-page"
            >
              <Download size={15} /> Baixar PNG
            </button>
            {modelo.slides > 1 && (
              <button
                onClick={baixarTodos}
                className="rounded-control border border-border-strong px-4 py-2.5 text-[13.5px] font-extrabold text-fg-secondary hover:border-accent hover:text-accent"
              >
                Baixar os {modelo.slides}
              </button>
            )}
            {modelo.animado && (
              <button
                onClick={baixarVideo}
                disabled={gravando}
                className="inline-flex w-full items-center justify-center gap-2 rounded-control border border-border-strong px-4 py-2.5 text-[13.5px] font-extrabold text-fg-secondary hover:border-accent hover:text-accent disabled:opacity-60"
              >
                {gravando ? <Loader2 size={15} className="animate-spin" /> : <Video size={15} />}
                {gravando ? 'Gravando…' : 'Baixar vídeo (MP4)'}
              </button>
            )}
          </div>
          {modelo.animado && (
            <div className="mt-2 text-[12px] leading-relaxed text-fg-tertiary">
              O vídeo dura 5 segundos e segue os tempos do playbook — produto em 900ms, título em
              420ms com 80ms entre as linhas, preço depois de um respiro de 200ms. A gravação roda
              em tempo real, então a prévia anima enquanto grava.
            </div>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-control border border-border-strong bg-input px-3 py-2.5 text-[13px]"
            >
              <option>Rascunho</option>
              <option>Pronta</option>
              <option>Publicada</option>
            </select>
            <button
              onClick={salvar}
              disabled={salvando}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-control border border-border-strong px-5 py-2.5 text-[13.5px] font-extrabold text-fg-secondary hover:border-accent hover:text-accent disabled:opacity-60"
            >
              {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Salvar
            </button>
            {peca?.id && (
              <button
                onClick={excluir}
                aria-label="Excluir peça"
                className="grid h-10 w-10 place-items-center rounded-control border border-border-strong text-fg-tertiary hover:border-error hover:text-error"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Rotulo({
  texto,
  ajuda,
  children,
}: {
  texto: string;
  ajuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 text-[12.5px] font-bold">{texto}</div>
      {ajuda && <div className="mb-1.5 text-[12px] leading-relaxed text-fg-tertiary">{ajuda}</div>}
      {children}
    </div>
  );
}

function CampoDoFormulario({
  campo,
  valor,
  produtos,
  onChange,
  produtoEscolhido,
  codigoDoModelo,
}: {
  campo: Campo;
  valor: string;
  produtos: ProdutoDoEstudio[];
  onChange: (v: string) => void;
  produtoEscolhido?: string;
  /** O seletor de ícone desenha a capa na direção deste modelo. */
  codigoDoModelo: string;
}) {
  const classe =
    'w-full rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13.5px]';

  // O aviso de palavras existe porque o limite do playbook é de leitura, não de
  // design: no grid do perfil a peça aparece com 3cm de largura.
  const palavras = valor.trim() ? valor.trim().split(/\s+/).length : 0;
  const passou = campo.maxPalavras ? palavras > campo.maxPalavras : false;

  if (campo.tipo === 'produto') {
    return (
      <Rotulo texto={campo.rotulo} ajuda={campo.ajuda}>
        <select
          value={produtoEscolhido ?? valor}
          onChange={(e) => onChange(e.target.value)}
          className={classe}
        >
          <option value="">— nenhum —</option>
          {produtos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Rotulo>
    );
  }

  if (campo.tipo === 'halo') {
    return (
      <Rotulo texto={campo.rotulo} ajuda={campo.ajuda}>
        <select value={valor || 'roxo'} onChange={(e) => onChange(e.target.value)} className={classe}>
          {HALOS.map((h) => (
            <option key={h.valor} value={h.valor}>
              {h.rotulo}
            </option>
          ))}
        </select>
      </Rotulo>
    );
  }

  if (campo.tipo === 'icone') {
    return (
      <Rotulo texto={campo.rotulo} ajuda={campo.ajuda}>
        <SeletorDeIcone modelo={codigoDoModelo} valor={valor} onChange={onChange} />
      </Rotulo>
    );
  }

  if (campo.tipo === 'textoLongo') {
    return (
      <Rotulo texto={campo.rotulo} ajuda={campo.ajuda}>
        <textarea value={valor} onChange={(e) => onChange(e.target.value)} rows={3} className={classe} />
      </Rotulo>
    );
  }

  return (
    <Rotulo texto={campo.rotulo} ajuda={campo.ajuda}>
      <input value={valor} onChange={(e) => onChange(e.target.value)} className={classe} />
      {campo.maxPalavras && (
        <div className={`mt-1 text-[12px] ${passou ? 'text-error' : 'text-fg-tertiary'}`}>
          {palavras} de {campo.maxPalavras} palavras
          {passou && ' — o playbook pede menos; o produto precisa de mais área que o texto'}
        </div>
      )}
    </Rotulo>
  );
}
