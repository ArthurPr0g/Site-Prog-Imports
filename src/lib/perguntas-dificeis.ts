// Perguntas difíceis que o cliente pode fazer ao vendedor, com resposta em
// linguagem simples. Fonte: o contrato que o ERP gera (src/lib/contract.ts,
// REGRAS_DO_CONTRATO e cláusulas) e o catálogo de serviços. Os números vêm
// das constantes do contrato: mudou lá, muda aqui sozinho.
//
// O que não está aqui o vendedor NÃO responde de cabeça: usa a frase de
// "vou confirmar" e manda a pergunta para o Arthur pelo botão da página.

import { REGRAS_DO_CONTRATO as R } from '@/lib/contract';
import { PLAN_MONTHS_DEFAULT } from '@/lib/services';

export type PerguntaDificil = { tema: string; pergunta: string; resposta: string };

export const REGRAS_DE_OURO = [
  'Nunca prometa prazo, desconto ou funcionalidade fora da tabela e do simulador.',
  'Nunca garanta posição no Google: ninguém sério garante primeiro lugar.',
  'Na dúvida, não chute: diga que vai confirmar e pergunte ao Arthur pelo botão abaixo.',
  'Proposta, contrato e preço especial são sempre com o Arthur: seu objetivo é chegar no "quero a proposta".',
];

export const FRASE_PARA_GANHAR_TEMPO =
  'Ótima pergunta! Quero te responder certinho, sem chute: vou confirmar com o responsável técnico e te retorno ainda hoje.';

export const PERGUNTAS_DIFICEIS: PerguntaDificil[] = [
  {
    tema: 'Domínio',
    pergunta: 'O domínio (endereço do site) fica no nome de quem?',
    resposta:
      'No nome do cliente, e é dele para sempre. O .com.br do 1º ano é por nossa conta; depois, a renovação anual é paga pelo cliente direto ao registro. Se ele já tiver domínio, só configuramos.',
  },
  {
    tema: 'Propriedade',
    pergunta: 'O site é meu? E se eu cancelar?',
    resposta: `É dele: depois do pagamento integral, os direitos do site passam para o cliente. Se cancelar, o domínio continua dele e os arquivos do site ficam disponíveis para cópia por ${R.arquivosDisponiveisDias} dias.`,
  },
  {
    tema: 'Propriedade',
    pergunta: 'E o sistema de gestão, é meu?',
    resposta: `O cliente recebe licença de uso permanente para o negócio dele, e os dados são sempre dele: se encerrar, exportamos tudo em planilha (pedido em até ${R.arquivosDisponiveisDias} dias). O código do sistema é da Prog Soluções, como em qualquer software.`,
  },
  {
    tema: 'Mensalidade',
    pergunta: 'O que a mensalidade cobre?',
    resposta:
      'Hospedagem (servidor), certificado de segurança (SSL), backups, monitoramento, atualizações de segurança, suporte pelo WhatsApp em horário comercial e pequenos ajustes no mês. Páginas ou funções novas são orçadas à parte.',
  },
  {
    tema: 'Contrato',
    pergunta: 'Tem fidelidade? Posso cancelar quando quiser?',
    resposta: `O plano tem prazo mínimo de ${PLAN_MONTHS_DEFAULT} meses (padrão da proposta). Cancelar antes tem multa de ${R.multaCancelamentoPlanoPct}% sobre as mensalidades que faltam; depois desse prazo, cancela com ${R.avisoPrevioCancelamentoDias} dias de aviso. A mensalidade é reajustada uma vez por ano pelo IPCA.`,
  },
  {
    tema: 'Prazo',
    pergunta: 'Quanto tempo demora para ficar pronto?',
    resposta:
      'O prazo de cada serviço está no simulador e no "o que inclui" (ex.: dias úteis). Ele conta a partir do sinal pago e do envio do material (logo, fotos, textos); se o material atrasar, o prazo anda junto.',
  },
  {
    tema: 'Alterações',
    pergunta: 'Quantas alterações eu posso pedir?',
    resposta: `${R.rodadasDeRevisao} rodadas de ajustes por serviço (os planos Premium têm 3), e em cada rodada dá para pedir tudo de uma vez. Alteração além disso é orçada antes.`,
  },
  {
    tema: 'Garantia',
    pergunta: 'E se der problema depois de entregue?',
    resposta: `Defeito de funcionamento é corrigido sem custo por ${R.garantiaDias} dias depois da entrega aprovada. Além disso, cada plano tem suporte (30, 60 ou 90 dias, conforme o nível) e a mensalidade cobre a manutenção do dia a dia.`,
  },
  {
    tema: 'Pagamento',
    pergunta: 'Como funciona o pagamento?',
    resposta:
      '50% para começar e 50% na entrega. No Brasil: Pix ou boleto, cartão em 2x sem juros ou parcelado em até 12x (com a taxa da operadora, veja no simulador). Para clientes dos EUA: 50% no início e 50% na entrega, no cartão.',
  },
  {
    tema: 'Contrato',
    pergunta: 'Posso desistir depois de assinar?',
    resposta: `Sim: quem contrata pela internet ou WhatsApp pode desistir em até ${R.arrependimentoDias} dias da assinatura e recebe tudo de volta (Código de Defesa do Consumidor). O contrato é assinado online.`,
  },
  {
    tema: 'Google',
    pergunta: 'Vou aparecer em primeiro no Google?',
    resposta:
      'O site sai preparado para o Google (SEO: básico, completo ou avançado, conforme o plano) e ligado ao perfil do Google Maps. A posição exata depende do próprio Google; desconfie de quem garante primeiro lugar.',
  },
  {
    tema: 'Conteúdo',
    pergunta: 'Vocês fazem as fotos e os textos?',
    resposta:
      'Fotos, vídeos e textos vêm do cliente (logo, fotos, contatos, redes sociais). Se ele não tem logo nem identidade visual, a Prog Soluções faz: Logo Essencial, Identidade a partir do logo ou Identidade Visual Completa (no simulador).',
  },
  {
    tema: 'Edição',
    pergunta: 'Consigo mexer no site sozinho?',
    resposta:
      'O Site Premium vem com painel para editar todo o site. Nos outros planos, as mudanças pequenas do mês já estão na mensalidade: o cliente pede pelo WhatsApp e a gente faz.',
  },
  {
    tema: 'Integrações',
    pergunta: 'Integra com nota fiscal, iFood, meu sistema atual…?',
    resposta:
      'Nota fiscal (NF-e, NFC-e, NFS-e) está no Sistema de Gestão Intermediário, com a API fiscal cobrada à parte pelo fornecedor dela. Qualquer outra integração depende do caso: anote qual é e pergunte ao Arthur antes de responder.',
  },
  {
    tema: 'Segurança',
    pergunta: 'Meus dados e os dos meus clientes ficam seguros?',
    resposta:
      'Sim: conexão segura (SSL), backups (diários no sistema de gestão), atualizações de segurança e contrato seguindo a LGPD, em que os dados são do cliente e a Prog Soluções só trata para prestar o serviço.',
  },
];
