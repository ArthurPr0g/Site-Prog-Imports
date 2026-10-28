import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/ui/Logo';
import { Footer } from '@/components/layout/Footer';
import { WHATSAPP_NUMBER } from '@/lib/constants';

// Política de privacidade (LGPD). Também é a página que a Meta exige para o app
// do WhatsApp/Instagram ("Prog Imports Estudio"): URL da política e, na âncora
// #exclusao-de-dados, as instruções de exclusão de dados.
// Só descreve o que o site faz de fato; ao ligar um serviço novo que trate dados
// pessoais, atualize a lista de "Com quem compartilhamos" e a data.

export const metadata: Metadata = {
  title: 'Política de privacidade',
  description: 'Como a Prog Imports coleta, usa, guarda e exclui dados pessoais, conforme a LGPD.',
  alternates: { canonical: '/privacidade' },
};

const ATUALIZADA_EM = '28/10/2026';

function Secao({ id, titulo, children }: { id?: string; titulo: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="mb-2 mt-9 text-[19px] font-extrabold text-fg">{titulo}</h2>
      <div className="space-y-3 text-[14.5px] leading-relaxed text-fg-secondary">{children}</div>
    </section>
  );
}

export default function PrivacidadePage() {
  const whats = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Olá! Quero falar sobre os meus dados pessoais.')}`;
  const excluir = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Olá! Quero excluir os meus dados pessoais.')}`;
  return (
    <div className="min-h-screen bg-page">
      <header className="mx-auto flex max-w-[860px] items-center px-6 py-6">
        <Link href="/" aria-label="Voltar para a home">
          <Logo height={52} />
        </Link>
      </header>

      <main className="mx-auto max-w-[860px] px-6 pb-16">
        <h1 className="titulo text-[30px] sm:text-[36px]">Política de privacidade</h1>
        <p className="mt-1.5 text-[13px] text-fg-tertiary">Atualizada em {ATUALIZADA_EM}</p>

        <Secao titulo="Quem somos">
          <p>
            A Prog Imports (www.prog-imports.com) é operada por Arthur Araújo de Matos, CNPJ 45.551.192/0001-62, com endereço
            comercial na Alameda Botafogo, Qd 36B, Lt 16-21, Setor Pedro Ludovico, Goiânia-GO, CEP 74820-010. Além da loja de
            tecnologia importada, oferecemos criação de sites, lojas virtuais, sistemas de gestão e identidade visual.
          </p>
          <p>
            Somos os responsáveis (controlador) pelos dados pessoais descritos aqui, nos termos da Lei Geral de Proteção de
            Dados (Lei 13.709/2018, LGPD).
          </p>
        </Secao>

        <Secao titulo="Quais dados coletamos">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <b className="text-fg">Cadastro e compras:</b> nome, e-mail e senha (guardada de forma criptografada), endereço de
              entrega, telefone e os dados dos seus pedidos. Para emitir o contrato de compra e venda ou de serviço, pedimos
              também CPF ou CNPJ.
            </li>
            <li>
              <b className="text-fg">Atendimento:</b> as mensagens que você troca conosco pelo WhatsApp, Instagram ou e-mail,
              com o seu número ou endereço e o nome do seu perfil.
            </li>
            <li>
              <b className="text-fg">Empresas que contatamos:</b> para oferecer nossos serviços, usamos dados públicos de empresas
              (nome, telefone e site comerciais, endereço, avaliações e horário de funcionamento) publicados no Google Maps e no
              site da própria empresa. Com eles montamos um diagnóstico gratuito da presença online da empresa.
            </li>
            <li>
              <b className="text-fg">Navegação:</b> usamos apenas os cookies necessários para manter você conectado e guardar o
              carrinho. Não usamos cookies de publicidade nem rastreadores de terceiros neste site.
            </li>
          </ul>
        </Secao>

        <Secao titulo="Para que usamos">
          <ul className="list-disc space-y-2 pl-5">
            <li>Processar compras, entregas, garantia e contratos (execução de contrato).</li>
            <li>Responder ao seu contato e dar continuidade ao atendimento que você pediu.</li>
            <li>
              Apresentar nossos serviços a empresas, com base no nosso legítimo interesse, sempre com a opção de pedir para não
              ser mais contatado.
            </li>
            <li>Cumprir obrigações legais e fiscais e nos defender em eventuais disputas.</li>
          </ul>
        </Secao>

        <Secao titulo="Atendimento com inteligência artificial">
          <p>
            Parte do atendimento pelo WhatsApp é feita pela Lia, uma assistente virtual com inteligência artificial. Para
            responder, as mensagens da conversa são processadas pelo serviço de IA da Anthropic (Claude). A Lia não toma
            decisões sozinha sobre contratos ou pagamentos: uma pessoa da equipe acompanha as conversas e pode assumir a
            qualquer momento. Se você preferir falar só com uma pessoa, é só pedir na conversa.
          </p>
        </Secao>

        <Secao titulo="Com quem compartilhamos">
          <p>Não vendemos dados pessoais. Compartilhamos apenas com os fornecedores que fazem o serviço funcionar:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Supabase (banco de dados e login) e Vercel (hospedagem do site);</li>
            <li>Meta (WhatsApp e Instagram), por onde as conversas acontecem;</li>
            <li>Anthropic, que processa as mensagens do atendimento com IA;</li>
            <li>o provedor de e-mail que usamos para enviar e receber mensagens;</li>
            <li>a InfinitePay, quando você paga com cartão pelo link de pagamento.</li>
          </ul>
          <p>
            Alguns desses fornecedores guardam dados fora do Brasil, com as garantias previstas na LGPD. Também podemos
            fornecer dados quando a lei ou uma ordem judicial exigir.
          </p>
        </Secao>

        <Secao titulo="Por quanto tempo guardamos">
          <p>
            Dados de compras e contratos ficam guardados pelo prazo exigido pela legislação fiscal e de defesa do consumidor.
            Conversas e dados de contato comercial ficam guardados enquanto houver relacionamento e, depois, por até 2 anos,
            a menos que você peça a exclusão antes.
          </p>
        </Secao>

        <Secao titulo="Seus direitos">
          <p>
            Pela LGPD, você pode pedir a qualquer momento: confirmação de que tratamos seus dados, acesso a eles, correção,
            anonimização, portabilidade, exclusão, informação sobre com quem compartilhamos e revogação do consentimento. Você
            também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
          </p>
          <p>
            Para exercer esses direitos,{' '}
            <a href={whats} target="_blank" rel="noreferrer" className="font-bold text-accent underline">
              fale com a gente pelo WhatsApp
            </a>
            . Respondemos em até 15 dias.
          </p>
        </Secao>

        <Secao id="exclusao-de-dados" titulo="Como excluir seus dados">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Envie a mensagem &quot;Quero excluir os meus dados&quot;{' '}
              <a href={excluir} target="_blank" rel="noreferrer" className="font-bold text-accent underline">
                pelo nosso WhatsApp
              </a>{' '}
              ou responda a qualquer e-mail nosso com esse pedido.
            </li>
            <li>Confirmamos que o pedido é seu, pelo mesmo número ou e-mail.</li>
            <li>
              Em até 15 dias excluímos seu cadastro, conversas e dados de contato, e avisamos quando terminar. Só mantemos o que
              a lei nos obriga a guardar (por exemplo, dados de notas e contratos), pelo prazo legal.
            </li>
          </ol>
          <p>Se a sua empresa recebeu um contato nosso e não quer mais ser procurada, o mesmo pedido vale para isso.</p>
        </Secao>

        <Secao titulo="Segurança">
          <p>
            Usamos conexão criptografada (HTTPS), controle de acesso por login e regras no banco de dados que limitam quem vê
            cada informação. Nenhum sistema é 100% seguro; se houver um incidente que traga risco a você, avisaremos você e a
            ANPD.
          </p>
        </Secao>

        <Secao titulo="Mudanças nesta política">
          <p>
            Quando esta política mudar, atualizaremos a data no topo da página. Mudanças importantes serão avisadas pelos nossos
            canais de atendimento.
          </p>
        </Secao>
      </main>

      <Footer />
    </div>
  );
}
