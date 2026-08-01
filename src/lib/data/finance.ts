import { createClient } from '@/lib/supabase/server';
import type { FinanceEntry, FinanceKind, FinanceSource, FinanceStatus } from '@/lib/finance';

type Row = {
  id: string;
  kind: string;
  description: string;
  amount: number;
  entry_date: string;
  status: string;
  source: string;
  reference_id: string | null;
};

function toEntry(r: Row): FinanceEntry {
  return {
    id: r.id,
    kind: r.kind as FinanceKind,
    description: r.description,
    amount: Number(r.amount),
    entryDate: r.entry_date,
    status: r.status as FinanceStatus,
    source: r.source as FinanceSource,
    referenceId: r.reference_id,
  };
}

/** Traz o livro inteiro. O filtro de período acontece na tela, ao vivo: o
 *  volume aqui é de centenas por ano, e ida ao servidor a cada troca de mês
 *  deixaria o filtro lento sem ganho nenhum. */
export async function listFinanceEntries(): Promise<FinanceEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('finance_entries')
    .select('*')
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });
  return (data ?? []).map((r) => toEntry(r as Row));
}

/** Data do primeiro lançamento, para o filtro "Tudo" saber onde começar. */
export async function primeiraMovimentacao(): Promise<string | undefined> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('finance_entries')
    .select('entry_date')
    .order('entry_date', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.entry_date ?? undefined;
}
