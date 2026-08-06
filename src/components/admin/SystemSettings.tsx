'use client';

import { useState, useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { parseNumeroBR } from '@/lib/format';
import {
  saveSystemSettingsAction,
  fetchUsdRateAction,
  uploadSignatureAction,
  removeSignatureAction,
} from '@/app/actions/settings';

const inputClass =
  'rounded-control border border-border-strong bg-input px-3.5 py-2.5 text-[13.5px] outline-none focus:border-accent';

export type RemetenteForm = {
  senderName: string;
  senderDoc: string;
  senderPhone: string;
  senderCep: string;
  senderAddressLine: string;
  senderAddressNumber: string;
  senderComplement: string;
  senderDistrict: string;
  senderCity: string;
  senderState: string;
};

/** Campos do remetente, na ordem em que se escreve um envelope. */
const CAMPOS_REMETENTE: { chave: keyof RemetenteForm; rotulo: string; dica: string; largo?: boolean }[] = [
  { chave: 'senderName', rotulo: 'Nome / razão social', dica: 'Quem envia', largo: true },
  { chave: 'senderDoc', rotulo: 'CPF / CNPJ', dica: '000.000.000-00' },
  { chave: 'senderPhone', rotulo: 'Telefone', dica: '(62) 90000-0000' },
  { chave: 'senderCep', rotulo: 'CEP', dica: '74000-000' },
  { chave: 'senderAddressLine', rotulo: 'Rua / avenida', dica: 'Rua T-38', largo: true },
  { chave: 'senderAddressNumber', rotulo: 'Número', dica: '1200' },
  { chave: 'senderComplement', rotulo: 'Complemento', dica: 'Sala 4' },
  { chave: 'senderDistrict', rotulo: 'Bairro', dica: 'Setor Bueno' },
  { chave: 'senderCity', rotulo: 'Cidade', dica: 'Goiânia' },
  { chave: 'senderState', rotulo: 'UF', dica: 'GO' },
];

export function SystemSettings({
  usdRate,
  usdRateSpread,
  defaultDeliveryTime,
  contractorName,
  contractorDoc,
  contractorRole,
  contractForum,
  remetente: remetenteInicial,
  assinaturaUrl,
}: {
  usdRate: number | null;
  usdRateSpread: number;
  defaultDeliveryTime: string;
  contractorName: string;
  contractorDoc: string;
  contractorRole: string;
  contractForum: string;
  remetente: RemetenteForm;
  /** URL assinada e temporária da assinatura guardada. Vazio = não há. */
  assinaturaUrl: string;
}) {
  const [cotacao, setCotacao] = useState(usdRate !== null ? String(usdRate) : '');
  const [taxa, setTaxa] = useState(String(usdRateSpread));
  const [prazo, setPrazo] = useState(defaultDeliveryTime);
  const [contratado, setContratado] = useState(contractorName);
  const [documento, setDocumento] = useState(contractorDoc);
  const [cargo, setCargo] = useState(contractorRole);
  const [foro, setForo] = useState(contractForum);
  const [remetente, setRemetente] = useState<RemetenteForm>(remetenteInicial);
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

  function enviarAssinatura(arquivo: File) {
    startTransition(async () => {
      const dados = new FormData();
      dados.append('file', arquivo);
      toast(await uploadSignatureAction(dados));
    });
  }

  function removerAssinatura() {
    startTransition(async () => {
      toast(await removeSignatureAction());
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
        ...remetente,
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

      <div className="mt-7 border-t border-divider pt-6">
        <div className="mb-1 text-[15px] font-extrabold">Assinatura nos contratos</div>
        <div className="mb-4 text-[12.5px] text-fg-tertiary">
          Sai impressa no bloco do contratado, no PDF de proposta com contrato. Envie um{' '}
          <strong>PNG com fundo transparente</strong> — assinatura em JPG leva o retângulo branco
          junto e aparece uma emenda por cima do papel. Sem assinatura enviada, o contrato continua
          saindo com a linha em branco para você assinar à mão.
        </div>
        <div className="mb-3 rounded-control border border-border bg-card-dark px-4 py-3 text-[12px] text-fg-faded">
          O arquivo vai para um espaço <strong>privado</strong>, não para o código do projeto: o
          repositório é público, e uma imagem versionada fica no histórico para sempre. Com a imagem
          em mãos, qualquer pessoa monta um documento que parece assinado por você.
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {assinaturaUrl ? (
            <div className="rounded-control border border-border bg-white px-4 py-3">
              {/* Fundo branco atrás da prévia: é sobre branco que ela vai ser
                  impressa, e sobre o painel escuro um traço preto some. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={assinaturaUrl} alt="Assinatura cadastrada" className="h-[52px] w-auto object-contain" />
            </div>
          ) : (
            <div className="rounded-control border border-dashed border-border-strong px-5 py-4 text-[12.5px] text-fg-faded">
              Nenhuma assinatura enviada.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="cursor-pointer rounded-control border border-border-strong px-5 py-2.5 text-[13.5px] font-extrabold text-fg-secondary hover:border-accent hover:text-accent">
              {assinaturaUrl ? 'Trocar imagem' : 'Enviar imagem'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={pending}
                onChange={(e) => {
                  const arquivo = e.target.files?.[0];
                  e.target.value = '';
                  if (arquivo) enviarAssinatura(arquivo);
                }}
              />
            </label>
            {assinaturaUrl && (
              <button
                onClick={removerAssinatura}
                disabled={pending}
                className="rounded-control border border-border-strong px-5 py-2.5 text-[13.5px] font-extrabold text-fg-tertiary hover:border-error hover:text-error disabled:opacity-60"
              >
                Remover
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-7 border-t border-divider pt-6">
        <div className="mb-1 text-[15px] font-extrabold">Endereço do remetente</div>
        <div className="mb-4 text-[12.5px] text-fg-tertiary">
          É o que sai como remetente na <strong>etiqueta de transporte</strong> gerada em Vendas. Sem nome,
          rua e CEP a etiqueta não pode ser impressa — encomenda sem remetente não tem para onde voltar.
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {CAMPOS_REMETENTE.map((c) => (
            <div key={c.chave} className={c.largo ? 'sm:col-span-2' : undefined}>
              <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
                {c.rotulo}
              </div>
              <input
                value={remetente[c.chave]}
                onChange={(e) => setRemetente((r) => ({ ...r, [c.chave]: e.target.value }))}
                placeholder={c.dica}
                className={`w-full ${inputClass}`}
              />
            </div>
          ))}
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
