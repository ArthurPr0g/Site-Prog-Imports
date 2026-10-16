'use client';

import { useEffect } from 'react';

/** Registra o service worker do app "Prog Admin" (public/prog-admin-sw.js).
 *  É ele que deixa o Android oferecer "Instalar app" e mostra a tela de "sem
 *  internet" no lugar do erro do navegador. Escopo /admin: a loja pública não
 *  ganha service worker nenhum. */
export function RegistrarAppAdmin() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/prog-admin-sw.js', { scope: '/admin' }).catch(() => {
      // Sem service worker o admin funciona igual, só não fica instalável no Android
    });
  }, []);
  return null;
}
