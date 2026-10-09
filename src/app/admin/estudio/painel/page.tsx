import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { carregarPainel } from '@/lib/instagram/painel';
import { PainelDoInstagram } from '@/components/estudio/painel/PainelDoInstagram';

export const metadata: Metadata = { title: 'Painel do Instagram' };

// Lê o Instagram a cada abertura: o painel é para ver o agora.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function PainelPage() {
  const dono = await requireAdmin();
  if (!dono) redirect('/admin');

  const supabase = await createClient();
  const painel = await carregarPainel(supabase);
  const usuario = painel.perfil?.usuario;

  return (
    <div>
      <AdminPageHeader
        area="estudio"
        title="Painel do Instagram"
        subtitle={
          usuario
            ? `@${usuario} — quem pediu o direct, como cada post foi e o que acompanhar`
            : 'Quem pediu o direct, como cada post foi e o que acompanhar'
        }
        action={
          <Link
            href="/admin/estudio"
            className="rounded-control border border-border-strong px-4 py-2 text-[13px] font-extrabold text-fg-secondary hover:border-accent hover:text-accent"
          >
            Voltar ao Estúdio
          </Link>
        }
      />

      <PainelDoInstagram painel={painel} />

      {!painel.temInsights && painel.configurado && (
        <div className="mt-5 rounded-[18px] border border-border bg-card px-5 py-4 text-[12.5px] leading-relaxed text-fg-tertiary">
          <b className="text-fg-secondary">Alcance, salvamentos e compartilhamentos</b> não aparecem porque o token atual
          não tem a permissão <code className="font-mono text-[11.5px]">instagram_manage_insights</code>. Na próxima
          renovação do token, em{' '}
          <Link href="/admin/estudio/instagram" className="underline hover:text-fg">
            Estúdio → Instagram
          </Link>
          , marque também essa permissão e o painel passa a mostrá-los.
        </div>
      )}
    </div>
  );
}
