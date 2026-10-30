'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { COR, FONTE, RAIO } from '../tokens';
import { CURVA, interpolate } from '../motion';
import { useMobile } from '../useTimeline';
import { SplashLoader } from './SplashLoader';
import { PageLoader } from './PageLoader';
import { AppLoader, type EtapaCarregamento } from './AppLoader';
import { DocLoader } from './DocLoader';

const CENAS = [
  { id: 'splash', nome: 'Abertura do sistema' },
  { id: 'spinner', nome: 'Página (spinner)' },
  { id: 'progresso', nome: 'Página (arco = progresso)' },
  { id: 'painel', nome: 'Painel (etapas)' },
  { id: 'documento', nome: 'Proposta (tema claro)' },
] as const;
type Cena = (typeof CENAS)[number]['id'];
const ETAPAS = ['Conectando ao ERP', 'Sincronizando CRM', 'Montando painel'];

/**
 * Prévia das 4 cenas de carregamento em loop, com eventos simulados nos
 * tempos da referência. Usa os mesmos componentes que o admin usa de verdade.
 */
export function PreviaCarregamentos() {
  const mobileTela = useMobile();
  const [modoEscolhido, setModo] = useState<'auto' | 'desktop' | 'mobile'>('auto');
  const modo = modoEscolhido === 'auto' ? (mobileTela ? 'mobile' : 'desktop') : modoEscolhido;
  const [fixa, setFixa] = useState<Cena | null>(null);
  const [i, setI] = useState(0);
  const [rodada, setRodada] = useState(0);
  const cena: Cena = fixa ?? CENAS[i].id;
  const chave = `${cena}-${modo}-${rodada}`;

  const proxima = () => {
    if (!fixa) setI((x) => (x + 1) % CENAS.length);
    setRodada((r) => r + 1);
  };

  const botao = (ativo: boolean): CSSProperties => ({
    padding: '8px 14px', borderRadius: RAIO.pilula, border: `1px solid ${ativo ? COR.accent : COR.lineStrong}`,
    background: ativo ? COR.ativo : 'transparent', color: ativo ? COR.accentStrong : COR.nav,
    fontFamily: FONTE.body, fontSize: 13, fontWeight: ativo ? 600 : 400, cursor: 'pointer',
  });

  const mobile = modo === 'mobile';
  const conteudo = <CenaSimulada key={chave} cena={cena} modo={modo} aoTerminar={proxima} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" style={botao(fixa === null)} onClick={() => { setFixa(null); setRodada((r) => r + 1); }}>
          Todas em sequência
        </button>
        {CENAS.map((c) => (
          <button key={c.id} type="button" style={botao(fixa === c.id)} onClick={() => { setFixa(c.id); setRodada((r) => r + 1); }}>
            {c.nome}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {(['auto', 'desktop', 'mobile'] as const).map((m) => (
          <button key={m} type="button" style={botao(modoEscolhido === m)} onClick={() => setModo(m)}>
            {m === 'auto' ? 'Pela largura da tela' : m === 'desktop' ? 'Computador' : 'Celular (390 pt)'}
          </button>
        ))}
        <span style={{ fontFamily: FONTE.mono, fontSize: 12, letterSpacing: '.08em', color: COR.dim }}>
          {CENAS.find((c) => c.id === cena)?.nome.toUpperCase()}
        </span>
      </div>

      {mobile ? (
        // O celular na medida da referência (390 × 844), reduzido para caber.
        <div style={{ width: 390 * 0.72, height: 844 * 0.72, margin: '0 auto', borderRadius: RAIO.modal, overflow: 'hidden', border: `1px solid ${COR.lineStrong}` }}>
          <div style={{ position: 'relative', width: 390, height: 844, transform: 'scale(0.72)', transformOrigin: '0 0', background: COR.ink, overflow: 'hidden' }}>
            {conteudo}
          </div>
        </div>
      ) : (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', minHeight: 560, borderRadius: RAIO.painel, overflow: 'hidden', background: COR.ink, border: `1px solid ${COR.lineStrong}` }}>
          {conteudo}
        </div>
      )}
      <p style={{ fontFamily: FONTE.body, fontSize: 13.5, color: COR.muted2, maxWidth: 720 }}>
        Os eventos (app pronto, etapas concluídas, progresso do PDF) são simulados nos tempos da referência. No sistema, os mesmos
        componentes seguem o carregamento real. Com &quot;reduzir movimento&quot; ligado no aparelho, todos viram símbolo sólido, barra e fade.
      </p>
    </div>
  );
}

/** Uma rodada de uma cena, com os eventos simulados a partir da montagem
 *  (montada de novo a cada rodada, então o relógio começa do zero). */
function CenaSimulada({ cena, modo, aoTerminar }: { cena: Cena; modo: 'desktop' | 'mobile'; aoTerminar: () => void }) {
  const [t, setT] = useState(0);
  const fim = useRef(aoTerminar);
  useEffect(() => {
    fim.current = aoTerminar;
  });
  useEffect(() => {
    const ini = performance.now();
    const id = setInterval(() => setT((performance.now() - ini) / 1000), 50);
    // Cenas de página não têm fim próprio: passam sozinhas.
    const dura = cena === 'spinner' ? 3200 : cena === 'progresso' ? 4200 : 0;
    const passa = dura ? setTimeout(() => fim.current(), dura) : undefined;
    return () => {
      clearInterval(id);
      clearTimeout(passa);
    };
  }, [cena]);

  const etapas: EtapaCarregamento[] = ETAPAS.map((nome, k) => ({ nome, feita: t > 1.5 + 0.9 * k }));
  const progPagina = interpolate([0.6, 1.5, 2.0, 2.7, 3.2], [0, 0.38, 0.46, 0.86, 1], CURVA.draw)(t);
  const progDoc = interpolate([1.4, 2.4, 3.3, 4.4], [0, 0.31, 0.62, 1], CURVA.draw)(t);
  const mobile = modo === 'mobile';
  const onFim = () => fim.current();

  return (
    <div style={{ position: 'absolute', inset: 0, padding: cena === 'painel' ? (mobile ? 16 : 32) : 0 }}>
      {cena === 'splash' && <SplashLoader forcar contido modo={modo} pronto={t > 1.5} onFim={onFim} />}
      {cena === 'spinner' && <PageLoader modo={modo} rotulo="ABRINDO AS VENDAS" altura="100%" />}
      {cena === 'progresso' && <PageLoader modo={modo} rotulo="ABRINDO AS VENDAS" progresso={progPagina} altura="100%" />}
      {cena === 'painel' && <AppLoader modo={modo} contido rotulo="Montando o painel" etapas={etapas} onFim={onFim} />}
      {cena === 'documento' && <DocLoader modo={modo} contido pronto={t > 4.4} progresso={progDoc} onFim={onFim} />}
    </div>
  );
}
