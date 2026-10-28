// E-mail do atendente (primeiro contato, retornos e avisos para o Arthur), por
// SMTP: funciona com uma conta do Gmail com senha de app (2FA ligado) ou
// qualquer outro provedor. Só no servidor.

import nodemailer from 'nodemailer';

export const emailConfigurado = () =>
  !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transporte: nodemailer.Transporter | null = null;

function obterTransporte() {
  if (!transporte) {
    const porta = Number(process.env.SMTP_PORT || 465);
    transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: porta,
      secure: porta === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporte;
}

export async function enviarEmail(m: {
  para: string;
  assunto: string;
  texto: string;
  /** Nome que aparece como remetente (ex.: "Lia | Prog Soluções"). */
  nomeDoRemetente: string;
  responderPara?: string | null;
  /** Versão bonita; o texto puro vai junto (ajuda a não cair no spam). */
  html?: string;
}): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!emailConfigurado()) return { ok: false, erro: 'E-mail não configurado (SMTP_*)' };
  try {
    await obterTransporte().sendMail({
      from: { name: m.nomeDoRemetente, address: process.env.SMTP_FROM || process.env.SMTP_USER! },
      to: m.para,
      replyTo: m.responderPara || undefined,
      subject: m.assunto,
      text: m.texto,
      ...(m.html ? { html: m.html } : {}),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'falha no envio' };
  }
}
