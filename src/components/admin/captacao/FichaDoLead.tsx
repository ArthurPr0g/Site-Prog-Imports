'use client';

// Ficha completa do lead no painel do dono: a mesma do vendedor (Análise,
// Contato e mensagens, Oportunidade, Como agir, Ligação, Checklist, Registro),
// com as mensagens no nome do Arthur e gravando pelas ações do painel.

import { PesquisaEBriefing } from './PesquisaEBriefing';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, MessageCircle, Video } from 'lucide-react';
import { abrirSalaDoLeadAction } from '@/app/actions/reunioes';
import { useToast } from '@/components/ui/Toast';
import type { Lead } from '@/lib/captacao';
import { situacaoDoSite } from '@/lib/captacao';
import type { ModeloMensagem } from '@/lib/mensagens-lead';
import type { TabelaPrecos } from '@/lib/precos-captacao';
import type { Kit, LeadDoKit } from '@/lib/vendedor';
import { valoresDoItem, type ServicoDoCatalogo } from '@/lib/itens-do-kit';
import { okResult } from '@/lib/action-result';
import {
  registrarEnvioAction,
  updateLeadAction,
  salvarChecklistAction,
  criarPropostaAction,
  passarParaLiaAction,
  confirmarPassagemParaLiaAction,
} from '@/app/actions/leads';
import { LeadDoVendedor, type AcoesDaFicha } from '@/components/vendedor/LeadDoVendedor';
import type { KitDoVendedor } from '@/lib/data/leads';
import { QuemAtende } from './QuemAtende';

/** Mesmo país, cidade e ramo, sem o próprio lead (igual à função lead_kit do banco). */
function regiaoDe(l: Lead, leads: Lead[]): LeadDoKit['regiao'] {
  const c = leads.filter((o) => o.id !== l.id && o.country === l.country && o.city === l.city && o.niche === l.niche);
  if (!c.length) return null;
  const notas = c.filter((o) => o.rating !== null).map((o) => o.rating!);
  const comSite = c.filter((o) => ['ok', 'vende_online', 'sem_celular', 'sem_https'].includes(situacaoDoSite(o.website, o.siteCheck)));
  return {
    total: c.length,
    com_site: comSite.length,
    nota_media: notas.length ? Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10 : null,
    avaliacoes_media: Math.round(c.reduce((s, o) => s + (o.reviewCount ?? 0), 0) / c.length),
  };
}

function comoLeadDoKit(l: Lead, leads: Lead[], porNome: Map<string, ServicoDoCatalogo>, tabBRL: TabelaPrecos): LeadDoKit {
  return {
    id: l.id,
    public_token: l.publicToken,
    name: l.name,
    category: l.category,
    niche: l.niche,
    city: l.city,
    state: l.state,
    country: l.country,
    address: l.address,
    phone: l.phone,
    sem_whatsapp: l.semWhatsapp,
    email: l.email,
    website: l.website,
    site_check: l.siteCheck,
    instagram: l.instagram,
    facebook: l.facebook,
    maps_url: l.mapsUrl,
    rating: l.rating,
    review_count: l.reviewCount,
    score: l.score,
    reasons: l.reasons,
    suggested_services: l.suggestedServices,
    status: l.status,
    notes: l.notes,
    first_contact_at: l.firstContactAt,
    followup_step: l.followupStep,
    ab_variant: l.abVariant,
    diag_views: l.diagViews,
    diag_last_view_at: l.diagLastViewAt,
    screenshot_url: l.screenshotUrl,
    discovery: l.discovery,
    discovery_at: l.discoveryAt,
    maps_status: l.mapsStatus,
    last_review_at: l.lastReviewAt,
    owner_claimed: l.ownerClaimed,
    opening_hours: l.openingHours,
    attributes: l.attributes,
    online_booking: l.onlineBooking,
    rating_dist: l.ratingDist,
    recent_reviews: l.recentReviews,
    porte: l.porte,
    unidades: l.unidades,
    regiao: regiaoDe(l, leads),
    ...valoresDoItem({ country: l.country, suggested_services: l.suggestedServices }, porNome, tabBRL),
  };
}

/**
 * "Chamar pelo meu WhatsApp e passar para a Lia": a 1ª mensagem sai do WhatsApp
 * do Arthur, à mão; o link do diagnóstico leva o cliente ao número da Lia.
 */
function PassarParaLia({ leadId }: { leadId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [aberto, setAberto] = useState(false);

  const chamar = () => {
    // Reserva a aba no clique (depois do await o navegador bloquearia o pop-up).
    const aba = window.open('about:blank', '_blank');
    start(async () => {
      const r = await passarParaLiaAction(leadId);
      if (!r.ok || !r.texto) {
        aba?.close();
        toast(r);
        return;
      }
      const url = r.whatsapp
        ? `https://wa.me/${r.whatsapp}?text=${encodeURIComponent(r.texto)}`
        : `https://wa.me/?text=${encodeURIComponent(r.texto)}`;
      if (aba) aba.location.href = url;
      else window.open(url, '_blank');
      if (!r.whatsapp) toast({ ok: true, message: 'Lead sem celular no cadastro: escolha o contato no WhatsApp.' });
      setAberto(true);
    });
  };

  const confirmar = () =>
    start(async () => {
      const r = await confirmarPassagemParaLiaAction(leadId);
      toast(r);
      if (r.ok) {
        setAberto(false);
        router.refresh();
      }
    });

  return (
    <span className="ml-2 mt-3 inline-flex flex-wrap items-center gap-2">
      <button
        disabled={pending}
        onClick={chamar}
        title="Abre o seu WhatsApp com a mensagem pronta; o botão do diagnóstico leva o cliente para a Lia"
        className="inline-flex items-center gap-1.5 rounded-control border border-accent/60 px-4 py-2.5 text-[13.5px] font-extrabold text-accent disabled:opacity-50"
      >
        <MessageCircle size={15} /> Chamar pelo meu WhatsApp → Lia
      </button>
      {aberto && (
        <span className="inline-flex items-center gap-1.5 rounded-control border border-accent/40 bg-accent/[.06] px-2.5 py-1.5 text-[12.5px]">
          A mensagem saiu?
          <button disabled={pending} onClick={confirmar} className="rounded-full bg-accent px-2.5 py-0.5 font-extrabold text-page">
            Enviei
          </button>
          <button onClick={() => setAberto(false)} className="px-1 font-bold text-fg-faded" aria-label="Fechar">
            ×
          </button>
        </span>
      )}
    </span>
  );
}

export function FichaDoLead({
  lead,
  leads,
  modelos,
  origem,
  servicos,
  tabBRL,
  vendedor,
  kits,
  onFechar,
}: {
  /** Links de vendedor (Felipe, IA…): o seletor "Quem atende". */
  kits: KitDoVendedor[];
  lead: Lead;
  /** Vendedor com link ativo que tem este lead na lista. */
  vendedor?: string;
  /** Base inteira: comparação com a região. */
  leads: Lead[];
  modelos: ModeloMensagem[];
  origem: string;
  servicos: ServicoDoCatalogo[];
  tabBRL: TabelaPrecos;
  onFechar: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [criando, startCriar] = useTransition();
  const [abrindoSala, startSala] = useTransition();
  const porNome = useMemo(() => new Map(servicos.map((s) => [s.name, s])), [servicos]);
  const ficha = useMemo(() => comoLeadDoKit(lead, leads, porNome, tabBRL), [lead, leads, porNome, tabBRL]);

  // "Kit" do próprio Arthur: as mensagens saem no nome dele, sem link de vendedor.
  const kit: Kit = useMemo(
    () => ({
      seller_name: 'Arthur Matos',
      seller_whatsapp: null,
      seller_email: null,
      instructions: null,
      created_at: lead.createdAt,
      more_requested_at: null,
      catalog: [],
      templates: modelos,
      leads: [ficha],
    }),
    [modelos, ficha, lead.createdAt]
  );

  const acoes: AcoesDaFicha = {
    async registrar({ status, nota, etapaEnviada }) {
      // Aviso de "saiu da lista do vendedor" (vem no fim da mensagem das actions).
      let passou = '';
      const guardar = (msg: string) => {
        const i = msg.indexOf(' Este lead ');
        if (i >= 0) passou = msg.slice(i);
      };
      if (etapaEnviada !== undefined) {
        const r = await registrarEnvioAction(lead.id, etapaEnviada, lead.abVariant ?? 'A');
        if (!r.ok) return r;
        guardar(r.message);
      }
      if (status) {
        const r = await updateLeadAction(lead.id, { status });
        if (!r.ok) return r;
        guardar(r.message);
      }
      if (nota?.trim()) {
        const data = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const notes = [lead.notes, `[Arthur ${data}] ${nota.trim()}`].filter(Boolean).join('\n');
        const r = await updateLeadAction(lead.id, { notes });
        if (!r.ok) return r;
      }
      router.refresh();
      return okResult((etapaEnviada !== undefined ? 'Envio registrado.' : 'Salvo.') + passou);
    },
    async salvarChecklist(respostas) {
      const r = await salvarChecklistAction(lead.id, respostas);
      if (r.ok) router.refresh();
      return r;
    },
  };

  return (
    <LeadDoVendedor
      lead={ficha}
      kit={kit}
      token=""
      origem={origem}
      whatsArthur=""
      onFechar={onFechar}
      acoes={acoes}
      dono
      aviso={
        <div className="space-y-2">
        <QuemAtende leadId={lead.id} kits={kits} />
        <PesquisaEBriefing leadId={lead.id} />
        {vendedor && (
          <div className="rounded-[10px] border border-accent/40 bg-accent/10 px-3 py-2 text-[12.5px] leading-snug">
            {lead.status === 'novo' ? (
              <>
                <b>Na lista de {vendedor}</b>, ainda sem contato. Se você registrar contato, mudar a etapa, preencher o
                checklist ou criar a proposta, ele sai da lista de {vendedor} e entra outro lead no lugar.
              </>
            ) : (
              <>
                <b>{vendedor} está atendendo este lead.</b> O que você registrar aqui aparece para ele também.
              </>
            )}
          </div>
        )}
        </div>
      }
      extraOportunidade={
        <>
        <PassarParaLia leadId={lead.id} />
        <button
          disabled={criando}
          onClick={() =>
            startCriar(async () => {
              const r = await criarPropostaAction(lead.id);
              toast(r);
              // A lista de Orçamentos Serviços abre com a proposta nova no topo.
              if (r.ok && r.quoteId) router.push('/admin/orcamentos-servicos');
            })
          }
          className="ml-2 mt-3 inline-flex items-center gap-1.5 rounded-control border border-accent/60 px-4 py-2.5 text-[13.5px] font-extrabold text-accent disabled:opacity-50"
        >
          <FileText size={15} /> {criando ? 'Criando…' : 'Criar proposta no ERP'}
        </button>
        {/* Sala de reunião (31/10/2026): reaproveita a reunião de hoje do lead ou cria uma agora. */}
        <button
          disabled={abrindoSala}
          onClick={() =>
            startSala(async () => {
              const r = await abrirSalaDoLeadAction(lead.id);
              if (!r.ok || !r.id) return void toast(r);
              router.push(`/admin/reunioes/${r.id}`);
            })
          }
          className="ml-2 mt-3 inline-flex items-center gap-1.5 rounded-control border border-accent/60 px-4 py-2.5 text-[13.5px] font-extrabold text-accent disabled:opacity-50"
        >
          <Video size={15} /> {abrindoSala ? 'Abrindo…' : 'Abrir sala de reunião'}
        </button>
        </>
      }
    />
  );
}
