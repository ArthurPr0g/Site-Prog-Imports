/** Aba "Desempenho": testes reais de jogos, programas, bateria e ruído.
 *
 *  Os números vêm do canal Bench Promos e só entram quando a máquina testada é a
 *  MESMA configuração do produto (modelo, processador e placa de vídeo) — o
 *  casamento é revisado à mão em scripts/benchmarks/casamentos.json. Por isso a
 *  aba sempre mostra a configuração testada e a fonte de cada número. */

export type Benchmark = {
  grupo: string;
  teste: string;
  ajuste: string | null;
  resultado: number;
  unidade: string;
  menor_melhor: boolean;
  posicao_ranking: number | null;
  total_ranking: number | null;
  config_testada: string;
  condicao: string | null;
  fonte: string;
  fonte_url: string;
  coletado_em: string;
};

const numero = (v: number) => v.toLocaleString('pt-BR');
const dataBR = (iso: string) => iso.split('-').reverse().join('/');
const horas = (min: number) => {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
};

/** Leitura do FPS para quem não é do meio: 60+ é a referência de jogo fluido. */
function selo(fps: number) {
  if (fps >= 60) return { texto: 'Fluido', cor: 'var(--color-success)' };
  if (fps >= 30) return { texto: 'Jogável', cor: 'var(--color-warning)' };
  return { texto: 'Abaixo de 30', cor: 'var(--prog-prata-escura)' };
}

/** O que cada teste mede, em uma linha. */
function oQueMede(teste: string) {
  if (/cinebench/i.test(teste)) return /gpu/i.test(teste) ? 'Renderização 3D na placa de vídeo' : 'Força do processador em renderização 3D';
  if (/blender/i.test(teste)) return 'Renderização 3D (Blender), muito usado em criação';
  if (/3dmark.*cpu/i.test(teste)) return 'Processador em cargas de jogos e simulação';
  if (/3dmark/i.test(teste)) return 'Placa de vídeo em cenas de jogo padronizadas';
  if (/geekbench/i.test(teste)) return 'Desempenho geral em tarefas do dia a dia e da GPU';
  if (/premiere/i.test(teste)) return 'Tempo para exportar vídeo no Adobe Premiere Pro';
  if (/davinci/i.test(teste)) return 'Exportação de vídeo no DaVinci Resolve';
  return null;
}

function Colocacao({ b }: { b: Benchmark }) {
  if (!b.posicao_ranking || !b.total_ranking) return null;
  return (
    <span className="text-[12px] text-fg-tertiary" title="Colocação entre todos os aparelhos que o Bench Promos testou neste mesmo teste">
      {b.posicao_ranking}º de {b.total_ranking} testados
    </span>
  );
}

export function Desempenho({ benchmarks }: { benchmarks: Benchmark[] }) {
  if (!benchmarks.length) return null;
  const jogos = benchmarks.filter((b) => b.grupo === 'jogo');
  const programas = benchmarks.filter((b) => b.grupo === 'programa');
  const extras = benchmarks.filter((b) => b.grupo === 'bateria' || b.grupo === 'ruido');
  const configs = [...new Set(benchmarks.map((b) => b.config_testada))];
  const condicoes = [...new Set(benchmarks.map((b) => b.condicao).filter(Boolean))] as string[];
  const maiorFps = Math.max(...jogos.map((j) => j.resultado), 60);
  const coleta = benchmarks[0].coletado_em;

  return (
    <div className="max-w-[1100px]">
      {/* De onde vêm os números — antes de qualquer número */}
      <div className="mb-8 rounded-2xl border border-border bg-card px-6 py-5">
        <div className="mb-1 text-xs font-extrabold uppercase tracking-[.12em] text-accent">Testes reais</div>
        <p className="text-[15px] leading-relaxed text-fg-secondary">
          Resultados medidos pelo canal <strong className="text-fg">{benchmarks[0].fonte}</strong> nesta mesma configuração:{' '}
          <strong className="text-fg">{configs.join(' / ')}</strong>
          {condicoes.length > 0 && <> — condição do teste: {condicoes.join(', ')}</>}.
        </p>
        <p className="mt-1.5 text-[13px] text-fg-tertiary">
          Só mostramos testes de uma máquina idêntica a esta (mesmo modelo, processador e placa de vídeo). Dados de {dataBR(coleta)}.
        </p>
      </div>

      {jogos.length > 0 && (
        <section className="mb-10">
          <h3 className="mb-1 font-display text-xl font-bold">Jogos</h3>
          <p className="mb-4 text-[13px] text-fg-tertiary">Quadros por segundo (FPS): quanto mais, mais suave. 60 FPS é a referência de jogo fluido.</p>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {jogos.map((j) => {
              const s = selo(j.resultado);
              return (
                <a key={j.fonte_url} href={j.fonte_url} target="_blank" rel="noopener noreferrer"
                  className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-border-hover"
                  title="Ver este teste no Bench Promos">
                  <div className="text-[15px] font-extrabold leading-snug">{j.teste}</div>
                  <div className="mb-3 text-[12.5px] text-fg-tertiary">{j.ajuste}</div>
                  <div className="mb-2 flex items-baseline gap-1.5">
                    <span className="font-display text-[34px] font-bold leading-none tracking-[-.02em]">{numero(j.resultado)}</span>
                    <span className="text-sm font-bold text-fg-secondary">FPS</span>
                    <span className="ml-auto rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-[.06em]" style={{ color: s.cor, borderColor: s.cor }}>
                      {s.texto}
                    </span>
                  </div>
                  <div className="mb-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--prog-borda)]">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (j.resultado / maiorFps) * 100)}%`, background: s.cor }} />
                  </div>
                  <Colocacao b={j} />
                </a>
              );
            })}
          </div>
        </section>
      )}

      {programas.length > 0 && (
        <section className="mb-10">
          <h3 className="mb-1 font-display text-xl font-bold">Programas e testes de desempenho</h3>
          <p className="mb-4 text-[13px] text-fg-tertiary">Pontuação: quanto mais, melhor. Tempo (minutos ou segundos): quanto menos, melhor.</p>
          <div className="overflow-hidden rounded-2xl border border-border">
            {programas.map((p) => {
              const mede = oQueMede(p.teste);
              return (
                <div key={p.fonte_url} className="grid grid-cols-1 gap-1 border-b border-border px-5 py-3.5 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6">
                  <div>
                    <div className="text-[14.5px] font-extrabold">
                      {p.teste}{p.ajuste ? <span className="font-semibold text-fg-secondary"> · {p.ajuste}</span> : null}
                    </div>
                    {mede && <div className="text-[12.5px] text-fg-tertiary">{mede}</div>}
                  </div>
                  <div className="flex items-baseline gap-3 sm:justify-end">
                    <span className="text-[17px] font-bold tabular-nums">
                      {numero(p.resultado)} <span className="text-[12.5px] font-semibold text-fg-secondary">{p.unidade.toLowerCase()}</span>
                    </span>
                    {p.menor_melhor && <span className="text-[11.5px] text-fg-tertiary">menor é melhor</span>}
                    <Colocacao b={p} />
                    <a href={p.fonte_url} target="_blank" rel="noopener noreferrer" className="text-[12px] font-bold text-accent">ver teste</a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {extras.length > 0 && (
        <section className="mb-10">
          <h3 className="mb-4 font-display text-xl font-bold">Bateria e ruído</h3>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {extras.map((e) => (
              <a key={e.fonte_url} href={e.fonte_url} target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-border-hover">
                <div className="text-[14.5px] font-extrabold">{e.grupo === 'bateria' ? `Bateria${e.ajuste ? ` · ${e.ajuste.toLowerCase()}` : ''}` : 'Ruído jogando'}</div>
                <div className="my-2 font-display text-[30px] font-bold leading-none tracking-[-.02em]">
                  {e.grupo === 'bateria' && /min/i.test(e.unidade) ? horas(e.resultado) : `${numero(e.resultado)} ${e.unidade}`}
                </div>
                <div className="mb-1 text-[12.5px] text-fg-tertiary">
                  {e.grupo === 'bateria' ? 'Tempo até descarregar, no teste do canal.' : 'Medido durante jogo — quanto menos, mais silencioso.'}
                </div>
                <Colocacao b={e} />
              </a>
            ))}
          </div>
        </section>
      )}

      <p className="text-[12.5px] text-fg-tertiary">
        Fonte:{' '}
        <a href="https://benchpromos.com.br/benchmarks" target="_blank" rel="noopener noreferrer" className="font-bold text-accent">Bench Promos — benchmarks</a>
        . Cada número leva ao teste original. Resultados podem variar com drivers, atualizações e modo de energia.
      </p>
    </div>
  );
}
