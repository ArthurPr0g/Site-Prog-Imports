import type { Metadata } from 'next';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { PreviaCarregamentos } from '@/brand/loaders/PreviaCarregamentos';

export const metadata: Metadata = { title: 'Telas de carregamento' };

/** Prévia das telas de carregamento da marca (só admin, fora do menu): serve
 *  para conferir estados que no uso real passam rápido demais. */
export default function CarregamentoPage() {
  return (
    <div>
      <AdminPageHeader title="Telas de carregamento" subtitle="As 4 cenas da marca Prog Soluções, em loop" />
      <PreviaCarregamentos />
    </div>
  );
}
