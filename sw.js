const CACHE_NAME = 'jadwalku-v3';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  // Cache file external agar bisa digunakan full offline
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

// File yang SELALU dicek ke server dulu (app-shell / HTML) supaya update langsung kebaca.
// Baru kalau offline/gagal, fallback ke cache.
const NETWORK_FIRST_PATHS = ['./', './index.html', '/index.html'];

function isNetworkFirst(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  return NETWORK_FIRST_PATHS.some(p => url.pathname.endsWith(p.replace('./', '')) || url.pathname === '/' );
}

// Install Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting(); // langsung aktifkan SW baru tanpa menunggu tab lama tertutup
});

// Activate & Hapus Cache Lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim(); // ambil alih kontrol tab yang sedang terbuka
});

// Intercept Network Requests
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Strategi NETWORK FIRST untuk HTML/app-shell -> selalu ambil versi terbaru dari server dulu
  if (isNetworkFirst(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((freshResponse) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, freshResponse.clone()));
          return freshResponse;
        })
        .catch(() => caches.match(event.request)) // offline -> fallback ke cache terakhir
    );
    return;
  }

  // Strategi CACHE FIRST untuk aset statis (font, library CDN, dll) -> hemat kuota & cepat
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((fetchResponse) => {
        if (event.request.url.startsWith('http')) {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, fetchResponse.clone()));
        }
        return fetchResponse;
      });
    }).catch(() => {
      // Jika offline dan tidak ada di cache, bisa berikan fallback disini jika mau
    })
  );
});
