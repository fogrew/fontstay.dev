const VERSION = '__VERSION__';
const BUILD = '__BUILD__';
const PRECACHE = __PRECACHE__;
const PREFIX = 'fontstay-';
const CACHE = `${PREFIX}${BUILD}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        PRECACHE.map((path) =>
          fetch(path, { cache: 'reload' }).then((response) => {
            if (!response.ok) throw new Error(`${path}: ${response.status}`);
            return cache.put(path, response);
          }),
        ),
      ),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(PREFIX) && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'VERSION' && event.source)
    event.source.postMessage({ version: VERSION, build: BUILD });
});

function lookup(url) {
  const path = url.pathname;
  const candidates = path.endsWith('/') ? [`${path}index.html`, path] : [path];
  return caches.open(CACHE).then(async (cache) => {
    for (const candidate of candidates) {
      const hit = await cache.match(candidate);
      if (hit) return hit;
    }
    return undefined;
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/sw.js' || url.pathname === '/version.json') return;
  event.respondWith(
    lookup(url).then(
      (hit) =>
        hit ||
        fetch(request).catch(async () => {
          if (request.mode === 'navigate') {
            const fallback = await lookup(new URL('/en/', self.location.origin));
            if (fallback) return fallback;
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        }),
    ),
  );
});
