import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { Check, X, Minus, Star, MessageCircle, ArrowUpRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { WHATSAPP_NUMBER } from '@/lib/constants';
import { situacaoDoSite } from '@/lib/captacao';
import { linkWhatsApp } from '@/lib/mensagens-lead';
import { getCurrentUser } from '@/lib/auth';

// Diagnóstico de presença digital que vai no link da primeira mensagem da
// Captação. Público por token, lido pela função lead_diagnostico (só campos
// que já são públicos no Google). Fora do índice dos buscadores.

export const metadata: Metadata = {
  title: { absolute: 'Diagnóstico de presença digital · Prog Soluções' },
  robots: { index: false, follow: false },
};

type Diagnostico = {
  name: string;
  category: string | null;
  niche: string | null;
  city: string | null;
  state: string | null;
  country: 'BR' | 'US';
  website: string | null;
  site_check: string | null;
  instagram: boolean;
  rating: number | null;
  review_count: number | null;
  suggested_services: string[];
  concorrentes: { total: number; com_site: number; nota_media: number | null };
  screenshot_url: string | null;
  /** Aberto pelo link do vendedor (?k=): o botão vai para o WhatsApp dele. */
  vendedor: { nome: string; whatsapp: string | null } | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Quem monta a prévia do link (WhatsApp, Facebook, Telegram...) abre a página
// sozinho assim que a mensagem é enviada: não é o lead, não conta como visita.
const ROBO =
  /whatsapp|facebookexternalhit|facebot|telegrambot|slackbot|twitterbot|linkedinbot|discordbot|skypeuripreview|bot\b|crawler|spider|preview|headless/i;

const T = {
  pt: {
    titulo: 'Diagnóstico de presença digital',
    google: 'No Google',
    avaliacoes: (n: number) => `${n} avaliações`,
    elogio: 'Seus clientes já falam bem de vocês. O próximo passo é quem pesquisa encontrar um site à altura.',
    semAvaliacao: 'Poucas avaliações ainda: um site com depoimentos ajuda a passar confiança.',
    checklist: 'O que encontramos',
    itens: {
      siteProprio: 'Site próprio',
      semSite: 'Ainda não há um site próprio ligado ao Google',
      redeSocial: 'O link do Google leva para uma rede social, não para um site próprio',
      noAr: 'Site no ar',
      fora: 'O site não abriu: o endereço parece fora do ar',
      parado: 'O endereço do site está à venda: o site de vocês saiu do ar',
      seguro: 'Conexão segura (HTTPS)',
      inseguro: 'O navegador mostra o site como "não seguro"',
      celular: 'Funciona bem no celular',
      naoCelular: 'O site não se adapta à tela do celular',
      lojaOnline: 'Venda online',
      instagram: 'Instagram ligado ao site',
      print: 'Seu site no celular hoje',
    },
    concorrentes: 'Comparando com a sua região',
    concorrentesTexto: (c: number, t: number, cidade: string) =>
      `Das ${t} empresas do mesmo ramo que analisamos em ${cidade}, ${c} têm site próprio no ar.`,
    notaMedia: (n: string) => `Nota média deles no Google: ${n}`,
    recomendo: 'O que eu recomendo',
    cta: 'Conversar no WhatsApp',
    portfolio: 'Ver trabalhos',
    rodape: 'Análise feita com informações públicas do Google Maps e do site da empresa.',
    msg: (empresa: string, quem: string) => `Oi, ${quem}! Vi o diagnóstico de ${empresa} e quero conversar.`,
    portfolioUrl: 'https://portfolio-arthur-prog.vercel.app/pt',
  },
  en: {
    titulo: 'Online presence review',
    google: 'On Google',
    avaliacoes: (n: number) => `${n} reviews`,
    elogio: 'Your customers already speak highly of you. Next step: a website that matches that reputation.',
    semAvaliacao: 'Few reviews so far: a website with testimonials helps build trust.',
    checklist: 'What we found',
    itens: {
      siteProprio: 'Own website',
      semSite: 'No website of your own linked on Google yet',
      redeSocial: 'Your Google link goes to a social profile, not your own website',
      noAr: 'Website online',
      fora: "The website didn't load: the address seems to be down",
      parado: 'Your website address is up for sale: the site is no longer online',
      seguro: 'Secure connection (HTTPS)',
      inseguro: 'Browsers show the website as "not secure"',
      celular: 'Works well on phones',
      naoCelular: "The website doesn't fit phone screens",
      lojaOnline: 'Online sales',
      instagram: 'Instagram linked on the website',
      print: 'Your website on a phone today',
    },
    concorrentes: 'Compared to your area',
    concorrentesTexto: (c: number, t: number, cidade: string) =>
      `Of the ${t} businesses in your field we looked at in ${cidade}, ${c} have their own website online.`,
    notaMedia: (n: string) => `Their average Google rating: ${n}`,
    recomendo: 'What I recommend',
    cta: 'Chat on WhatsApp',
    portfolio: 'See my work',
    rodape: "Review based on public information from Google Maps and the company's website.",
    msg: (empresa: string, quem: string) => `Hi ${quem}! I saw the review for ${empresa} and I'd like to talk.`,
    portfolioUrl: 'https://portfolio-arthur-prog.vercel.app/en',
  },
};

const SERVICOS: Record<string, { pt: string; en: string }> = {
  'Site Essencial': {
    pt: 'Site profissional com WhatsApp, mapa e formulário, pronto para aparecer no Google.',
    en: 'A professional website with WhatsApp, map and contact form, ready to show up on Google.',
  },
  'Site Profissional': {
    pt: 'Site com layout criado para a sua marca, rápido no celular e com SEO completo.',
    en: 'A website designed for your brand, fast on phones, with full SEO.',
  },
  'Loja Essencial': {
    pt: 'Loja virtual com carrinho e pedido direto no WhatsApp, para vender além do balcão.',
    en: 'An online store with cart and orders straight to WhatsApp, to sell beyond the counter.',
  },
  'Sistema de Gestão Básico': {
    pt: 'Sistema de gestão: clientes, agenda ou estoque, orçamentos e financeiro num lugar só.',
    en: 'A management system: clients, scheduling or stock, quotes and finances in one place.',
  },
};

function Item({ ok, texto }: { ok: boolean | null; texto: string }) {
  const Icone = ok === null ? Minus : ok ? Check : X;
  const cor = ok === null ? 'bg-fg-faded/15 text-fg-tertiary' : ok ? 'bg-success/15 text-success' : 'bg-error/15 text-error';
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className={`mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full ${cor}`}>
        <Icone size={14} strokeWidth={3} />
      </span>
      <span className="text-[14.5px] leading-snug">{texto}</span>
    </li>
  );
}

export default async function DiagnosticoPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ previa?: string; k?: string }>;
}) {
  const { token } = await params;
  if (!UUID.test(token)) notFound();

  const supabase = await createClient();
  const { previa, k } = await searchParams;
  const kit = k && UUID.test(k) ? k : undefined;
  const { data } = await supabase.rpc('lead_diagnostico', { p_token: token, p_kit: kit });
  if (!data) notFound();
  const d = data as unknown as Diagnostico;

  // Conta a abertura (lead quente no painel), menos quando é o próprio dono
  // (link do painel com ?previa=1 ou sessão de admin) ou um robô de prévia.
  const ua = (await headers()).get('user-agent') ?? '';
  if (!previa && ua && !ROBO.test(ua)) {
    const usuario = await getCurrentUser();
    if (usuario?.role !== 'admin') await supabase.rpc('lead_registrar_visita', { p_token: token });
  }

  const lang = d.country === 'US' ? 'en' : 'pt';
  const t = T[lang];
  const sit = situacaoDoSite(d.website, d.site_check);
  const temSiteProprio = sit !== 'sem_site' && sit !== 'rede_social';
  const checado = !!d.site_check;
  const local = [d.city, d.state].filter(Boolean).join(' / ');
  const c = d.concorrentes;
  const recomendados = d.suggested_services.filter((s) => SERVICOS[s]);

  // Seções entram em sequência (CSS, sem JavaScript: a página é do servidor).
  let ordem = 0;
  const entrada = () => ({ animationDelay: `${0.08 + ordem++ * 0.09}s` });

  return (
    <div className="tema-apple min-h-screen overflow-x-clip bg-page [color-scheme:dark]">
    <div className="aurora" aria-hidden />
    <main className="mx-auto max-w-[720px] px-4 py-10 sm:px-6 sm:py-14">
      <div className="entrar mb-8" style={entrada()}>
        <div className="text-[12px] font-extrabold uppercase tracking-[.14em] text-[#64d2ff]">Prog Soluções</div>
        <h1 className="mt-2 font-display text-[30px] font-bold leading-tight tracking-[-.02em] sm:text-[40px]">
          <span className="texto-degrade">{t.titulo}</span>
        </h1>
        <div className="mt-2 text-[17px] font-bold">{d.name}</div>
        {/* A categoria do Google vem em inglês (o scraper busca com lang=en): só na versão em inglês. */}
        <div className="text-[13.5px] text-fg-tertiary">
          {[lang === 'en' ? d.category : null, local].filter(Boolean).join(' · ')}
        </div>
      </div>

      <section className="entrar mb-4 rounded-[22px] border border-border bg-card p-5 sm:p-6" style={entrada()}>
        <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[.08em] text-[#ffd60a]">{t.google}</div>
        {d.rating !== null ? (
          <div className="flex items-baseline gap-2.5">
            <span className="font-display text-[34px] font-bold tabular-nums">
              {lang === 'pt' ? d.rating.toFixed(1).replace('.', ',') : d.rating.toFixed(1)}
            </span>
            <Star size={20} className="fill-[#ffd60a] text-[#ffd60a] drop-shadow-[0_0_8px_rgba(255,214,10,.6)]" />
            <span className="text-[14px] text-fg-tertiary">{t.avaliacoes(d.review_count ?? 0)}</span>
          </div>
        ) : null}
        <p className="mt-2 text-[14px] leading-relaxed text-fg-secondary">
          {(d.review_count ?? 0) >= 30 && (d.rating ?? 0) >= 4.3 ? t.elogio : t.semAvaliacao}
        </p>
      </section>

      <section className="entrar mb-4 rounded-[22px] border border-border bg-card p-5 sm:p-6" style={entrada()}>
        <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[.08em] text-[#64d2ff]">{t.checklist}</div>
        <ul className="divide-y divide-divider">
          {sit === 'sem_site' && <Item ok={false} texto={t.itens.semSite} />}
          {sit === 'rede_social' && <Item ok={false} texto={t.itens.redeSocial} />}
          {temSiteProprio && <Item ok={true} texto={t.itens.siteProprio} />}
          {temSiteProprio && checado && (
            <Item
              ok={sit !== 'fora' && sit !== 'parado'}
              texto={sit === 'parado' ? t.itens.parado : sit === 'fora' ? t.itens.fora : t.itens.noAr}
            />
          )}
          {temSiteProprio && checado && sit !== 'fora' && sit !== 'parado' && (
            <>
              <Item
                ok={!d.site_check!.includes('sem_https')}
                texto={d.site_check!.includes('sem_https') ? t.itens.inseguro : t.itens.seguro}
              />
              <Item
                ok={!d.site_check!.includes('sem_celular')}
                texto={d.site_check!.includes('sem_celular') ? t.itens.naoCelular : t.itens.celular}
              />
              {d.site_check!.includes('vende_online') && <Item ok={true} texto={t.itens.lojaOnline} />}
            </>
          )}
          {d.instagram && <Item ok={true} texto={t.itens.instagram} />}
        </ul>
      </section>

      {c && c.total >= 4 && d.city && (
        <section className="entrar mb-4 rounded-[22px] border border-border bg-card p-5 sm:p-6" style={entrada()}>
          <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[.08em] text-[#bf5af2]">{t.concorrentes}</div>
          <p className="text-[14.5px] leading-relaxed">{t.concorrentesTexto(c.com_site, c.total, d.city)}</p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-fg-faded/15">
            <div className="barra-cor crescer h-full rounded-full shadow-[0_0_12px_rgba(10,132,255,.6)]" style={{ width: `${Math.round((c.com_site / c.total) * 100)}%` }} />
          </div>
          {c.nota_media !== null && (
            <p className="mt-3 text-[13px] text-fg-tertiary">
              {t.notaMedia(lang === 'pt' ? String(c.nota_media).replace('.', ',') : String(c.nota_media))}
            </p>
          )}
        </section>
      )}

      {d.screenshot_url && (
        <section className="entrar mb-4 rounded-[22px] border border-border bg-card p-5 sm:p-6" style={entrada()}>
          <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[.08em] text-[#ff9f0a]">{t.itens.print}</div>
          {/* Print feito no PC (iPhone simulado), guardado no Storage público */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={d.screenshot_url}
            alt={t.itens.print}
            loading="lazy"
            className="mx-auto max-h-[520px] w-auto rounded-[22px] border-[6px] border-[#1c1c1f] shadow-[0_10px_40px_rgba(0,0,0,.5)]"
          />
        </section>
      )}

      {recomendados.length > 0 && (
        <section className="borda-degrade entrar mb-6 rounded-[22px] border bg-card p-5 sm:p-6" style={entrada()}>
          <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[.08em] text-[#30d158]">{t.recomendo}</div>
          <ul className="space-y-2.5">
            {recomendados.map((s) => (
              <li key={s} className="text-[14.5px] leading-relaxed">
                {SERVICOS[s][lang]}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="entrar flex flex-col gap-3 sm:flex-row" style={entrada()}>
        <a
          href={linkWhatsApp(
            d.vendedor?.whatsapp || WHATSAPP_NUMBER,
            t.msg(d.name, d.vendedor?.whatsapp ? d.vendedor.nome.split(' ')[0] : 'Arthur')
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="cta-verde flex flex-1 items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-extrabold transition-all hover:-translate-y-0.5"
        >
          <MessageCircle size={17} /> {t.cta}
        </a>
        <a
          href={t.portfolioUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-full border border-border-strong bg-white/[.04] px-6 py-3.5 text-[15px] font-bold text-fg-secondary transition-all hover:-translate-y-0.5 hover:border-[#0a84ff] hover:text-[#64d2ff]"
        >
          {t.portfolio} <ArrowUpRight size={16} />
        </a>
      </div>

      <p className="mt-8 text-center text-[12px] text-fg-faded">{t.rodape}</p>
    </main>
    </div>
  );
}
