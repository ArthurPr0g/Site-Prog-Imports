'use client';

// Mapa dos leads (Leaflet + OpenStreetMap, sem chave): cor pela nota, borda
// laranja nos quentes. Serve para montar rota de visitas por bairro.

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type { Map as MapaLeaflet, LayerGroup } from 'leaflet';
import { ehQuente, mapsDoLead, whatsappDoLead, type Lead } from '@/lib/captacao';
import { formatMoeda, type Estimativa } from '@/lib/precos-captacao';

const cor = (n: number) => (n >= 70 ? '#c9a15a' : n >= 50 ? '#8a7350' : '#55555c');

const escapar = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function Mapa({ leads, estimativa, agora }: { leads: Lead[]; estimativa: (l: Lead) => Estimativa; agora: number }) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaLeaflet | null>(null);
  const camada = useRef<LayerGroup | null>(null);
  const comCoordenadas = leads.filter((l) => l.latitude !== null && l.longitude !== null);

  // Leaflet mexe no DOM e no window: só no navegador, carregado sob demanda.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelado || !caixa.current) return;
      if (!mapa.current) {
        mapa.current = L.map(caixa.current, { zoomControl: true }).setView([-16.68, -49.25], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap',
        }).addTo(mapa.current);
        camada.current = L.layerGroup().addTo(mapa.current);
      }
      camada.current!.clearLayers();
      const pontos: [number, number][] = [];
      for (const l of comCoordenadas) {
        const p: [number, number] = [l.latitude!, l.longitude!];
        pontos.push(p);
        const e = estimativa(l);
        const wa = l.semWhatsapp ? null : whatsappDoLead(l.phone, l.country);
        const valor =
          e.unico > 0
            ? `<div>${formatMoeda(e.unico, e.moeda)}${e.mensal ? ` + ${formatMoeda(e.mensal, e.moeda)}/mês` : ''}</div>`
            : '';
        const links = [
          wa ? `<a href="https://wa.me/${wa.numero}" target="_blank" rel="noopener">WhatsApp</a>` : '',
          `<a href="${escapar(mapsDoLead(l))}" target="_blank" rel="noopener">Rota no Maps</a>`,
        ]
          .filter(Boolean)
          .join(' · ');
        L.circleMarker(p, {
          radius: 7,
          color: ehQuente(l, agora) ? '#ff6b3d' : '#111',
          weight: ehQuente(l, agora) ? 3 : 1,
          fillColor: cor(l.score),
          fillOpacity: 0.9,
        })
          .bindPopup(
            `<div style="font:13px/1.4 system-ui;min-width:180px"><b>${escapar(l.name)}</b> · nota ${l.score}` +
              `<div style="color:#666">${escapar([l.niche, l.address].filter(Boolean).join(' · '))}</div>${valor}<div style="margin-top:4px">${links}</div></div>`
          )
          .addTo(camada.current!);
      }
      if (pontos.length) mapa.current.fitBounds(pontos, { padding: [30, 30], maxZoom: 15 });
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads]);

  useEffect(
    () => () => {
      mapa.current?.remove();
      mapa.current = null;
    },
    []
  );

  return (
    <div>
      <div ref={caixa} className="h-[60vh] min-h-[380px] w-full overflow-hidden rounded-[18px] border border-border" />
      <div className="mt-2 text-[12px] text-fg-tertiary">
        {comCoordenadas.length} de {leads.length} lead(s) com localização · dourado = nota 70+, borda laranja = abriu o
        diagnóstico nas últimas 48 h. Use os filtros (ramo, cidade) para montar a rota do dia.
      </div>
    </div>
  );
}
