import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { dbDoAtendente } from '@/lib/atendente/db';
import { fontesDaMarca } from '@/brand/fontes';
import { AVISO_DE_GRAVACAO } from '@/lib/reunioes/comum';
import { EntradaDoCliente } from '@/components/reunioes/EntradaDoCliente';

// Página do cliente na sala de reunião (31/10/2026): sem login, pelo token forte do link. Lê pelo servidor só o
// necessário (primeiro nome, horário, meio); nada do lead vai para a prévia do link nem para os buscadores.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'Reunião · Prog Soluções' },
  description: 'Sua reunião por vídeo com a Prog Soluções.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#08080A', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

const TOKEN = /^[A-Za-z0-9_-]{40,60}$/;

export default async function ReuniaoDoClientePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN.test(token)) notFound();
  const { data: r } = await dbDoAtendente()
    .from('reunioes')
    .select('inicio, status, sala_status, sala_meio, leads(name, responsible_name)')
    .eq('sala_token', token)
    .maybeSingle();
  if (!r) notFound();
  const contato = (r.leads?.responsible_name || r.leads?.name?.split(' - ')[0] || '').trim().split(/\s+/)[0] ?? '';
  return (
    <div className={`tema-apple ds-prog ${fontesDaMarca} min-h-[100dvh] overflow-x-clip bg-page text-fg [color-scheme:dark]`}>
      <div className="aurora aurora-suave" aria-hidden />
      <EntradaDoCliente
        token={token}
        nome={contato}
        inicio={r.inicio}
        meio={r.sala_meio === 'meet' ? 'meet' : 'daily'}
        encerrada={r.sala_status === 'encerrada' || r.status === 'cancelada'}
        aviso={AVISO_DE_GRAVACAO}
      />
    </div>
  );
}
