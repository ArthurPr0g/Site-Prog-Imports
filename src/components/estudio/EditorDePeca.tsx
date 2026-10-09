'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Loader2, Save, Sparkles, Trash2, Video, Wand2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { DIMENSOES, type Modelo, type Campo } from '@/lib/estudio/modelos';
import { carregarImagens, desenharPeca } from '@/lib/estudio/desenhistas';
import { cortesDoDesenho, zerarCortes } from '@/lib/estudio/marca';
import type { Imagens } from '@/lib/estudio/desenhistas/tipos';
import {
  aplicarSugestoes,
  sugestoesDoProduto,
  tituloDaArte,
  type ProdutoDoEstudio,
} from '@/lib/estudio/produto';
import { modeloEscolheOProduto } from '@/lib/estudio/redacao';
import { comCredito, termoDaPeca, type Ilustracao } from '@/lib/estudio/ilustracao';
import { SeletorDeIlustracao } from '@/components/estudio/SeletorDeIlustracao';
import { salvarPecaAction, excluirPecaAction } from '@/app/actions/estudio';
import { gravarPeca } from '@/lib/estudio/video';
import { SeletorDeIcone } from '@/components/estudio/SeletorDeIcone';
import { PublicarNoInstagram } from '@/components/estudio/PublicarNoInstagram';
import { PreviaDoInstagram } from '@/components/estudio/PreviaDoInstagram';
import { RespostaDoDirect } from '@/components/estudio/RespostaDoDirect';
import { mensagemPadrao, palavraChaveDa } from '@/lib/estudio/direct';
import type { Ctx } from '@/lib/estudio/marca';
import { formatBRL } from '@/lib/format';

/** O produto escolhido, em texto, para a redação da legenda.
 *
 *  Preço formatado em reais, e não o número cru do banco: mandar `10999` faz o
 *  modelo escrever "10999 reais" numa legenda que vai para o ar. E só o que
 *  está no cadastro — o que não existe não vira linha, para não convidar a
 *  preencher a lacuna. */
function descreverProduto(p: ProdutoDoEstudio): string {
  const linhas = [`Nome: ${p.name}`];
  const preco = p.promo_price ?? p.price;
  if (preco) linhas.push(`Preço: ${formatBRL(preco)}`);
  if (p.promo_price && p.price > p.promo_price) linhas.push(`Preço anterior: ${formatBRL(p.price)}`);
  const ficha = [p.cpu, p.gpu, p.ram, p.storage, p.screen_type].filter(Boolean).join(' · ');
  if (ficha) linhas.push(`Ficha: ${ficha}`);
  if (p.condition) linhas.push(`Condição: ${p.condition}`);
  if (typeof p.stock === 'number' && p.stock > 0) linhas.push(`Em estoque: ${p.stock}`);
  return linhas.join('\n');
}

/** O que a redação devolve já mesclado, para a etapa seguinte usar na hora. */
type Redacao = {
  ok: boolean;
  conteudo?: Record<string, string>;
  produto?: ProdutoDoEstudio | null;
};

/** Sobrescritas para quem é chamado dentro da cadeia, antes de o estado virar. */
type ContextoDaPeca = {
  silencioso?: boolean;
  conteudo?: Record<string, string>;
  produto?: ProdutoDoEstudio | null;
};

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
    resposta_direta?: string;
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
  const [respostaDireta, setRespostaDireta] = useState(peca?.resposta_direta ?? '');
  const [status, setStatus] = useState(peca?.status ?? 'Rascunho');
  const [slide, setSlide] = useState(1);
  const [assunto, setAssunto] = useState(assuntoInicial ?? '');
  const [redigindo, setRedigindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [desenhando, setDesenhando] = useState(true);
  const [gravando, setGravando] = useState(false);
  const [previa, setPrevia] = useState<string | null>(null);
  const [escrevendoLegenda, setEscrevendoLegenda] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [cortado, setCortado] = useState<string[]>([]);
  // Resultado da busca que a cadeia dispara quando o catálogo não tem a máquina.
  // chave muda a cada busca para o seletor remontar já aberto, em vez de um
  // efeito mandar abrir — estado derivado de props não precisa de efeito.
  const [buscaDeImagem, setBuscaDeImagem] = useState<{ termo: string; lista: Ilustracao[]; chave: number } | null>(null);

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

  /** Nesta peça a máquina é cenário, e quem escolhe é a redação. */
  const escolhaAutomatica = modeloEscolheOProduto(modelo);

  /** De onde sai a imagem que ocupa o lugar do produto na arte.
   *
   *  O catálogo vem primeiro, sempre. A foto de fora só entra quando nenhuma
   *  máquina foi escolhida — e só em peça onde o produto é cenário: em peça de
   *  venda, ilustrar com foto de terceiro seria vender o que não está na
   *  vitrine. */
  const fonteDoProduto = produto?.capa ?? (escolhaAutomatica ? conteudo.imagem || null : null);
  const palavraChave = useMemo(() => palavraChaveDa(conteudo, legenda), [conteudo, legenda]);

  const chaveDasImagens = [fonteDoProduto, produtoA?.capa, produtoB?.capa, conteudo.imagem]
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
        produto: fonteDoProduto,
        produtoA: produtoA?.capa,
        produtoB: produtoB?.capa,
        fundo: conteudo.imagem,
      });
      cacheRef.current.set(chaveDasImagens, imagens);
    }

    // Quem sabe que o texto não coube é quem quebrou as linhas. O desenhista
    // anota, e a tela lê depois do traço: a reticência aparece na arte, mas é
    // fácil não reparar nela numa prévia reduzida a um terço.
    zerarCortes();
    await desenharPeca(ctx, modelo.codigo, conteudo, imagens, slide);
    setCortado(cortesDoDesenho());
    // A mesma arte, reduzida, alimenta a prévia do telefone. JPEG em 0.86
    // porque é miniatura: PNG de 1080×1350 a cada tecla digitada pesaria mais
    // que o desenho inteiro.
    setPrevia(canvas!.toDataURL('image/jpeg', 0.86));
    setDesenhando(false);
  }, [chaveDasImagens, conteudo, fonteDoProduto, modelo.codigo, produtoA, produtoB, slide]);

  useEffect(() => {
    // Um respiro curto evita redesenhar a cada tecla de uma frase longa, sem a
    // edição parecer travada.
    const t = setTimeout(() => void redesenhar(), 120);
    return () => clearTimeout(t);
  }, [redesenhar]);

  // Vindo da pauta, a peça se escreve sozinha ao abrir.
  //
  // Clicar em "Produzir" numa notícia já é o pedido; chegar numa tela vazia
  // com o assunto preenchido e ter de clicar em "Escrever" é pedir duas vezes.
  // Só em peça nova e só uma vez — reabrir uma peça salva não pode reescrever
  // o que o dono revisou.
  const jaGerouSozinho = useRef(false);
  useEffect(() => {
    if (jaGerouSozinho.current || peca?.id || !assuntoInicial?.trim()) return;
    jaGerouSozinho.current = true;
    void gerarPeca(true);
    // Lista vazia de propósito: o gatilho é ter chegado aqui com um assunto,
    // e reexecutar quando o conteúdo mudasse reescreveria por cima do que o
    // dono acabou de corrigir. A trava em `jaGerouSozinho` cobre o resto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function mudar(chave: string, valor: string) {
    setConteudo((atual) => ({ ...atual, [chave]: valor }));
  }

  /** Tira a foto de fora quando uma máquina do catálogo passa a valer.
   *
   *  Catálogo vem primeiro. Sem isto a imagem ficava guardada na peça sem
   *  aparecer, e o crédito dela seguia na legenda — atribuição a uma foto que não
   *  está na arte. */
  function soltarImagemDeFora() {
    if (!conteudo.imagem) return;
    setLegenda((l) => comCredito(l, '', conteudo.imagemCredito ?? ''));
    setConteudo((atual) => ({ ...atual, imagem: '', imagemCredito: '' }));
  }

  function escolherProduto(id: string) {
    const p = produtos.find((x) => x.id === id) ?? null;
    setProdutoId(p?.id ?? null);
    if (!p) return;
    soltarImagemDeFora();
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
  async function redigir(silencioso = false): Promise<Redacao> {
    if (redigindo || assunto.trim().length < 3) return { ok: false };
    setRedigindo(true);
    try {
      const r = await fetch('/api/estudio/redigir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelo: modelo.codigo,
          assunto,
          // A máquina já escolhida vai junto: sem ela a escrita acontecia às
          // cegas e podia produzir um título sobre um notebook enquanto a
          // ficha, vinda do cadastro, falava de outro.
          produtoEscolhido: produto ? descreverProduto(produto) : '',
        }),
      });
      const dados = await r.json();
      if (!r.ok) {
        toast({ ok: false, message: dados?.erro ?? 'Não consegui redigir agora.' });
        return { ok: false };
      }

      const campos: Record<string, string> = dados.campos ?? {};

      // O resultado é calculado aqui e devolvido, em vez de só ir para o
      // estado. Quem encadeia — escrever o texto, depois a legenda, depois a
      // mensagem de direct — precisa do valor **agora**; o estado do React só
      // chega no próximo render, e ler dali entregaria a peça anterior para a
      // legenda da peça nova.
      const anteriores = redacaoRef.current;
      redacaoRef.current = campos;

      // O texto da redação entra primeiro, e o cadastro só completa o que ficou
      // vazio. A ordem contrária era o defeito: numa peça de notícia, o cadastro
      // preenchia o título com o nome do produto, o campo deixava de estar
      // vazio, e a regra de mesclagem — que protege o que já está escrito —
      // barrava o gancho que a redação acabara de criar.
      //
      // Onde o produto é cenário, o texto da redação também vence o que o
      // cadastro escreveu antes (a primeira passada). O que o dono digitou à
      // mão continua intocado nas duas.
      let base = conteudo;
      if (escolhaAutomatica) base = aplicarSugestoes(base, campos, sugestoesRef.current);
      base = aplicarSugestoes(base, campos, anteriores);

      let novoProduto = produto;

      const escolhido = dados.produtoId
        ? (produtos.find((p) => p.id === dados.produtoId) ?? null)
        : null;

      if (escolhido && escolhido.id !== produtoId) {
        const sugestoes = sugestoesDoProduto(escolhido);
        const anterioresDoProduto = sugestoesRef.current;
        sugestoesRef.current = sugestoes;
        base = aplicarSugestoes(base, sugestoes, anterioresDoProduto);
        if (base.imagem) {
          setLegenda((l) => comCredito(l, '', base.imagemCredito ?? ''));
          base = { ...base, imagem: '', imagemCredito: '' };
        }
        novoProduto = escolhido;
        setProdutoId(escolhido.id);
      }

      const final = base;
      setConteudo(final);

      if (!silencioso) {
        const quantos = Object.keys(campos).length;
        toast({
          ok: true,
          message: escolhido
            ? `${quantos} campos escritos · ${tituloDaArte(escolhido)}`
            : `${quantos} campos escritos`,
        });
      }
      return { ok: true, conteudo: final, produto: novoProduto };
    } catch {
      toast({ ok: false, message: 'Não consegui falar com o servidor.' });
      return { ok: false };
    } finally {
      setRedigindo(false);
    }
  }

  /** Escreve a legenda a partir do que a peça já tem.
   *
   *  Ao contrário dos campos da arte, aqui não há mesclagem: a legenda é um
   *  texto só, e não dá para saber que parte dele o dono reescreveu. Então o
   *  botão avisa antes de trocar — perder uma legenda revisada por um clique
   *  é o tipo de coisa que faz ninguém clicar de novo. */
  async function escreverLegenda(sobre: ContextoDaPeca = {}): Promise<boolean> {
    if (escrevendoLegenda) return false;
    // A pergunta só existe no clique avulso. Dentro da cadeia a legenda ainda
    // não foi revisada por ninguém — perguntar ali seria pedir confirmação
    // para substituir um texto que acabou de nascer.
    if (!sobre.silencioso && legenda.trim() && !confirm('Isto substitui a legenda que está escrita. Continuar?')) {
      return false;
    }

    const conteudoAtual = sobre.conteudo ?? conteudo;
    const produtoAtual = sobre.produto !== undefined ? sobre.produto : produto;

    setEscrevendoLegenda(true);
    try {
      const r = await fetch('/api/estudio/legenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelo: modelo.codigo,
          assunto,
          conteudo: conteudoAtual,
          produto: produtoAtual ? descreverProduto(produtoAtual) : '',
        }),
      });
      const dados = await r.json();
      if (!r.ok) {
        toast({ ok: false, message: dados?.erro ?? 'Não consegui escrever a legenda agora.' });
        return false;
      }
      // O crédito da foto não é opcional: CC BY e CC BY-SA exigem atribuição
      // na publicação, e a legenda é onde a publicação tem texto. Entra depois
      // das hashtags, numa linha só, para não disputar com o gancho.
      const creditoDaFoto = conteudoAtual.imagemCredito?.trim();
      setLegenda(creditoDaFoto ? `${dados.legenda}\n\n${creditoDaFoto}` : dados.legenda);

      if (!sobre.silencioso) {
        toast({ ok: true, message: 'Legenda escrita. Confira os números antes de publicar.' });
      }
      return true;
    } catch {
      toast({ ok: false, message: 'Não consegui falar com o servidor.' });
      return false;
    } finally {
      setEscrevendoLegenda(false);
    }
  }

  async function procurarImagemDeFora(c: Record<string, string>) {
    const termo = termoDaPeca(c, assunto);
    if (termo.length < 2) return;
    try {
      const r = await fetch(`/api/estudio/ilustrar?q=${encodeURIComponent(termo)}`);
      const d = await r.json();
      if (!r.ok) return;
      setBuscaDeImagem({ termo, lista: d.ilustracoes ?? [], chave: Date.now() });
      toast({
        ok: true,
        message: 'Nenhuma máquina do catálogo combina com este assunto — escolha uma imagem licenciada abaixo.',
      });
    } catch {
      // A busca é conforto. Falhar não pode derrubar a peça que já foi escrita.
    }
  }

  /** A peça inteira, de uma vez.
   *
   *  Era o que faltava. Vindo da pauta, o caminho tinha quatro cliques em
   *  ordem obrigatória — escrever, escolher produto, escrever legenda, gerar
   *  mensagem — e cada um esperava o anterior. Ordem obrigatória que a pessoa
   *  precisa lembrar é trabalho do programa, não do dono.
   *
   *  Em sequência e não em paralelo porque cada etapa é insumo da seguinte: a
   *  legenda fala do que o texto disse, e a mensagem de direct leva a máquina
   *  que a redação escolheu. */
  async function gerarPeca(silencioso = false) {
    if (gerando) return;
    setGerando(true);
    try {
      const escrita = await redigir(true);
      if (!escrita.ok) return;

      await escreverLegenda({
        silencioso: true,
        conteudo: escrita.conteudo,
        produto: escrita.produto,
      });

      // Catálogo primeiro, internet só quando a loja não tem. A redação já
      // tentou escolher uma máquina; se não achou nenhuma que combine, a busca
      // licenciada abre com os resultados. A escolha da foto fica com o dono:
      // a licença de cada uma precisa ser vista antes, e o crédito vai junto.
      if (escolhaAutomatica && !escrita.produto && !conteudo.imagem) {
        await procurarImagemDeFora(escrita.conteudo ?? {});
      }

      const palavra = palavraChaveDa(escrita.conteudo ?? {}, '');
      setRespostaDireta(
        mensagemPadrao({ palavra, produto: escrita.produto ?? null })
      );

      if (!silencioso) {
        toast({ ok: true, message: 'Peça escrita. Confira os números antes de publicar.' });
      }
    } finally {
      setGerando(false);
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

  /** O slide pedido, em JPEG, para a publicação.
   *
   *  JPEG porque a API do Instagram só aceita isso em imagem — PNG volta
   *  recusado no contêiner. E a troca de slide repete a espera do download em
   *  lote: o canvas é redesenhado por efeito, então exportar antes dela
   *  entregaria o desenho do slide anterior. */
  async function exportarJpeg(n: number): Promise<Blob | null> {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    if (n !== slide) {
      setSlide(n);
      await new Promise((r) => setTimeout(r, 450));
    }
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  }

  async function baixarVideo() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d') as Ctx | null | undefined;
    if (!canvas || !ctx) return;

    setGravando(true);
    const imagens =
      cacheRef.current.get(chaveDasImagens) ??
      (await carregarImagens({
        produto: fonteDoProduto,
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
      respostaDireta,
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

  /** Qualquer coisa rodando. Um só estado para travar os três botões: dois
   *  pedidos simultâneos para a mesma peça produziriam duas redações
   *  diferentes brigando pelo mesmo formulário. */
  const ocupado = gerando || redigindo || escrevendoLegenda;

  /** Obrigatórios ainda vazios, em todos os slides.
   *
   *  Em todos e não só no visível: num carrossel de cinco slides, o campo que
   *  falta costuma estar no slide que não está aberto — e descobrir isso
   *  depois de publicar é tarde. */
  const faltando = modelo.campos.filter((c) => c.obrigatorio && !conteudo[c.chave]?.trim());

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
            ajuda={
              escolhaAutomatica
                ? 'Uma linha basta. A peça sai escrita, com a máquina do catálogo escolhida pelo texto, legenda e resposta de direct. O que você digitou à mão não é sobrescrito.'
                : 'Uma linha basta. A peça sai escrita, com legenda e resposta de direct. Escolha a máquina abaixo — nesta peça ela é a decisão, não o cenário.'
            }
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void gerarPeca();
                  }
                }}
                placeholder="Ex.: por que importar dos EUA sai mais barato que comprar aqui"
                className="w-full rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13.5px]"
              />
              <button
                onClick={() => void gerarPeca()}
                disabled={ocupado || assunto.trim().length < 3}
                title="Escreve os campos, a legenda e a resposta de direct"
                className="flex flex-shrink-0 items-center justify-center gap-1.5 rounded-control bg-surface-light px-4 py-2.5 text-[13px] font-extrabold text-ink transition-all hover:bg-surface-light-alt disabled:cursor-not-allowed disabled:opacity-50"
              >
                {ocupado ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {gerando ? 'Escrevendo…' : 'Gerar peça'}
              </button>
              <button
                onClick={() => void redigir()}
                disabled={ocupado || assunto.trim().length < 3}
                title="Só os campos da arte, sem mexer na legenda"
                className="flex flex-shrink-0 items-center justify-center gap-1.5 rounded-control border border-border-strong px-3.5 py-2.5 text-[13px] font-extrabold text-fg-secondary transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {redigindo && !gerando ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
                Só a arte
              </button>
            </div>
          </Rotulo>

          {faltando.length > 0 && (
            <div className="mb-4 rounded-control border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-warning">
              Falta preencher: <b>{faltando.map((c) => c.rotulo).join(', ')}</b>. O playbook não
              aceita a peça sem isso, e o botão de publicar fica travado até preencher.
            </div>
          )}

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

          {camposDoSlide
            // Com máquina do catálogo escolhida a foto de fora não tem função: o
            // campo some, e a imagem de fora só aparece quando o catálogo não serve.
            .filter((c) => !(c.tipo === 'imagem' && escolhaAutomatica && produtoId))
            .map((campo) => (
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
              escolhaAutomatica={escolhaAutomatica}
              termoDeBusca={termoDaPeca(conteudo, assunto)}
              credito={conteudo.imagemCredito ?? ''}
              buscaInicial={buscaDeImagem}
              onEscolherImagem={(url, cred) => {
                setConteudo((atual) => ({ ...atual, imagem: url, imagemCredito: cred }));
                // O crédito acompanha a escolha mesmo com a legenda já escrita.
                setLegenda((l) => comCredito(l, cred, conteudo.imagemCredito ?? ''));
              }}
            />
          ))}
        </div>

        <div className="rounded-[18px] border border-border bg-card p-6">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <div className="text-[12.5px] font-bold">Legenda</div>
            <button
              onClick={() => void escreverLegenda()}
              disabled={escrevendoLegenda}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-control border border-border-strong px-3 py-1.5 text-[12px] font-extrabold text-fg-secondary transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {escrevendoLegenda ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Wand2 size={13} />
              )}
              Escrever legenda
            </button>
          </div>
          <div className="mb-1.5 text-[12px] leading-relaxed text-fg-tertiary">
            L1 gancho até 8 palavras · L2–4 três fatos com número · L5 CTA com palavra-chave · 3 a 5
            hashtags de nicho. Preço e parcela só entram se já estiverem na peça — o texto não
            inventa número.
          </div>
          <textarea
            value={legenda}
            onChange={(e) => setLegenda(e.target.value)}
            rows={8}
            className="w-full rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13.5px] leading-relaxed"
          />
          <div className="mt-1.5 text-[12px] text-fg-tertiary">
            {legenda.trim() ? `${legenda.trim().split(/\s+/).length} palavras` : 'Vazia'}
          </div>
        </div>

        <RespostaDoDirect
          palavraDetectada={palavraChave}
          produto={produto}
          valor={respostaDireta}
          onChange={setRespostaDireta}
        />
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

          {cortado.length > 0 && (
            <div className="mt-3 rounded-control border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-[12px] leading-relaxed text-warning">
              <b>Não coube e saiu com reticência:</b> {cortado.map((c) => `“${c}”`).join(' · ')}.
              Encurte o texto — aumentar o número de linhas empurraria o produto e o preço.
            </div>
          )}

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
              O vídeo dura 5 segundos e segue os tempos do playbook — produto em 1100ms, título em
              560ms com 90ms entre as linhas, preço depois de um respiro de 200ms. A gravação roda
              em tempo real, então a prévia anima enquanto grava.
            </div>
          )}

          <PublicarNoInstagram
            pecaId={peca?.id}
            formato={modelo.formato}
            slides={modelo.slides}
            legenda={legenda}
            exportar={exportarJpeg}
            impedimento={
              faltando.length > 0
                ? `Falta preencher ${faltando.map((c) => c.rotulo).join(', ')}.`
                : undefined
            }
          />

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

        <PreviaDoInstagram
          imagem={previa}
          formato={modelo.formato}
          slides={modelo.slides}
          slideAtual={slide}
          legenda={legenda}
          nomeDoDestaque={conteudo.nome}
        />
      </div>
    </div>
  );
}

function Rotulo({
  texto,
  ajuda,
  obrigatorio,
  vazio,
  children,
}: {
  texto: string;
  ajuda?: string;
  obrigatorio?: boolean;
  vazio?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold">
        {texto}
        {/* Ponto, e não asterisco: o asterisco some no meio de quinze campos.
            Ele acende quando o campo obrigatório está vazio. */}
        {obrigatorio && (
          <span
            title={vazio ? 'Obrigatório e ainda vazio' : 'Obrigatório'}
            className={`inline-block h-1.5 w-1.5 rounded-full ${vazio ? 'bg-warning' : 'bg-border-strong'}`}
          />
        )}
      </div>
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
  escolhaAutomatica,
  termoDeBusca,
  credito,
  buscaInicial,
  onEscolherImagem,
}: {
  campo: Campo;
  valor: string;
  produtos: ProdutoDoEstudio[];
  onChange: (v: string) => void;
  produtoEscolhido?: string;
  /** O seletor de ícone desenha a capa na direção deste modelo. */
  codigoDoModelo: string;
  /** Nesta peça a máquina é cenário e quem escolhe é a redação. */
  escolhaAutomatica?: boolean;
  termoDeBusca: string;
  credito: string;
  buscaInicial: { termo: string; lista: Ilustracao[]; chave: number } | null;
  onEscolherImagem: (url: string, credito: string) => void;
}) {
  const classe =
    'w-full rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13.5px]';

  // O aviso de palavras existe porque o limite do playbook é de leitura, não de
  // design: no grid do perfil a peça aparece com 3cm de largura.
  const palavras = valor.trim() ? valor.trim().split(/\s+/).length : 0;
  const passou = campo.maxPalavras ? palavras > campo.maxPalavras : false;
  const vazio = !valor.trim();

  if (campo.tipo === 'produto') {
    // Em peça onde a máquina é cenário, o seletor deixa de pedir uma decisão:
    // ele vira "a IA escolhe", com a opção de trocar. Pedir escolha onde não
    // há escolha a fazer é o que fazia o fluxo parecer manual.
    const automatico = escolhaAutomatica && campo.chave === 'produto';
    return (
      <Rotulo
        texto={automatico ? 'Máquina que ilustra' : campo.rotulo}
        ajuda={
          automatico
            ? 'Nesta peça o produto é cenário, não o assunto — a redação escolhe pelo texto. Troque só se quiser outra.'
            : campo.ajuda
        }
      >
        <select
          value={produtoEscolhido ?? valor}
          onChange={(e) => onChange(e.target.value)}
          className={classe}
        >
          <option value="">{automatico ? '— a IA escolhe —' : '— nenhum —'}</option>
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
      <Rotulo texto={campo.rotulo} ajuda={campo.ajuda} obrigatorio={campo.obrigatorio} vazio={vazio}>
        <SeletorDeIcone modelo={codigoDoModelo} valor={valor} onChange={onChange} />
      </Rotulo>
    );
  }

  if (campo.tipo === 'imagem') {
    return (
      <Rotulo
        texto={campo.rotulo}
        ajuda="Sua foto é sempre melhor. Quando não tiver, busque no acervo licenciado — a imagem é copiada para o nosso storage e o crédito entra na legenda."
        obrigatorio={campo.obrigatorio}
        vazio={vazio}
      >
        <SeletorDeIlustracao
          key={buscaInicial?.chave ?? 'sem-busca'}
          inicial={buscaInicial ? { termo: buscaInicial.termo, lista: buscaInicial.lista } : undefined}
          termoSugerido={termoDeBusca}
          valor={valor}
          credito={credito}
          onEscolher={onEscolherImagem}
        />
      </Rotulo>
    );
  }

  if (campo.tipo === 'textoLongo') {
    return (
      <Rotulo texto={campo.rotulo} ajuda={campo.ajuda} obrigatorio={campo.obrigatorio} vazio={vazio}>
        <textarea value={valor} onChange={(e) => onChange(e.target.value)} rows={3} className={classe} />
      </Rotulo>
    );
  }

  return (
    <Rotulo texto={campo.rotulo} ajuda={campo.ajuda} obrigatorio={campo.obrigatorio} vazio={vazio}>
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
