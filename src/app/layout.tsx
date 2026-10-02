import type { Metadata } from "next";
import { Space_Grotesk, Manrope, JetBrains_Mono, Archivo } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { CartProvider } from "@/lib/cart-context";
import { FloatingAssistant } from "@/components/assistant/FloatingAssistant";
import { BRAND, brandCssVars } from "@/lib/brand";
import { SITE_URL, SITE_DESCRIPTION, OG_IMAGE_PADRAO } from "@/lib/seo";
import { JsonLd, organizationSchema, websiteSchema } from "@/components/seo/JsonLd";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  // 700 entra por causa do Estúdio: o playbook pede mono pesada em CTA de
  // story ("QUERO") e a fonte precisa estar carregada antes do canvas desenhar.
  weight: ["400", "500", "700"],
});

// Tipografia do playbook do Instagram. Vive no layout raiz, e não só no
// Estúdio, porque o canvas só desenha com a fonte que o documento já carregou —
// `document.fonts.load` não baixa o que a página não declarou.
// Sem lista de pesos de propósito: com `axes` declarado, o Next carrega a
// variável inteira, e é dela que vêm o 900 dos números gigantes e o eixo de
// largura que dá o "Archivo Expanded 115%" dos títulos. Declarar pesos fixos
// junto com `axes` é erro de build.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  // `metadataBase` é o que permite escrever caminhos relativos em canonical e
  // Open Graph — sem ele, o Next avisa e o link de compartilhamento sai
  // relativo, que nenhuma rede social consegue abrir.
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    // Cada página completa o título com o nome da loja, sem repetir a marca no
    // meio da frase. Antes toda página herdava o mesmo título, e o Google
    // mostrava 20 resultados idênticos do mesmo site.
    template: `%s | ${BRAND.name}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: BRAND.name,
  // Sem canonical padrão de propósito: como ele é herdado, um `canonical: '/'`
  // aqui fazia `/entrar` e `/conta` declararem-se cópias da home — dizendo ao
  // Google que aquelas URLs são a página inicial. Cada página pública declara o
  // seu; as páginas fora do índice não declaram nenhum, que é o certo.
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: BRAND.name,
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: SITE_DESCRIPTION,
    url: '/',
    images: [OG_IMAGE_PADRAO],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE_PADRAO.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // Sem limite de tamanho de trecho e miniatura: é o que permite ao Google
      // montar um resultado rico, com foto do produto.
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  formatDetection: { telephone: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${spaceGrotesk.variable} ${manrope.variable} ${jetbrainsMono.variable} ${archivo.variable}`}
      style={brandCssVars}
    >
      <body className="min-h-screen bg-page text-fg font-body antialiased">
        {/* Quem é a loja e o que é o site: vale para todas as páginas, então
            fica na raiz em vez de repetido em cada uma. */}
        <JsonLd schema={organizationSchema()} />
        <JsonLd schema={websiteSchema()} />
        <ToastProvider>
          <CartProvider>
            {children}
            <FloatingAssistant />
          </CartProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
