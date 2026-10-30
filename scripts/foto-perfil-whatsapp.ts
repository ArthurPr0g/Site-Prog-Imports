/**
 * Troca a foto de perfil do número da Lia (WhatsApp Cloud API). 30/10/2026: símbolo Prog Soluções
 * (avatar-redes-sociais.svg da identidade, desenhado em 640x640 JPEG).
 *   npx -y tsx scripts/foto-perfil-whatsapp.ts caminho/da/foto.jpg
 * Passos da Meta: upload retomável no app dono do token (/{app}/uploads → handle "h") e
 * POST /{phone-number-id}/whatsapp_business_profile com profile_picture_handle. O token nunca é impresso.
 */
import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RAIZ = resolve(__dirname, '..');
for (const l of readFileSync(join(RAIZ, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const V = process.env.WHATSAPP_GRAPH_VERSION || 'v23.0';
const G = `https://graph.facebook.com/${V}`;
const TOKEN = process.env.WHATSAPP_TOKEN!;
const FONE = process.env.WHATSAPP_PHONE_NUMBER_ID!;

async function main() {
  const arquivo = process.argv[2];
  if (!arquivo) throw new Error('Uso: foto-perfil-whatsapp.ts foto.jpg');
  const dados = readFileSync(arquivo);
  // App dono do token (o upload precisa ser nele).
  const dbg = (await (await fetch(`https://graph.facebook.com/debug_token?input_token=${TOKEN}&access_token=${TOKEN}`)).json()) as {
    data?: { app_id?: string; is_valid?: boolean };
  };
  const app = dbg.data?.app_id;
  if (!app) throw new Error('Não achei o app do token');
  const sessao = (await (
    await fetch(`${G}/${app}/uploads?file_name=perfil.jpg&file_length=${statSync(arquivo).size}&file_type=image/jpeg&access_token=${TOKEN}`, { method: 'POST' })
  ).json()) as { id?: string; error?: { message?: string } };
  if (!sessao.id) throw new Error(`upload: ${sessao.error?.message}`);
  const up = (await (
    await fetch(`${G}/${sessao.id}`, { method: 'POST', headers: { Authorization: `OAuth ${TOKEN}`, file_offset: '0' }, body: dados })
  ).json()) as { h?: string; error?: { message?: string } };
  if (!up.h) throw new Error(`envio: ${up.error?.message}`);
  const r = (await (
    await fetch(`${G}/${FONE}/whatsapp_business_profile`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', profile_picture_handle: up.h }),
    })
  ).json()) as { success?: boolean; error?: { message?: string } };
  if (!r.success) throw new Error(`perfil: ${r.error?.message}`);
  const perfil = (await (
    await fetch(`${G}/${FONE}/whatsapp_business_profile?fields=profile_picture_url,about,description`, { headers: { Authorization: `Bearer ${TOKEN}` } })
  ).json()) as { data?: { profile_picture_url?: string; about?: string }[] };
  console.log('foto trocada:', !!perfil.data?.[0]?.profile_picture_url, '| recado:', perfil.data?.[0]?.about ?? '-');
}
main().catch((e) => console.error('ERRO', e instanceof Error ? e.message : e));
