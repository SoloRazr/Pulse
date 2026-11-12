/* Pulse service worker: makes the app installable and lets the app shell open offline.
   Rules it follows:
   - It only ever handles GET requests to THIS site (the page, config.js, icons).
   - Your Apps Script API (a different origin, and POST) and Google Fonts are never touched.
   - Network first, cache as a fallback: after you publish an update, people get it on the next load. */
const CACHE = 'pulse-shell-v1';
const SHELL = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // one by one, so a missing optional file (e.g. config.js) cannot break the whole install
    await Promise.all(SHELL.map((u) => cache.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                                   // API calls are POSTs: leave them alone
  if (new URL(req.url).origin !== self.location.origin) return;       // Apps Script, Google Fonts...: leave them alone
  event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());                   // keep the freshest copy for offline use
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {                                    // offline + any page address -> the app shell
      const shell = (await cache.match('index.html')) || (await cache.match('./'));
      if (shell) return shell;
    }
    throw err;
  }
}
