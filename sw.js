/**
 * sw.js — Personal Finance System v2.0 (Static PWA)
 * Service Worker: menyimpan aset statis agar aplikasi terbuka cepat.
 * Strategi network-first untuk aset sendiri. Permintaan ke Google Apps Script
 * dan CDN (Tailwind, Alpine, Chart.js) tidak di-cache, sehingga data selalu segar.
 *
 * Saat mengubah file frontend, naikkan PF_CACHE_ (misal pf2-shell-v2)
 * agar perangkat mengambil versi terbaru.
 */

const PF_CACHE_ = 'pf2-shell-v1';
const PF_SHELL_ = [
  './',
  './index.html',
  './01_style.css',
  './02_config.js',
  './03_api.js',
  './04_charts.js',
  './05_app.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(PF_CACHE_)
      .then(function (cache) { return cache.addAll(PF_SHELL_); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== PF_CACHE_; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then(function (res) {
        if (res && res.ok) {
          const salinan = res.clone();
          caches.open(PF_CACHE_).then(function (cache) { cache.put(req, salinan); });
        }
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('./index.html');
        });
      })
  );
});
