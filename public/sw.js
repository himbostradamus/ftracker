/* Offline cache for the app's own files. Filled in at build time. */
const VERSION = '__VERSION__';
const FILES = __PRECACHE__;
const CACHE = `app-${VERSION}`;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(['./', ...FILES.filter(f => f !== 'index.html')])).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('app-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Pages: prefer the network so updates arrive, fall back to the cache offline.
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./', copy));
        return res;
      }).catch(() => caches.match('./', { cacheName: CACHE })),
    );
    return;
  }
  // Built files have hashed names, so the cached copy is always correct.
  event.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => (list[0] ? list[0].focus() : self.clients.openWindow('./'))));
});
