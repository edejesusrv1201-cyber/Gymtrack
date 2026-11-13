/* ============================================================
   sw.js — Service worker: cachea la app para que funcione offline
   una vez instalada en el celular.
   ============================================================ */

const CACHE_NAME = 'migymtrack-v40';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/lib/xlsx.min.js',
  './js/db.js',
  './js/utils.js',
  './js/theme.js',
  './js/units.js',
  './js/metrics.js',
  './js/celebrate.js',
  './js/progression.js',
  './js/gamify.js',
  './js/backup.js',
  './js/autoBackup.js',
  './js/weekly.js',
  './js/muscles.js',
  './js/plates.js',
  './js/config.js',
  './js/warmup.js',
  './js/prcalc.js',
  './js/share.js',
  './js/records.js',
  './js/photos.js',
  './js/programs.js',
  './js/timer.js',
  './js/modal.js',
  './js/exercises.js',
  './js/nutrition.js',
  './js/foodDb.js',
  './js/labelScan.js',
  './js/barcode.js',
  './js/excelBackup.js',
  './js/app.js',
  './js/views/today.js',
  './js/views/plan.js',
  './js/views/workout.js',
  './js/views/calories.js',
  './js/views/mealplan.js',
  './js/leaderboard.js',
  './js/views/measurements.js',
  './js/views/stats.js',
  './js/views/rewards.js',
  './js/views/progress.js',
  './js/views/more.js',
  './js/views/calculator.js',
  './icons/icon-192.png',
  './icons/logo-192.png',
  './icons/apple-touch-icon.png',
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
  // consultas a otros sitios (p. ej. el buscador de códigos de barras) no pasan por el caché de la app
  if (new URL(event.request.url).origin !== self.location.origin) return;
  // archivos del lector de etiquetas (OCR): son pesados, se guardan la primera vez y se leen del caché
  if (event.request.url.indexOf('/js/lib/ocr/') !== -1) {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || fetch(event.request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return resp;
      }))
    );
    return;
  }
  // Red primero: así las actualizaciones se ven de inmediato al abrir con internet.
  // Si no hay red, cae al caché (para que siga funcionando offline).
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
