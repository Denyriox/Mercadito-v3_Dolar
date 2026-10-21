/*
 * Service Worker de Mercadito.
 *
 * Estrategias:
 *  - Navegación (HTML): network-first con timeout, fallback a cache/offline.
 *  - Datos JSON: network-first con timeout, fallback a cache.
 *  - Resto de assets: cache-first + revalidación en segundo plano.
 *
 * IMPORTANTE: al desplegar cambios, subir CACHE_VERSION para invalidar
 * los caches anteriores.
 */

const CACHE_PREFIX = 'mercadito-cache-';
const CACHE_VERSION = 'v3';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

const OFFLINE_URL = './index.html';
const NAVIGATION_TIMEOUT = 4000;
const DATA_TIMEOUT = 3500;

// Rutas relativas: funcionan tanto en la raíz del dominio como en un
// subdirectorio (por ejemplo GitHub Pages /Mercadito-v3_Dolar/).
const PRECACHE_URLS = [
  './',
  './index.html',
  './tailwind.css',
  './style.css',
  './script.js',
  './tabs.js',
  './voiceSearch.js',
  './pagoMovil.js',
  './manifest.webmanifest',
  './productos.json',
  './dolar.json',
  './pago-movil.json',
  './colores-pestañas.json',
  './icon-192.png',
  './icon-512.png',
  // Bootstrap Icons (local)
  './assets/bootstrap-icons/font/bootstrap-icons.min.css',
  './assets/bootstrap-icons/font/fonts/bootstrap-icons.woff2',
  './assets/bootstrap-icons/font/fonts/bootstrap-icons.woff',
  // Datos de Pago Móvil (necesarios sin conexión)
  './qr/adela-qr.png',
  './qr/kamil-qr.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // cache.addAll() es todo-o-nada: un solo 404 tumba la instalación.
      // Precargamos cada recurso por separado y solo avisamos de los fallos.
      const results = await Promise.allSettled(
        PRECACHE_URLS.map(async (url) => {
          const response = await fetch(new Request(url, { cache: 'reload' }));
          if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}`);
          }
          await cache.put(url, response);
        })
      );

      const failed = results
        .map((result, i) => (result.status === 'rejected' ? PRECACHE_URLS[i] : null))
        .filter(Boolean);

      if (failed.length) {
        console.warn('[SW] No se pudieron precachear:', failed);
      }

      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

// Permite que la página pida activar la nueva versión inmediatamente.
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Solo GET y solo mismo origen (no se cachean respuestas opacas/CDN).
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  const accept = request.headers.get('accept') || '';
  const isNavigation = request.mode === 'navigate' || accept.includes('text/html');
  const isData = url.pathname.endsWith('.json');

  if (isNavigation || isData) {
    event.respondWith(
      networkFirst(request, isNavigation ? NAVIGATION_TIMEOUT : DATA_TIMEOUT, isNavigation)
    );
    return;
  }

  event.respondWith(cacheFirst(request));
});

/**
 * Intenta la red con timeout; si falla o tarda demasiado, usa el cache.
 */
async function networkFirst(request, timeout, isNavigation) {
  try {
    const response = await fetchWithTimeout(request, timeout);

    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => {
        /* cuota/errores de cache: no rompen la respuesta */
      });
      return response;
    }

    throw new Error(`Respuesta no válida: ${response && response.status}`);
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: isNavigation });
    if (cached) return cached;

    if (isNavigation) {
      const offline =
        (await caches.match(OFFLINE_URL)) || (await caches.match('./'));
      if (offline) return offline;
    }

    return new Response('No disponible sin conexión', {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

/**
 * Devuelve el cache al instante y actualiza en segundo plano.
 */
async function cacheFirst(request) {
  // ignoreSearch: Bootstrap Icons pide las fuentes con un hash en la URL
  // (bootstrap-icons.woff2?abc123), pero se precachean sin query.
  const cached = await caches.match(request, { ignoreSearch: true });

  if (cached) {
    revalidate(request);
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => {
        /* noop */
      });
    }
    return response;
  } catch (error) {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

function revalidate(request) {
  fetch(request)
    .then(async (response) => {
      if (!response || response.status !== 200) return;
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    })
    .catch(() => {
      /* sin red: se mantiene la versión cacheada */
    });
}

function fetchWithTimeout(request, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  return fetch(request, { signal: controller.signal }).finally(() => {
    clearTimeout(timer);
  });
}
