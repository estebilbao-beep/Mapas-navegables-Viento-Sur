// Service worker: guarda la app en el teléfono para que abra sin internet.
const C = 'mapacampo-v2';
const FILES = ['./', './index.html', './pdf.js', './pdf.worker.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(x => x !== C && x !== 'shared').map(x => caches.delete(x))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  // Recibir un PDF compartido desde otra app (Android)
  if (e.request.method === 'POST' && u.pathname.endsWith('/share')) {
    e.respondWith((async () => {
      try {
        const fd = await e.request.formData();
        const f = fd.getAll('pdf').find(x => x && x.size);
        if (f) {
          const c = await caches.open('shared');
          await c.put('__shared.pdf', new Response(f, { headers: { 'X-Name': encodeURIComponent(f.name || 'mapa.pdf') } }));
        }
      } catch (err) {}
      return Response.redirect('./?shared=1', 303);
    })());
    return;
  }
  if (e.request.method !== 'GET') return;
  const isPage = e.request.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('index.html');
  if (isPage) {
    // con internet trae la versión nueva; sin señal (o si tarda más de 3 s) usa la guardada
    e.respondWith((async () => {
      const c = await caches.open(C);
      const net = fetch(e.request).then(r => { if (r.ok) c.put('./index.html', r.clone()); return r; });
      const t = new Promise(res => setTimeout(res, 3000));
      try { const r = await Promise.race([net, t]); if (r) return r; } catch (err) {}
      return (await c.match('./index.html')) || net;
    })());
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
});
