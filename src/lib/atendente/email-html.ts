// Versão bonita (HTML) dos e-mails da Lia, no visual do portfólio da Prog
// Soluções (fundo quase preto no cabeçalho, azul-lavanda de destaque, verde do
// WhatsApp, Sora com fallback). Pedido do dono em 28/10/2026: "bonito, elegante,
// profissional e organizado". Leve de propósito (sem imagem, uma coluna): é 1º
// contato frio e e-mail pesado cai mais no spam. Sempre vai junto com o texto puro.
// Tabelas + estilo inline: é o que Gmail, Outlook e celular respeitam.

const COR = {
  fundo: '#f3f4f7',
  topo: '#0b0b0f',
  topoTexto: '#eceef1',
  topoSuave: '#9ba1ab',
  texto: '#1d2027',
  suave: '#5d626b',
  linha: '#e6e8ee',
  destaque: '#5b72d6',
  destaqueFundo: '#f2f4fd',
  whats: '#1f8f4e',
};
const FONTE = "'Sora','Segoe UI',Helvetica,Arial,sans-serif";

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export type PartesDoEmail = {
  /** Texto curto que o Gmail mostra ao lado do assunto. */
  previa: string;
  saudacao: string;
  paragrafos: string[];
  /** Cartão de destaque (o achado do diagnóstico). */
  destaque?: { titulo: string; texto: string };
  botao: { texto: string; url: string };
  linkSecundario?: { texto: string; url: string };
  notaDoBotao?: string;
  despedida: string;
  persona: string;
  tagline: string;
  endereco: string;
  descadastro: string;
};

/** Parágrafo com **negrito** simples (o nome da empresa). */
const paragrafo = (t: string) =>
  `<p style="margin:0 0 16px;font-family:${FONTE};font-size:15px;line-height:1.65;color:${COR.texto};">${esc(t).replace(
    /\*\*(.+?)\*\*/g,
    '<strong>$1</strong>'
  )}</p>`;

export function htmlDoEmail(p: PartesDoEmail): string {
  const destaque = p.destaque
    ? `<tr><td style="padding:4px 0 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COR.destaqueFundo};border-left:4px solid ${COR.destaque};border-radius:8px;">
          <tr><td style="padding:14px 18px;">
            <div style="font-family:${FONTE};font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${COR.destaque};margin-bottom:6px;">${esc(p.destaque.titulo)}</div>
            <div style="font-family:${FONTE};font-size:15px;line-height:1.55;color:${COR.texto};">${esc(maiuscula(p.destaque.texto))}.</div>
          </td></tr>
        </table>
      </td></tr>`
    : '';
  const secundario = p.linkSecundario
    ? `<tr><td align="center" style="padding:12px 0 0;">
        <a href="${esc(p.linkSecundario.url)}" style="font-family:${FONTE};font-size:14px;font-weight:600;color:${COR.destaque};text-decoration:none;">${esc(p.linkSecundario.texto)} &rarr;</a>
      </td></tr>`
    : '';
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(p.previa)}</title></head>
<body style="margin:0;padding:0;background:${COR.fundo};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(p.previa)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COR.fundo};">
  <tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${COR.linha};">
      <tr><td style="background:${COR.topo};padding:22px 32px;">
        <div style="font-family:${FONTE};font-size:19px;font-weight:700;color:${COR.topoTexto};letter-spacing:-.01em;">Prog Soluções</div>
        <div style="font-family:${FONTE};font-size:12px;color:${COR.topoSuave};margin-top:3px;">${esc(p.tagline)}</div>
      </td></tr>
      <tr><td style="padding:30px 32px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td>${paragrafo(p.saudacao)}${p.paragrafos.slice(0, 1).map(paragrafo).join('')}</td></tr>
          ${destaque}
          <tr><td>${p.paragrafos.slice(1).map(paragrafo).join('')}</td></tr>
          <tr><td align="center" style="padding:8px 0 0;">
            <a href="${esc(p.botao.url)}" style="display:inline-block;background:${COR.whats};color:#ffffff;font-family:${FONTE};font-size:15px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px;">${esc(p.botao.texto)}</a>
          </td></tr>
          ${p.notaDoBotao ? `<tr><td align="center" style="padding:8px 0 0;font-family:${FONTE};font-size:12.5px;color:${COR.suave};">${esc(p.notaDoBotao)}</td></tr>` : ''}
          ${secundario}
          <tr><td style="padding:28px 0 0;">${paragrafo(p.despedida)}</td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:0 32px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${COR.linha};">
          <tr><td style="padding-top:16px;">
            <div style="font-family:${FONTE};font-size:15px;font-weight:700;color:${COR.texto};">${esc(p.persona)}</div>
            <div style="font-family:${FONTE};font-size:13px;color:${COR.suave};margin-top:2px;">Prog Soluções · ${esc(p.tagline)}</div>
            <div style="font-family:${FONTE};font-size:12px;color:${COR.suave};margin-top:2px;">${esc(p.endereco)}</div>
          </td></tr>
        </table>
      </td></tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
      <tr><td align="center" style="padding:14px 24px 0;font-family:${FONTE};font-size:11.5px;line-height:1.5;color:${COR.suave};">${esc(p.descadastro)}</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
