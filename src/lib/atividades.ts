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

/** Chave de comparação de títulos: sem acento, sem caixa, sem espaço sobrando.
 *  "Briefing com o cliente" e "briefing  com o Cliente" são a mesma etapa. */
export const chaveDoTitulo = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export type ItemMesclado = ItemDeModelo & { modeloId: string };

/** Junta os roteiros de vários modelos numa lista só, sem etapa repetida.
 *
 *  É o caso comum: a prestação vende site + sistema, loja + sistema. As etapas
 *  que os modelos têm em comum (contrato, briefing, criar o projeto, entrega)
 *  levam o MESMO título em todos eles e viram uma só:
 *  - a data é a **mais tardia** entre os modelos — "Publicar" e "Entrega" só
 *    acontecem quando todas as partes estão prontas;
 *  - as observações de cada serviço são somadas ("Site: … · Gestão: …").
 *  As etapas próprias de cada serviço correm em paralelo, cada uma no seu dia.
 *  `jaExistem` são os títulos que a prestação já tem: não entram de novo. */
export function mesclarModelos(modelos: Pick<Modelo, 'id' | 'itens'>[], jaExistem: string[] = []): ItemMesclado[] {
  const existentes = new Set(jaExistem.map(chaveDoTitulo));
  const porChave = new Map<string, ItemMesclado & { ordem: number }>();
  let ordem = 0;
  for (const m of modelos) {
    for (const it of m.itens) {
      const chave = chaveDoTitulo(it.titulo);
      if (!chave || existentes.has(chave)) continue;
      const atual = porChave.get(chave);
      if (!atual) {
        porChave.set(chave, { ...it, notas: it.notas.trim(), modeloId: m.id, ordem: ordem++ });
        continue;
      }
      atual.dias = Math.max(atual.dias, it.dias);
      const nota = it.notas.trim();
      if (nota && !atual.notas.split(' · ').includes(nota)) atual.notas = atual.notas ? `${atual.notas} · ${nota}` : nota;
    }
  }
  return [...porChave.values()]
    .sort((a, b) => a.dias - b.dias || a.ordem - b.ordem)
    .map((i) => ({ titulo: i.titulo, notas: i.notas, dias: i.dias, modeloId: i.modeloId }));
}
