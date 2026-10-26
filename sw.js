/* Brainmate service worker
   - Pages (HTML): network first (waits at most 2.5 s), then the saved copy; the cache also covers offline
   - Other same-origin files (icons, manifest): serve from cache, refresh in background
   - Firebase / Google requests are never touched
   Change V when you want to force-clear every old cache. */
const V = 'bm-v3';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(V)
      .then(c => Promise.all(['./', 'index.html'].map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  const isPage = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if (isPage) {
    e.respondWith((async () => {
      const hit = (await caches.match(req)) || (await caches.match('index.html'));
      const net = fetch(req, { cache: 'no-cache' }).then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(V).then(c => c.put(req, copy)); }
        return res;
      });
      e.waitUntil(net.catch(() => {}));
      if (!hit) return net;
      // Fresh page if the network answers within 2.5 s, otherwise show the saved copy right away
      const res = await Promise.race([net.catch(() => null), new Promise(r => setTimeout(() => r(null), 2500))]);
      return res || hit;
    })());
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req)
        .then(res => {
          if (res && res.ok) { const copy = res.clone(); caches.open(V).then(c => c.put(req, copy)); }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
