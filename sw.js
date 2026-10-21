/* Tawasol hub service worker · app shell only. Never caches /api/ or media (paid files are never stored by the browser). */
const V = 'tw-shell-v3', SHELL = ['./', 'index.html', 'checkout.html', 'return.html', 'library.html', 'read.html', 'listen.html', 'legal.html', 'help.html', 'site.css', 'tokens.css', 'hub.css', 'hub.js', 'i18n.js', 'config.js', 'img/wordmark.png', 'img/cover-en.png', 'img/cover-ar.png', 'img/icon-192.png', 'img/icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/api/')) return;
  if (e.request.mode === 'navigate' || e.request.destination === 'document') { e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(V).then((k) => k.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))); return; }
  e.respondWith(caches.match(e.request).then((hit) => { const net = fetch(e.request).then((r) => { if (r.ok) caches.open(V).then((k) => k.put(e.request, r.clone())); return r; }).catch(() => hit); return hit || net; }));
});
