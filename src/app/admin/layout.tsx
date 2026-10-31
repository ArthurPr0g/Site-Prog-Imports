import type { Metadata, Viewport } from 'next';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminSidebar';
import { RegistrarAppAdmin } from '@/components/admin/RegistrarAppAdmin';
import { PuxarParaAtualizar } from '@/components/admin/PuxarParaAtualizar';
import { AvisoDeVersaoNova } from '@/components/admin/VersaoNova';
import { SplashLoader } from '@/brand/loaders/SplashLoader';
import { CHAVE_SPLASH, CLASSE_SPLASH_VISTO } from '@/brand/loaders/sessao';
import { fontesDaMarca } from '@/brand/fontes';
import { contarDecisoesPendentes } from '@/app/actions/decisoes';

// Roda antes da primeira pintura: se o splash já passou nesta sessão, o CSS
// esconde o overlay na hora (sem piscar a tela preta a cada recarga).
// Injeta um <style> em vez de mexer em classe do <html> (que o React confere
// na hidratação).
const SCRIPT_SPLASH = `try{if(sessionStorage.getItem('${CHAVE_SPLASH}')){var s=document.createElement('style');s.textContent='.${CLASSE_SPLASH_VISTO}{display:none!important}';document.head.appendChild(s)}}catch(e){}`;

/** O painel não é conteúdo de busca. Fora do índice pelo mesmo motivo da área
 *  do cliente — e aqui vale duplamente: são telas com preço de custo, margem e
 *  dados de cliente.
 *
 *  O admin também é um app instalável, o "Prog Admin" (PWA): o manifesto em
 *  public/admin-app/ abre direto em /admin, com ícone próprio (escuro, com a
 *  etiqueta ADMIN) para não se confundir com a loja na tela inicial. No
 *  iPhone, apple-icon.png desta pasta é o ícone e `appleWebApp` dá o nome. */
export const metadata: Metadata = {
  title: 'Gerenciamento',
  robots: { index: false, follow: false },
  manifest: '/admin-app/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Prog Admin', statusBarStyle: 'black' },
};

export const viewport: Viewport = {
  themeColor: '#0b0b0c',
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) redirect('/entrar?next=/admin');
  // Contador do item "Decisões" no menu da Prog Soluções (0117).
  const decisoes = await contarDecisoesPendentes();

  return (
    // As fontes da marca (Sora, DM Sans) só existem no admin; `contents` não
    // cria caixa nenhuma, só declara as variáveis para os loaders.
    <div className={`contents ${fontesDaMarca}`}>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT_SPLASH }} />
      <SplashLoader />
      <RegistrarAppAdmin />
      <PuxarParaAtualizar />
      <AvisoDeVersaoNova />
      <AdminShell contadores={{ '/admin/decisoes': decisoes }}>{children}</AdminShell>
    </div>
  );
}
