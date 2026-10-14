// Atividades da prestação de serviço e modelos de trabalho — regras puras, sem
// banco, usadas no servidor e na tela. Decisões em docs/ERP.md ("Atividades").

export type Atividade = {
  id: string;
  prestacaoId: string;
  titulo: string;
  notas: string;
  data: string; // AAAA-MM-DD
  feita: boolean;
  feitaEm: string | null;
  posicao: number;
};

export type ItemDeModelo = {
  id?: string;
  titulo: string;
  notas: string;
  /** Dias depois do início da prestação. 0 = no próprio dia do início. */
  dias: number;
};

export type Modelo = {
  id: string;
  nome: string;
  descricao: string;
  itens: ItemDeModelo[];
};

export type Situacao = 'feita' | 'atrasada' | 'hoje' | 'programada';

export function situacao(a: Pick<Atividade, 'feita' | 'data'>, hoje: string): Situacao {
  if (a.feita) return 'feita';
  if (a.data < hoje) return 'atrasada';
  if (a.data === hoje) return 'hoje';
  return 'programada';
}

/** Datas como texto AAAA-MM-DD, em UTC: sem fuso no meio, o dia não pula. */
export const somarDias = (d: string, n: number) =>
  new Date(Date.parse(d + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);

export const diasEntre = (de: string, ate: string) =>
  Math.round((Date.parse(ate + 'T00:00:00Z') - Date.parse(de + 'T00:00:00Z')) / 86_400_000);

/** "atrasada 3 dias", "hoje", "amanhã", "em 5 dias", "feita". */
export function quandoDaAtividade(a: Pick<Atividade, 'feita' | 'data'>, hoje: string): string {
  if (a.feita) return 'feita';
  const d = diasEntre(hoje, a.data);
  if (d < 0) return `atrasada ${-d} dia${d < -1 ? 's' : ''}`;
  if (d === 0) return 'hoje';
  if (d === 1) return 'amanhã';
  return `em ${d} dias`;
}

/** Ordem de exibição: o que falta primeiro (pela data), o que foi feito no fim. */
export function ordenarAtividades<T extends Pick<Atividade, 'feita' | 'data' | 'posicao'>>(lista: T[]): T[] {
  return [...lista].sort(
    (a, b) => Number(a.feita) - Number(b.feita) || a.data.localeCompare(b.data) || a.posicao - b.posicao
  );
}

export const dataCurta = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
