import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { LigarInstagram } from '@/components/estudio/LigarInstagram';
import { credenciais } from '@/lib/instagram/api';

export const metadata: Metadata = { title: 'Instagram' };

export default function InstagramDoEstudioPage() {
  // Só a presença das variáveis atravessa para o cliente. O valor fica no
  // servidor: token de publicação não tem por que chegar ao navegador, nem
  // mesmo na tela que o configura.
  const configurado = Boolean(credenciais());
  const temApp = Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);

  return (
    <div>
      <AdminPageHeader
        area="estudio"
        title="Instagram"
        subtitle="Ligar a conta da loja para publicar as peças direto do Estúdio"
        action={
          <Link
            href="/admin/estudio"
            className="rounded-control border border-border-strong px-4 py-2 text-[13px] font-extrabold text-fg-secondary hover:border-accent hover:text-accent"
          >
            Voltar
          </Link>
        }
      />
      <LigarInstagram configurado={configurado} temApp={temApp} />
    </div>
  );
}
