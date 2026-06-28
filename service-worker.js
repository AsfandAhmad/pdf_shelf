/**
 * PDF Shelf — Service Worker
 * Cache-first strategy for app shell, network-first for CDN resources.
 */

const CACHE_NAME = 'pdfshelf-v2';
const OFFLINE_PAGE = './index.html';

// App shell files to pre-cache
const PRECACHE_ASSETS = [
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
  './apple-touch-icon.png'
];

// CDN assets to cache on first use
const CDN_CACHE = 'pdfshelf-cdn-v2';
const CDN_ORIGINS = [
  'https://cdnjs.cloudflare.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com'
];

// ── Install ───────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Pre-cache failed:', err))
  );
});

// ── Activate ──────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== CDN_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and non-http(s)
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // CDN resources: cache-first
  if (CDN_ORIGINS.some(origin => request.url.startsWith(origin))) {
    event.respondWith(cdnCacheFirst(request));
    return;
  }

  // App shell: cache-first with network fallback
  if (url.origin === self.location.origin) {
    event.respondWith(appCacheFirst(request));
    return;
  }
});

async function appCacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline fallback
    const fallback = await caches.match(OFFLINE_PAGE);
    return fallback || new Response('Offline', { status: 503 });
  }
}

async function cdnCacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CDN_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Resource unavailable offline', { status: 503 });
  }
}
