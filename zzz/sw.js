/* zzz · service worker — cache primero, actualiza atras.
   Al actualizar la app: subir el index nuevo y CAMBIAR esta version. */
var CACHE = 'zzz-f0.8';

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(['./', './index.html', './manifest.webmanifest']); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      var fresh = fetch(e.request).then(function (net) {
        if (net && net.ok) {
          var copia = net.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copia); });
        }
        return net;
      }).catch(function () { return cached; });
      return cached || fresh;
    })
  );
});
