// Offline cache for Sub Board. Bump VERSION whenever you change any file so phones pick up the update.
const VERSION = 'sub-board-v7';
const FILES = [
  './', './index.html', './styles.css', './app.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first (3 s limit) so updates show up right away when there is signal; falls back to the saved copy at the field.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const res = await Promise.race([
        fetch(e.request),
        new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 3000))
      ]);
      if (res && res.ok) cache.put(e.request, res.clone());
      return res;
    } catch (err) {
      return (await cache.match(e.request, { ignoreSearch: true })) || Response.error();
    }
  })());
});
