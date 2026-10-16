// Service worker do app "Prog Admin" (escopo /admin).
//
// Só faz duas coisas: deixa o admin instalável como app e mostra uma tela
// amigável quando o celular está sem internet. NÃO guarda páginas nem dados em
// cache — o admin mostra dinheiro, estoque e clientes, e uma tela velha vinda
// do cache seria pior que tela nenhuma. Toda página continua vindo da rede.

const CACHE = 'prog-admin-v1';
const OFFLINE = '/admin-app/offline.html';

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, '/admin-app/icon-192.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n.startsWith('prog-admin-') && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  // Só a navegação (abrir uma tela) ganha a página de "sem internet"; o resto
  // segue direto para a rede, como num site comum.
  if (evento.request.mode !== 'navigate') return;
  evento.respondWith(fetch(evento.request).catch(() => caches.match(OFFLINE)));
});
