/* ============================================================
   sw.js — Service worker: cachea la app para que funcione offline
   una vez instalada en el celular.
   ============================================================ */

const CACHE_NAME = 'migymtrack-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/db.js',
  './js/utils.js',
  './js/timer.js',
  './js/modal.js',
  './js/nutrition.js',
  './js/app.js',
  './js/views/today.js',
  './js/views/plan.js',
  './js/views/workout.js',
  './js/views/calories.js',
  './js/views/measurements.js',
  './js/views/more.js',
  './js/views/calculator.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Red primero: así las actualizaciones se ven de inmediato al abrir con internet.
  // Si no hay red, cae al caché (para que siga funcionando offline).
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(event.request))
  );
});
