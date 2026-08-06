import Link from 'next/link';
import { formatBRL, formatDateBR } from '@/lib/format';
import { resumirParcelas, statusExibido, type Installment } from '@/lib/installments';
import { calcularAdimplencia, corDaAdimplencia, type Adimplencia } from '@/lib/customer-history';
import { WHATSAPP_NUMBER } from '@/lib/constants';
import { buildWhatsAppLink } from '@/lib/whatsapp';

type MinhaParcela = Installment & { origem: string };

/** O mesmo estado que o gerenciamento calcula, dito para quem deve.
 *
 *  "Inadimplente" é palavra de cobrança interna; na conta do cliente ela não
 *  informa nada que "1 parcela vencida" já não diga, e soa como acusação para
 *  quem talvez nem saiba que venceu. O estado é o mesmo — muda só o texto. */
const ROTULO: Record<Adimplencia, string> = {
  Adimplente: 'Carnê quitado',
  'Possui parcelas pendentes': 'Em dia',
  Inadimplente: 'Parcela vencida',
};

/** Quantas parcelas em aberto listar abaixo do farol. O resto o cliente vê no
 *  pedido — aqui a pergunta é "o que vence agora", não "qual é o carnê todo". */
const QUANTAS_LISTAR = 4;

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const VERMELHO = '#e05555';
const VERDE = '#4ade80';

/** Farol do carnê na área da conta: em que pé está o parcelamento do cliente.
 *
 *  Só aparece para quem tem carnê — quem comprou à vista não precisa saber que
 *  existe parcelamento. */
export function CarneResumo({ parcelas }: { parcelas: MinhaParcela[] }) {
  if (parcelas.length === 0) return null;

  const hoje = hojeISO();
  const resumo = resumirParcelas(parcelas, hoje);
  const situacao = calcularAdimplencia(parcelas, hoje);
  const cor = corDaAdimplencia(situacao);

  const emAberto = parcelas
    .filter((p) => statusExibido(p, hoje) !== 'Recebida')
    .slice(0, QUANTAS_LISTAR);

  const link = buildWhatsAppLink(
    resumo.qtdAtrasadas > 0
      ? 'Olá! Quero acertar uma parcela do meu carnê.'
      : 'Olá! Tenho uma dúvida sobre as parcelas da minha compra.',
    WHATSAPP_NUMBER
  );

  return (
    <div className="mb-6 rounded-[20px] border bg-card p-6" style={{ borderColor: `${cor}55` }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: cor }} />
          <span className="text-[15px] font-extrabold">Suas parcelas</span>
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-extrabold"
            style={{ background: `${cor}1f`, color: cor }}
          >
            {ROTULO[situacao]}
          </span>
        </div>
        {resumo.qtdEmAberto > 0 && (
          <Link
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-border-strong px-4 py-2 text-[12.5px] font-extrabold text-fg-secondary transition-colors hover:border-accent hover:text-accent"
          >
            Falar sobre o carnê
          </Link>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Numero rotulo="Parcelas" valor={resumo.qtdTotal} nota="no total" />
        <Numero rotulo="Pagas" valor={resumo.qtdPagas} nota={formatBRL(resumo.recebido)} cor={VERDE} />
        <Numero rotulo="Em aberto" valor={resumo.qtdEmAberto} nota={formatBRL(resumo.aReceber)} />
        <Numero
          rotulo="Vencidas"
          valor={resumo.qtdAtrasadas}
          nota={resumo.qtdAtrasadas > 0 ? formatBRL(resumo.atrasado) : 'nenhuma'}
          cor={resumo.qtdAtrasadas > 0 ? VERMELHO : undefined}
        />
      </div>

      {emAberto.length > 0 ? (
        <div className="rounded-[14px] border border-border bg-card-dark p-4">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-faded">
            {resumo.proximoVencimento
              ? `Próximo vencimento em ${formatDateBR(resumo.proximoVencimento + 'T12:00:00')}`
              : 'Parcelas em aberto'}
          </div>
          {emAberto.map((p) => {
            const s = statusExibido(p, hoje);
            const vencida = s === 'Atrasada';
            return (
              <div
                key={p.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-divider py-2 text-[13px] last:border-b-0"
              >
                <span className="font-bold">
                  {p.number === 0 ? 'Entrada' : `Parcela ${p.number}`}
                  <span className="ml-2 text-[11.5px] font-normal text-fg-faded">{p.origem}</span>
                </span>
                <span className="flex items-baseline gap-3">
                  <span className="text-fg-tertiary">{formatDateBR(p.dueDate + 'T12:00:00')}</span>
                  <span className="font-bold">{formatBRL(p.amount)}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold"
                    style={
                      vencida
                        ? { background: `${VERMELHO}1f`, color: VERMELHO }
                        : { background: '#ffffff10', color: '#a8a8b0' }
                    }
                  >
                    {vencida ? 'Vencida' : 'A vencer'}
                  </span>
                </span>
              </div>
            );
          })}
          {resumo.qtdEmAberto > emAberto.length && (
            <div className="pt-2 text-[11.5px] text-fg-faded">
              e mais {resumo.qtdEmAberto - emAberto.length} parcela(s) em aberto.
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-[14px] border border-border bg-card-dark px-4 py-3 text-[13px] text-fg-secondary">
          Tudo pago. Não há parcelas em aberto no seu nome.
        </div>
      )}
    </div>
  );
}

function Numero({
  rotulo,
  valor,
  nota,
  cor,
}: {
  rotulo: string;
  valor: number;
  nota: string;
  cor?: string;
}) {
  return (
    <div className="rounded-[14px] border border-border bg-card-dark px-4 py-3">
      <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[.08em] text-fg-tertiary">
        {rotulo}
      </div>
      <div className="font-display text-[22px] font-bold" style={cor ? { color: cor } : undefined}>
        {valor}
      </div>
      <div className="text-[11.5px] text-fg-faded">{nota}</div>
    </div>
  );
}
