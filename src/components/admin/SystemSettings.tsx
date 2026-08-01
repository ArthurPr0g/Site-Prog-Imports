'use client';

import { useState, useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { parseNumeroBR } from '@/lib/format';
import { saveSystemSettingsAction, fetchUsdRateAction } from '@/app/actions/settings';

const inputClass =
  'rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13.5px] outline-none focus:border-accent';

export function SystemSettings({
  usdRate,
  usdRateSpread,
  defaultDeliveryTime,
  contractorName,
  contractorDoc,
  contractorRole,
  contractForum,
}: {
  usdRate: number | null;
  usdRateSpread: number;
  defaultDeliveryTime: string;
  contractorName: string;
  contractorDoc: string;
  contractorRole: string;
  contractForum: string;
}) {
  const [cotacao, setCotacao] = useState(usdRate !== null ? String(usdRate) : '');
  const [taxa, setTaxa] = useState(String(usdRateSpread));
  const [prazo, setPrazo] = useState(defaultDeliveryTime);
  const [contratado, setContratado] = useState(contractorName);
  const [documento, setDocumento] = useState(contractorDoc);
  const [cargo, setCargo] = useState(contractorRole);
  const [foro, setForo] = useState(contractForum);
  const [origem, setOrigem] = useState('');
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function buscar() {
    startTransition(async () => {
      const result = await fetchUsdRateAction();
      toast(result.message);
      if (result.ok && result.rate) {
        setCotacao(String(result.rate));
        setOrigem(`Mercado R$ ${result.market?.toFixed(4)} em ${result.when} · ainda não salvo`);
      }
    });
  }

  function salvar() {
    startTransition(async () => {
      const result = await saveSystemSettingsAction({
        usdRate: cotacao.trim() === '' ? null : parseNumeroBR(cotacao),
        usdRateSpread: parseNumeroBR(taxa),
        defaultDeliveryTime: prazo,
        contractorName: contratado,
        contractorDoc: documento,
        contractorRole: cargo,
        contractForum: foro,
      });
      toast(result);
      if (result.ok) setOrigem('');
    });
  }

  return (
    <div className="rounded-[18px] border border-border bg-card p-6">
      <div className="mb-1 text-[15px] font-extrabold">Parâmetros do sistema</div>
      <div className="mb-4 text-[12.5px] text-fg-tertiary">
        A cotação é a fonte única dos orçamentos — nunca é digitada no formulário do orçamento. Ao salvar,
        os orçamentos <strong>ainda não aprovados</strong> são recalculados automaticamente; os aprovados
        ficam congelados com o câmbio do dia em que fecharam.
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
            Cotação do dólar (R$)
          </div>
          <div className="flex gap-2">
            <input
              value={cotacao}
              onChange={(e) => setCotacao(e.target.value)}
              inputMode="decimal"
              placeholder="Ex: 5,42"
              className={`min-w-0 flex-1 ${inputClass}`}
            />
            <button
              onClick={buscar}
              disabled={pending}
              title="Buscar cotação de mercado e somar a taxa"
              aria-label="Buscar cotação atual"
              className="grid h-[42px] w-[42px] flex-shrink-0 place-items-center rounded-control border border-border-strong text-fg-tertiary hover:border-accent hover:text-accent disabled:opacity-50"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
            Taxa por dólar (R$)
          </div>
          <input
            value={taxa}
            onChange={(e) => setTaxa(e.target.value)}
            inputMode="decimal"
            placeholder="0,10"
            className={`w-full ${inputClass}`}
          />
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
            Prazo de entrega padrão
          </div>
          <input
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
            placeholder="Ex: 15 a 25 dias úteis"
            className={`w-full ${inputClass}`}
          />
        </div>
      </div>

      {origem && <div className="mt-2 text-[12px] text-warning">{origem}</div>}

      <div className="mt-2 text-[12px] text-fg-faded">
        O botão de atualizar busca a cotação de mercado e soma a taxa por dólar — o custo real da moeda para
        a Prog. O valor entra no campo para conferência, mas só passa a valer depois de salvar.
      </div>

      <div className="mt-7 border-t border-divider pt-6">
        <div className="mb-1 text-[15px] font-extrabold">Dados para contratos</div>
        <div className="mb-4 text-[12.5px] text-fg-tertiary">
          Saem no rodapé e na assinatura do PDF de proposta. Ficam aqui, e não no código, porque o repositório
          do projeto é <strong>público</strong> — CPF em arquivo versionado fica exposto para sempre, inclusive
          no histórico.
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
              Nome do contratado
            </div>
            <input
              value={contratado}
              onChange={(e) => setContratado(e.target.value)}
              placeholder="Nome completo de quem assina"
              className={`w-full ${inputClass}`}
            />
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
              CPF / CNPJ
            </div>
            <input
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              placeholder="000.000.000-00"
              className={`w-full ${inputClass}`}
            />
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
              Qualificação
            </div>
            <input
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Ex: Pessoa Física, desenvolvedor de websites"
              className={`w-full ${inputClass}`}
            />
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
              Foro (comarca)
            </div>
            <input
              value={foro}
              onChange={(e) => setForo(e.target.value)}
              placeholder="Ex: Goiânia – GO"
              className={`w-full ${inputClass}`}
            />
          </div>
        </div>
      </div>

      <button
        onClick={salvar}
        disabled={pending}
        className="mt-5 rounded-control bg-accent px-6 py-2.5 text-[13.5px] font-extrabold text-page disabled:opacity-60"
      >
        {pending ? 'Salvando…' : 'Salvar parâmetros'}
      </button>
    </div>
  );
}
