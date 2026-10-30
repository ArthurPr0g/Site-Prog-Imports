'use client';

// Time e fluxo (pedido do Arthur em 30/10/2026: "tenho muitas funções legais mas acabo esquecendo de algumas").
// Uma página só, no design "Noite azul", com: o time de agentes (quem é e o que faz), o fluxograma animado do
// processo inteiro (da chegada do lead ao pós-venda) e o catálogo de funções com busca. Tudo estático: quando
// um agente ou função mudar, atualize as listas abaixo e o docs/AGENTES.md.

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Bell, Bot, Brain, Check, Cloud, CodeXml, Copy, Eye, FlaskConical, FolderOpen, Hammer, LayoutDashboard, MessageCircle,
  Mic, Palette, Pause, PenTool, Play, RotateCcw, Rocket, Search, ShieldCheck, Smartphone, Sparkles, UserRound, Users,
  Wallet, Workflow, Wrench, Zap,
} from 'lucide-react';

type Icone = typeof Bot;
type Fase = 'atendimento' | 'financeiro' | 'design' | 'construcao' | 'qualidade' | 'entrega';

const FASES: Record<Fase, { nome: string; cor: string }> = {
  atendimento: { nome: 'Atendimento', cor: '#5b74ff' },
  financeiro: { nome: 'Financeiro', cor: '#34d3b4' },
  design: { nome: 'Abertura e design', cor: '#a08bff' },
  construcao: { nome: 'Construção', cor: '#f59e5b' },
  qualidade: { nome: 'Qualidade', cor: '#4cc9f0' },
  entrega: { nome: 'Entrega', cor: '#ff7aa8' },
};

const COR_VOCE = '#f5c84a';

type Agente = {
  chave: string;
  nome: string;
  papel: string;
  fase: Fase;
  Icon: Icone;
  onde: 'WhatsApp' | 'Claude Code' | 'Claude Design';
  automatico?: string;
  faz: string[];
  naoFaz: string;
  comando?: string;
};

const TIME: Agente[] = [
  {
    chave: 'lia', nome: 'Lia', papel: 'Atendimento e venda', fase: 'atendimento', Icon: MessageCircle, onde: 'WhatsApp',
    automatico: 'Sempre ligada',
    faz: ['Atende os leads a qualquer hora e descobre o que precisam', 'Pede o Instagram, monta o briefing e vende o pacote', 'Manda o link do sinal e te pergunta com botões o que precisa decidir', 'Recebe os ajustes que o cliente pede e chama o Leo'],
    naoFaz: 'Dar desconto ou prometer prazo sem você.',
    comando: 'Lia, chama esse contato: quer um site',
  },
  {
    chave: 'teo', nome: 'Téo', papel: 'Cobranças', fase: 'financeiro', Icon: Wallet, onde: 'Claude Code',
    faz: ['Confere no Asaas quem pagou o quê', 'Gera a cobrança da entrega e a mensalidade', 'Te mostra antes de mandar qualquer cobrança'],
    naoFaz: 'Cobrar o cliente sem o seu OK.',
    comando: 'Claude, Téo, confere os pagamentos do <cliente>',
  },
  {
    chave: 'bia', nome: 'Bia', papel: 'Abertura do projeto', fase: 'design', Icon: FolderOpen, onde: 'Claude Code',
    automatico: 'Quando o sinal é pago',
    faz: ['Cria a pasta do cliente com o BRIEFING.md', 'Junta o que a Captação sabe dele', 'Deixa prontos os pedidos da Duda e da Nina'],
    naoFaz: 'Criar banco de dados do cliente sem você pedir.',
  },
  {
    chave: 'duda', nome: 'Duda', papel: 'Identidade visual', fase: 'design', Icon: Palette, onde: 'Claude Design',
    faz: ['Paleta, fontes e componentes da marca', 'Regras de uso do logo do cliente'],
    naoFaz: 'Desenhar as telas (isso é com a Nina).',
    comando: 'Cole o PEDIDO-DUDA.md no Claude Design',
  },
  {
    chave: 'nina', nome: 'Nina', papel: 'Protótipo das telas', fase: 'design', Icon: PenTool, onde: 'Claude Design',
    faz: ['Protótipo navegável de todas as telas', 'Pacote de handoff para o Rafa construir'],
    naoFaz: 'Construir o site de verdade.',
    comando: 'Cole o PEDIDO-NINA.md no Claude Design',
  },
  {
    chave: 'rafa', nome: 'Rafa', papel: 'Construção', fase: 'construcao', Icon: Hammer, onde: 'Claude Code',
    faz: ['Transforma o protótipo em site, loja ou sistema', 'Repositório privado e prévia na Vercel', 'Celular primeiro e SEO básico'],
    naoFaz: 'Dar o projeto como pronto sem a vistoria.',
    comando: 'Claude, Rafa, constrói o projeto do <cliente>',
  },
  {
    chave: 'vera', nome: 'Vera', papel: 'Vistoria visual', fase: 'qualidade', Icon: Eye, onde: 'Claude Code',
    faz: ['Confere item a item o pacote vendido (✅/❌)', 'Compara com o protótipo', 'Testa no Android e no iPhone e guarda os prints'],
    naoFaz: 'Mexer no código: só aponta, com prova.',
    comando: 'Claude, Vera, confere o projeto do <cliente>',
  },
  {
    chave: 'caio', nome: 'Caio', papel: 'Revisão de código', fase: 'qualidade', Icon: CodeXml, onde: 'Claude Code',
    faz: ['Lê o código como um revisor sênior', 'Caça bugs, erros silenciosos e código duplicado', 'Aponta arquivo e linha, com a correção sugerida'],
    naoFaz: 'Mexer no código ou apontar gosto pessoal.',
    comando: 'Claude, Caio, revisa o projeto do <cliente>',
  },
  {
    chave: 'iris', nome: 'Íris', papel: 'Cibersegurança', fase: 'qualidade', Icon: ShieldCheck, onde: 'Claude Code',
    faz: ['Procura chaves e senhas expostas no código', 'Confere banco (RLS), cabeçalhos e bibliotecas com falha', 'Formulários, links externos e LGPD'],
    naoFaz: 'Atacar de verdade ou olhar fora do projeto do cliente.',
    comando: 'Claude, Íris, confere a segurança do <cliente>',
  },
  {
    chave: 'tito', nome: 'Tito', papel: 'Testes e desempenho', fase: 'qualidade', Icon: FlaskConical, onde: 'Claude Code',
    faz: ['Testes automáticos que clicam no site sozinhos', 'Nota do Lighthouse no celular (meta 90+)', 'Caça links e imagens quebrados'],
    naoFaz: 'Mudar o site para um teste passar.',
    comando: 'Claude, Tito, testa o projeto do <cliente>',
  },
  {
    chave: 'leo', nome: 'Leo', papel: 'Ajustes do cliente', fase: 'construcao', Icon: Wrench, onde: 'Claude Code',
    automatico: 'Quando o cliente pede à Lia',
    faz: ['Faz o ajuste pedido, só na pasta daquele cliente', 'Publica e escreve o resumo para a Lia mandar', 'Ajuste fora do pacote vai para você'],
    naoFaz: 'Abrir outros projetos ou mexer em dados e pagamentos.',
  },
  {
    chave: 'gabi', nome: 'Gabi', papel: 'Entrega', fase: 'entrega', Icon: Rocket, onde: 'Claude Code',
    faz: ['Escreve a mensagem da prévia para você aprovar', 'Publica a versão final e marca no Pós-venda', 'Pede ao Téo a cobrança e rascunha o case'],
    naoFaz: 'Mandar algo ao cliente ou publicar sem o seu OK.',
    comando: 'Claude, Gabi, prepara a entrega do <cliente>',
  },
];

const POR_CHAVE = Object.fromEntries(TIME.map((a) => [a.chave, a]));

type Etapa = {
  titulo: string;
  fase: Fase;
  quem: string[];
  voce?: string;
  auto?: string;
  texto: string;
  volta?: string;
  paralelo?: boolean;
};

const ETAPAS: Etapa[] = [
  {
    titulo: 'O lead chega', fase: 'atendimento', quem: ['lia'],
    auto: 'Pesquisa no Google, Maps e Instagram',
    voce: 'Indicação: "Lia, ..." + contato',
    texto: 'Pelo anúncio, pelo site, pela fila do Felipe ou por indicação sua. A Lia pesquisa a empresa sozinha e, se faltar algo no seu pedido, pergunta com botões antes de chamar.',
  },
  {
    titulo: 'Atendimento e briefing', fase: 'atendimento', quem: ['lia'],
    auto: 'Retomada 3 h depois e aviso de lead quente',
    voce: 'Desconto: você decide nos botões',
    texto: 'A Lia descobre o que o cliente precisa, pede o Instagram (que também é pesquisado), monta o briefing e apresenta o pacote certo.',
  },
  {
    titulo: 'Fechamento e sinal', fase: 'financeiro', quem: ['lia', 'teo'],
    auto: 'Link do sinal no Asaas',
    voce: 'Indicação: nada, sinal, total ou grátis',
    texto: 'A Lia manda o link do sinal na própria conversa. Em projeto por indicação, ela te pergunta como ficou o pagamento e o sistema procura no Asaas.',
  },
  {
    titulo: 'Abertura do projeto', fase: 'design', quem: ['bia'],
    auto: 'Sinal pago → tudo começa sozinho',
    texto: 'A venda cai na Prestação de serviço, a Lia pede o material ao cliente e a Bia cria a pasta com o briefing e os pedidos de design.',
  },
  {
    titulo: 'Identidade e protótipo', fase: 'design', quem: ['duda', 'nina'],
    voce: 'Você cola os pedidos no Claude Design',
    texto: 'A Duda define cores, fontes e componentes. A Nina desenha as telas navegáveis e gera o pacote de handoff.',
  },
  {
    titulo: 'Construção', fase: 'construcao', quem: ['rafa'],
    voce: '"Claude, Rafa, constrói o projeto do X"',
    texto: 'O Rafa transforma o protótipo em site de verdade, com repositório privado e prévia publicada na Vercel.',
  },
  {
    titulo: 'Vistoria completa', fase: 'qualidade', quem: ['vera', 'caio', 'iris', 'tito'], paralelo: true,
    voce: '"Claude, vistoria completa do X"',
    volta: 'Reprovou? Volta para o Rafa',
    texto: 'Os quatro conferem ao mesmo tempo: o que se vê (Vera), o código (Caio), a segurança (Íris) e os testes e a velocidade (Tito).',
  },
  {
    titulo: 'Aprovação do cliente', fase: 'entrega', quem: ['gabi', 'lia'],
    voce: 'Você aprova a mensagem',
    texto: 'A Gabi escreve a mensagem com a prévia. Com o seu OK, a Lia manda ao cliente, com as rodadas de ajuste e a oferta de reunião.',
  },
  {
    titulo: 'Entrega e cobrança', fase: 'entrega', quem: ['gabi', 'teo', 'lia'],
    voce: 'Você confirma a cobrança',
    texto: 'A Gabi publica a versão final, marca a entrega no Pós-venda e rascunha o case. O Téo gera a cobrança da entrega e a Lia envia. Projeto grátis: a Lia pede para publicar e marcar @prog.arthur.',
  },
  {
    titulo: 'Pós-venda e ajustes', fase: 'construcao', quem: ['lia', 'leo'],
    auto: 'Ajuste dentro do pacote → Leo',
    volta: 'Passa pela vistoria de novo',
    texto: 'O cliente pede ajuste à Lia. Se está nas rodadas do pacote, o Leo faz só na pasta dele e a Lia avisa o cliente. Fora do pacote, vai para você.',
  },
];

type Grupo = 'whatsapp' | 'felipe' | 'automatico' | 'painel';

const GRUPOS: { chave: Grupo | 'todos'; nome: string }[] = [
  { chave: 'todos', nome: 'Todas' },
  { chave: 'whatsapp', nome: 'No seu WhatsApp' },
  { chave: 'automatico', nome: 'Automático' },
  { chave: 'painel', nome: 'No painel' },
  { chave: 'felipe', nome: 'Do vendedor' },
];

type Funcao = { grupo: Grupo; Icon: Icone; titulo: string; texto: string; comando?: string; href?: string };

const FUNCOES: Funcao[] = [
  { grupo: 'whatsapp', Icon: UserRound, titulo: 'Novo projeto por indicação', texto: 'Mande o cartão do contato e uma mensagem começando com "Lia,". Ela confirma o pedido, tira dúvidas com você e depois pergunta o financeiro.', comando: 'Lia, chama esse contato: quer um site' },
  { grupo: 'whatsapp', Icon: Wallet, titulo: 'Registrar o valor do projeto', texto: 'Diga o valor fechado de um projeto por indicação.', comando: 'Lia, valor 3500' },
  { grupo: 'whatsapp', Icon: LayoutDashboard, titulo: 'Relatório da captação', texto: 'Funil, meta do semestre e custo da IA na hora.', comando: 'relatório' },
  { grupo: 'whatsapp', Icon: Bot, titulo: 'Pedido para o Claude Code', texto: 'Texto ou áudio começando com "Claude" vira pedido na fila. PC ligado: roda no PC. Desligado: a rotina na nuvem tenta a cada hora.', comando: 'Claude, ...' },
  { grupo: 'whatsapp', Icon: Users, titulo: 'Chamar um agente', texto: 'Diga o nome do agente depois de "Claude". Os avisos dizem qual agente fez.', comando: 'Claude, Rafa, constrói o projeto do <cliente>' },
  { grupo: 'whatsapp', Icon: ShieldCheck, titulo: 'Vistoria completa', texto: 'Vera, Caio, Íris e Tito conferem ao mesmo tempo e juntam os vereditos.', comando: 'Claude, vistoria completa do <cliente>' },
  { grupo: 'whatsapp', Icon: Sparkles, titulo: 'Anotar uma ideia', texto: 'Qualquer mensagem ou áudio que não seja pedido vira Ideia no Hub, já organizada.' },
  { grupo: 'whatsapp', Icon: FolderOpen, titulo: 'Dizer de qual projeto é', texto: 'Quando a Lia pergunta o projeto, toque no botão ou escreva.', comando: 'Projeto: Portfólio' },
  { grupo: 'whatsapp', Icon: RotateCcw, titulo: 'Desfazer mensagem errada', texto: 'Arquiva a última anotação dos últimos 30 minutos.', comando: 'desconsidera, mandei errado' },
  { grupo: 'whatsapp', Icon: Eye, titulo: 'Código da página Ideias', texto: 'A Lia te manda o código, pedido uma vez por aparelho.', comando: 'qual o código das ideias?' },
  { grupo: 'whatsapp', Icon: Check, titulo: 'Decidir com botões', texto: 'Desconto, financeiro, dúvidas de um pedido e projeto: é só tocar. Se a janela de 24 h fechou, vem como modelo com "Sim" e "Não".' },
  { grupo: 'automatico', Icon: Search, titulo: 'Pesquisa do lead', texto: 'Google, Maps e o Instagram que o cliente passar. As descobertas vão se somando com o tempo.' },
  { grupo: 'automatico', Icon: Bell, titulo: 'Retomada da conversa', texto: 'Cliente parou de responder: 3 h depois a Lia manda uma retomada curta, só em horário comercial.' },
  { grupo: 'automatico', Icon: Zap, titulo: 'Aviso de lead quente', texto: 'Abriu o diagnóstico e não chamou em 15 min: você recebe quem é e o telefone.' },
  { grupo: 'automatico', Icon: Bell, titulo: 'Lembrete de reunião', texto: 'A Lia lembra o cliente antes da reunião marcada.' },
  { grupo: 'automatico', Icon: Smartphone, titulo: 'Confere o site do lead', texto: 'Antes de dizer que o site está fora do ar, a Lia testa de novo na hora.' },
  { grupo: 'automatico', Icon: Brain, titulo: 'A Lia aprende', texto: 'Relê conversas encerradas e sugere lições. Só entra o que você aprova no painel.' },
  { grupo: 'automatico', Icon: Mic, titulo: 'Áudios viram texto', texto: 'Áudios do cliente e seus são transcritos antes de a IA ler.' },
  { grupo: 'automatico', Icon: Rocket, titulo: 'Sinal pago abre o projeto', texto: 'Prestação de serviço criada, material pedido ao cliente e a Bia na fila.' },
  { grupo: 'automatico', Icon: FolderOpen, titulo: 'Arquivos do cliente guardados', texto: 'Cliente fechado: o que ele mandou no WhatsApp é copiado antes de a Meta apagar (30 dias).' },
  { grupo: 'automatico', Icon: Wrench, titulo: 'Ajuste do cliente vai para o Leo', texto: 'Dentro das rodadas do pacote, feito só na pasta dele. Fora, vai para você.' },
  { grupo: 'automatico', Icon: MessageCircle, titulo: 'Modelos da Meta', texto: '10 mensagens prontas com botões, criadas e acompanhadas sozinhas, para falar fora da janela de 24 h.' },
  { grupo: 'automatico', Icon: Bell, titulo: 'Avisos com botão Abrir', texto: '"Comecei" e "Pedido concluído" com o agente que fez e um botão que abre a tela certa.' },
  { grupo: 'automatico', Icon: Cloud, titulo: 'Nuvem quando o PC desliga', texto: 'A cada hora uma rotina pega os pedidos que ficaram na fila e faz o que der pelo GitHub.' },
  { grupo: 'painel', Icon: LayoutDashboard, titulo: 'Captação', texto: 'Leads, conversas da Lia, pesquisa e briefing, modelos da Meta, lições e custo da IA.', href: '/admin/captacao' },
  { grupo: 'painel', Icon: Workflow, titulo: 'Pós-venda', texto: 'Projetos, rodadas de ajuste, reuniões, pasta do código e site publicado.', href: '/admin/pos-venda' },
  { grupo: 'painel', Icon: Wallet, titulo: 'Gastos', texto: 'Quanto custa a operação e cada venda, com os valores editáveis.', href: '/admin/gastos' },
  { grupo: 'painel', Icon: Hammer, titulo: 'Prestação de serviço', texto: 'Cada venda paga vira um projeto em andamento aqui.', href: '/admin/prestacao-servico' },
  { grupo: 'painel', Icon: FolderOpen, titulo: 'Catálogo de serviços', texto: 'Pacotes, preços e o que cada um inclui.', href: '/admin/servicos-internos' },
  { grupo: 'felipe', Icon: Users, titulo: 'Fila do dia', texto: 'Até 5 leads com a mensagem pronta para abrir no WhatsApp.', comando: 'fila' },
  { grupo: 'felipe', Icon: LayoutDashboard, titulo: 'Placar do vendedor', texto: 'Os números do Felipe na hora.', comando: 'relatório' },
];

const ENTRAR = (k: number) => ({ animationDelay: `${Math.min(k, 14) * 55}ms` });

function useMovimentoReduzido() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const id = requestAnimationFrame(() => setR(m.matches));
    const ouvir = () => setR(m.matches);
    m.addEventListener('change', ouvir);
    return () => {
      cancelAnimationFrame(id);
      m.removeEventListener('change', ouvir);
    };
  }, []);
  return r;
}

function Copiar({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(texto).then(() => {
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        });
      }}
      className="t-comando group flex w-full min-w-0 items-center gap-2 rounded-full border border-border bg-page/50 px-3 py-1.5 text-left text-[12px] text-fg-secondary"
      aria-label={`Copiar: ${texto}`}
    >
      <span className="min-w-0 flex-1 truncate font-mono">{texto}</span>
      <span className={`t-copiado grid h-5 w-5 flex-shrink-0 place-items-center rounded-full ${ok ? 'bg-[#34d3b4]/20 text-[#34d3b4]' : 'text-fg-tertiary group-hover:text-fg'}`}>
        {ok ? <Check size={12} /> : <Copy size={12} />}
      </span>
    </button>
  );
}

function Avatar({ a, tamanho = 44, atraso = 0 }: { a: Agente; tamanho?: number; atraso?: number }) {
  const cor = FASES[a.fase].cor;
  return (
    <span
      className="t-avatar relative grid flex-shrink-0 place-items-center rounded-full font-extrabold text-white"
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.42, ['--cor' as string]: cor, animationDelay: `${atraso}ms` }}
    >
      {a.nome[0]}
      <span className="absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full border-2 border-[#0c1230] bg-[#0c1230]" style={{ width: tamanho * 0.42, height: tamanho * 0.42, color: cor }}>
        <a.Icon size={tamanho * 0.24} />
      </span>
    </span>
  );
}

function CartaoDoAgente({ a, k }: { a: Agente; k: number }) {
  const cor = FASES[a.fase].cor;
  return (
    <article className="t-entrar t-cartao flex flex-col gap-3 rounded-[20px] border border-border bg-card p-4" style={{ ...ENTRAR(k), ['--cor' as string]: cor }}>
      <div className="flex items-center gap-3">
        <Avatar a={a} atraso={k * 55 + 200} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-bold leading-tight tracking-[-0.01em]">{a.nome}</h3>
          <p className="text-[12.5px] font-medium" style={{ color: cor }}>{a.papel}</p>
        </div>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10.5px] text-fg-tertiary">{a.onde}</span>
      </div>
      {a.automatico && (
        <span className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${cor}1f`, color: cor }}>
          <Zap size={11} /> Automático: {a.automatico}
        </span>
      )}
      <ul className="grid gap-1.5 text-[12.5px] text-fg-secondary">
        {a.faz.map((f) => (
          <li key={f} className="flex gap-2">
            <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: cor }} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11.5px] text-fg-faded">Não faz: {a.naoFaz}</p>
      {a.comando && <div className="mt-auto"><Copiar texto={a.comando} /></div>}
    </article>
  );
}

function SecaoTime() {
  const [fase, setFase] = useState<Fase | 'todas'>('todas');
  const lista = fase === 'todas' ? TIME : TIME.filter((a) => a.fase === fase);
  return (
    <section id="time" className="scroll-mt-20 space-y-3">
      <Cabecalho Icon={Users} titulo="O time" sub="12 agentes. A Lia é a única que fala com o cliente; os outros trabalham por trás e respondem a você." />
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {(['todas', ...Object.keys(FASES)] as (Fase | 'todas')[]).map((f) => {
          const ativo = fase === f;
          const cor = f === 'todas' ? '#5b74ff' : FASES[f].cor;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFase(f)}
              className="t-chip flex-shrink-0 rounded-full border px-3 py-1 text-[12px] font-medium"
              style={ativo ? { background: `${cor}26`, borderColor: `${cor}80`, color: '#fff' } : undefined}
              aria-pressed={ativo}
            >
              {f === 'todas' ? 'Todos' : FASES[f].nome}
            </button>
          );
        })}
      </div>
      <div key={fase} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {lista.map((a, k) => <CartaoDoAgente key={a.chave} a={a} k={k} />)}
      </div>
    </section>
  );
}

function Cabecalho({ Icon, titulo, sub, children }: { Icon: Icone; titulo: string; sub: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-accent/15 text-accent"><Icon size={17} /></span>
        <div>
          <h2 className="text-[20px] font-bold tracking-[-0.015em]">{titulo}</h2>
          <p className="max-w-[60ch] text-[12.5px] text-fg-tertiary">{sub}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function SecaoFluxo() {
  const reduzido = useMovimentoReduzido();
  const [ativa, setAtiva] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [altura, setAltura] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);
  const nos = useRef<(HTMLSpanElement | null)[]>([]);
  const etapas = useRef<(HTMLDivElement | null)[]>([]);

  // Altura do trilho aceso: até o centro da bolinha da etapa ativa.
  const medir = useCallback(() => {
    const n = nos.current[ativa];
    const c = caixa.current;
    if (!n || !c) return;
    setAltura(n.getBoundingClientRect().top - c.getBoundingClientRect().top + n.offsetHeight / 2);
  }, [ativa]);
  useLayoutEffect(() => {
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [medir]);

  // Rolando a página, a etapa do meio da tela acende (menos quando está tocando sozinho).
  useEffect(() => {
    if (tocando) return;
    const obs = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setAtiva(Number((e.target as HTMLElement).dataset.i))),
      { rootMargin: '-45% 0px -45% 0px' }
    );
    etapas.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [tocando]);

  // "Ver acontecendo": anda uma etapa a cada 3,2 s e leva a tela junto.
  useEffect(() => {
    if (!tocando) return;
    const id = setInterval(() => {
      setAtiva((i) => {
        if (i >= ETAPAS.length - 1) {
          setTocando(false);
          return i;
        }
        return i + 1;
      });
    }, 3200);
    return () => clearInterval(id);
  }, [tocando]);
  useEffect(() => {
    if (tocando) etapas.current[ativa]?.scrollIntoView({ block: 'center', behavior: reduzido ? 'auto' : 'smooth' });
  }, [ativa, tocando, reduzido]);

  const corAtiva = FASES[ETAPAS[ativa].fase].cor;

  return (
    <section id="fluxo" className="scroll-mt-20 space-y-4">
      <Cabecalho Icon={Workflow} titulo="O fluxo inteiro" sub="Do lead que chega ao pós-venda. Em amarelo, onde você entra; com raio, o que acontece sozinho.">
        <button
          type="button"
          onClick={() => {
            if (!tocando && ativa >= ETAPAS.length - 1) setAtiva(0);
            setTocando((t) => !t);
          }}
          className={`t-play flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#6a82ff,#3349f0)] px-4 py-2 text-[13px] font-semibold text-white ${tocando ? '' : 't-pulso'}`}
        >
          {tocando ? <Pause size={14} /> : <Play size={14} />}
          {tocando ? 'Pausar' : 'Ver acontecendo'}
        </button>
      </Cabecalho>

      <div className="flex flex-wrap gap-2 text-[11.5px]">
        <Legenda cor={COR_VOCE} Icon={UserRound} texto="Você decide" />
        <Legenda cor="#34d3b4" Icon={Zap} texto="Automático" />
        <Legenda cor="#ff7aa8" Icon={RotateCcw} texto="Volta uma etapa" />
        <span className="ml-auto self-center tabular-nums text-fg-tertiary">Etapa {ativa + 1} de {ETAPAS.length}</span>
      </div>

      <div ref={caixa} className="relative">
        {/* Trilho: cinza inteiro, aceso até a etapa ativa, com uma luz correndo. */}
        <span className="absolute bottom-6 left-[19px] top-6 w-[2px] rounded-full bg-border sm:left-[23px]" aria-hidden />
        <span
          className="t-trilho absolute left-[19px] top-6 w-[2px] rounded-full sm:left-[23px]"
          style={{ height: Math.max(0, altura - 24), ['--cor' as string]: corAtiva }}
          aria-hidden
        />
        <ol className="grid gap-3">
          {ETAPAS.map((e, i) => {
            const cor = FASES[e.fase].cor;
            const estado = i === ativa ? 'ativa' : i < ativa ? 'feita' : 'futura';
            return (
              <li key={e.titulo} className="relative grid grid-cols-[40px_1fr] gap-3 sm:grid-cols-[48px_1fr]">
                <span
                  ref={(el) => { nos.current[i] = el; }}
                  className={`t-no t-no-${estado} z-[1] mt-4 grid h-10 w-10 place-items-center rounded-full border-2 text-[14px] font-bold tabular-nums sm:h-12 sm:w-12`}
                  style={{ ['--cor' as string]: cor }}
                >
                  {estado === 'feita' ? <Check size={16} /> : i + 1}
                </span>
                <div
                  ref={(el) => { etapas.current[i] = el; }}
                  data-i={i}
                  onClick={() => { setTocando(false); setAtiva(i); }}
                  className={`t-etapa t-etapa-${estado} cursor-pointer rounded-[20px] border border-border bg-card p-4`}
                  style={{ ['--cor' as string]: cor }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: cor }}>{FASES[e.fase].nome}</span>
                  </div>
                  <h3 className="mt-0.5 text-[16px] font-bold tracking-[-0.01em]">{e.titulo}</h3>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-fg-secondary">{e.texto}</p>

                  {e.paralelo ? (
                    <div className="t-paralelo relative mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {e.quem.map((q, k) => {
                        const a = POR_CHAVE[q];
                        return (
                          <div key={q} className="t-par flex items-center gap-2 rounded-[14px] border border-border bg-page/40 p-2" style={{ ['--cor' as string]: FASES[a.fase].cor, animationDelay: `${k * 120}ms` }}>
                            <Avatar a={a} tamanho={30} />
                            <div className="min-w-0">
                              <b className="block text-[12.5px] leading-tight">{a.nome}</b>
                              <span className="block truncate text-[10.5px] text-fg-tertiary">{a.papel}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {e.quem.map((q, k) => {
                        const a = POR_CHAVE[q];
                        return (
                          <span key={q} className="flex items-center gap-1.5 rounded-full border border-border bg-page/40 py-0.5 pl-0.5 pr-2.5 text-[12px]">
                            <Avatar a={a} tamanho={24} atraso={k * 90} />
                            {a.nome}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {(e.voce || e.auto || e.volta) && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {e.voce && <Etiqueta cor={COR_VOCE} Icon={UserRound} texto={e.voce} />}
                      {e.auto && <Etiqueta cor="#34d3b4" Icon={Zap} texto={e.auto} />}
                      {e.volta && <Etiqueta cor="#ff7aa8" Icon={RotateCcw} texto={e.volta} />}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function Legenda({ cor, Icon, texto }: { cor: string; Icon: Icone; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-fg-tertiary">
      <span className="grid h-5 w-5 place-items-center rounded-full" style={{ background: `${cor}22`, color: cor }}><Icon size={11} /></span>
      {texto}
    </span>
  );
}

function Etiqueta({ cor, Icon, texto }: { cor: string; Icon: Icone; texto: string }) {
  return (
    <span className="t-etiqueta inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium" style={{ background: `${cor}1a`, color: cor }}>
      <Icon size={12} className="flex-shrink-0" />
      <span className="min-w-0">{texto}</span>
    </span>
  );
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function SecaoFuncoes() {
  const [grupo, setGrupo] = useState<Grupo | 'todos'>('todos');
  const [busca, setBusca] = useState('');
  const lista = useMemo(() => {
    const b = semAcento(busca.trim());
    return FUNCOES.filter((f) => (grupo === 'todos' || f.grupo === grupo) && (!b || semAcento(`${f.titulo} ${f.texto} ${f.comando ?? ''}`).includes(b)));
  }, [grupo, busca]);
  const nomeDoGrupo = Object.fromEntries(GRUPOS.map((g) => [g.chave, g.nome]));

  return (
    <section id="funcoes" className="scroll-mt-20 space-y-3">
      <Cabecalho Icon={Sparkles} titulo="Tudo o que o sistema faz" sub="Para não esquecer: o que você pode mandar no WhatsApp, o que roda sozinho e onde fica cada tela. Toque num comando para copiar." />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-full border border-border bg-input px-3 py-2">
          <Search size={14} className="text-fg-tertiary" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar (ex.: ajuste, relatório, desconto)" className="w-full bg-transparent text-[13px] outline-none placeholder:text-fg-faded" />
        </label>
        <div className="-mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1">
          {GRUPOS.map((g) => (
            <button key={g.chave} type="button" onClick={() => setGrupo(g.chave)} aria-pressed={grupo === g.chave} className={`t-chip flex-shrink-0 rounded-full border px-3 py-1 text-[12px] font-medium ${grupo === g.chave ? 't-chip-ativo' : ''}`}>
              {g.nome}
            </button>
          ))}
        </div>
      </div>
      {lista.length ? (
        <div key={`${grupo}-${busca}`} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((f, k) => {
            const corpo = (
              <>
                <div className="flex items-start gap-3">
                  <span className="t-icone grid h-9 w-9 flex-shrink-0 place-items-center rounded-[12px] bg-accent/15 text-accent"><f.Icon size={16} /></span>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-faded">{nomeDoGrupo[f.grupo]}</span>
                    <h3 className="text-[14.5px] font-bold leading-snug">{f.titulo}</h3>
                  </div>
                </div>
                <p className="text-[12.5px] leading-relaxed text-fg-secondary">{f.texto}</p>
              </>
            );
            return f.href ? (
              <Link key={f.titulo} href={f.href} className="t-entrar t-cartao flex flex-col gap-2 rounded-[18px] border border-border bg-card p-4" style={{ ...ENTRAR(k), ['--cor' as string]: '#5b74ff' }}>
                {corpo}
                <span className="mt-auto text-[12px] font-semibold text-accent">Abrir →</span>
              </Link>
            ) : (
              <div key={f.titulo} className="t-entrar t-cartao flex flex-col gap-2 rounded-[18px] border border-border bg-card p-4" style={{ ...ENTRAR(k), ['--cor' as string]: '#5b74ff' }}>
                {corpo}
                {f.comando && <div className="mt-auto"><Copiar texto={f.comando} /></div>}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-[18px] border border-dashed border-border p-6 text-center text-[13px] text-fg-tertiary">Nada com “{busca}”. Tente outra palavra.</p>
      )}
    </section>
  );
}

const SECOES = [
  { id: 'time', nome: 'Time' },
  { id: 'fluxo', nome: 'Fluxo' },
  { id: 'funcoes', nome: 'Funções' },
];

/** Navegação fixa com a pílula que desliza até a seção visível. */
function Navegacao() {
  const [ativa, setAtiva] = useState('time');
  const botoes = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pilula, setPilula] = useState({ x: 0, w: 0 });
  useEffect(() => {
    const obs = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setAtiva(e.target.id)), { rootMargin: '-30% 0px -60% 0px' });
    SECOES.forEach((s) => { const el = document.getElementById(s.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);
  useLayoutEffect(() => {
    const b = botoes.current[ativa];
    if (b) setPilula({ x: b.offsetLeft, w: b.offsetWidth });
  }, [ativa]);
  return (
    <nav className="sticky top-2 z-20 flex justify-center">
      <div className="vidro relative flex gap-1 rounded-full border border-border bg-[#0c1230]/80 p-1 backdrop-blur-xl">
        <span className="t-pilula absolute bottom-1 top-1 rounded-full bg-[linear-gradient(135deg,#6a82ff,#3349f0)]" style={{ transform: `translateX(${pilula.x - 4}px)`, width: pilula.w, left: 4 }} aria-hidden />
        {SECOES.map((s) => (
          <button
            key={s.id}
            ref={(el) => { botoes.current[s.id] = el; }}
            type="button"
            onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className={`relative z-[1] rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${ativa === s.id ? 'text-white' : 'text-fg-tertiary hover:text-fg'}`}
          >
            {s.nome}
          </button>
        ))}
      </div>
    </nav>
  );
}

function Resumo() {
  const itens: [number, string, Icone][] = [
    [TIME.length, 'agentes', Users],
    [ETAPAS.length, 'etapas do processo', Workflow],
    [FUNCOES.length, 'funções para lembrar', Sparkles],
    [ETAPAS.filter((e) => e.voce).length, 'pontos em que você decide', UserRound],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {itens.map(([n, rotulo, Icon], k) => (
        <div key={rotulo} className="t-entrar t-cartao t-brilho flex items-center gap-3 rounded-[18px] border border-border bg-card p-4" style={{ ...ENTRAR(k), ['--cor' as string]: '#5b74ff' }}>
          <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-accent/15 text-accent"><Icon size={18} /></span>
          <div className="min-w-0">
            <b className="block text-[24px] font-bold leading-none tabular-nums">{n}</b>
            <span className="text-[12px] text-fg-tertiary">{rotulo}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TimeEFluxo() {
  return (
    <div className="tema-apple time relative z-[1] space-y-8 pb-16 [color-scheme:dark]">
      <Navegacao />
      <Resumo />
      <SecaoTime />
      <SecaoFluxo />
      <SecaoFuncoes />
    </div>
  );
}
