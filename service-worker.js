const CACHE_VERSION = 'v1';
const CACHE_NAME = `mercadito-cache-${CACHE_VERSION}`;
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/productos.json',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png.png'
];

self.addEventListener('install', (event) => {
  // Precache essential assets
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => {
        // Take control of uncontrolled clients as soon as this SW is installed
        return self.skipWaiting();
      })
  );
});

// Cleanup old caches on activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Allow the page to tell the SW to skipWaiting (for immediate update)
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch handler: network-first for navigation, cache-first for other assets with stale-while-revalidate
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== 'GET') return;

  // For navigation requests prefer network first so updates are reflected
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req).then((networkRes) => {
        // update cache in background
        const copy = networkRes.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        return networkRes;
      }).catch(() => caches.match(req).then(r => r))
    );
    return;
  }

  // For other assets, try cache first, then network and update cache
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req).then((networkRes) => {
        // only cache successful responses
        if (networkRes && networkRes.status === 200 && networkRes.type !== 'opaque') {
          const copy = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return networkRes;
      }).catch(() => null);

      // Return cached if available, otherwise network (or fallback to cached network result)
      return cached || networkFetch;
    })
  );
});
