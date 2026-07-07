/* WSApp offline cache — wsapp root deploy at watthoursolutions.com/wsapp/ */
const WSAPP_CACHE = 'wsapp-v1.7.3-field-fixes';
const CACHE_URLS = [
  './',
  './launch.html',
  './index.html',
  'shared/scripts/wsapp-paths.js',
  'shared/scripts/wsapp-calculations.js',
  'shared/scripts/wsapp-visual-bridge.js',
  'shared/scripts/wsapp-utility-profiles.js',
  'shared/scripts/wsapp-test-report-snapshot-css.js',
  'companions/test-report/scripts/wsapp-test-report.js',
  'shared/assets/html2pdf.bundle.min.js',
  'shared/assets/tailwindcdn.js',
  'shared/assets/xlsx.full.min.js',
  'shared/assets/fontawesome/css/all.min.css',
  'shared/assets/fontawesome/webfonts/fa-solid-900.woff2',
  'shared/assets/logo.png',
  'shared/assets/leaflet/leaflet.css',
  'shared/assets/leaflet/leaflet.js',
  'shared/assets/leaflet/images/marker-icon.png',
  'shared/assets/leaflet/images/marker-icon-2x.png',
  'shared/assets/leaflet/images/marker-shadow.png',
  'companions/test-report/test-report.html',
  'companions/test-report/scripts/wsapp-test-report.js',
  'companions/test-report/scripts/wsapp-test-report-export.js',
  'companions/test-report/scripts/wsapp-test-report-import.js',
  'companions/charts/vector-diagram.html',
  'companions/charts/ct-accuracy-graph.html',
  'companions/charts/ct-drop-graph.html',
  'companions/charts/ct-parallelogram.html',
  'companions/charts/pt-accuracy-graph.html',
  'companions/charts/pt-drop-graph.html',
  'companions/charts/scripts/wsapp-chart-bundle.js',
  'companions/charts/scripts/wsapp-visual-shell.js',
  'companions/charts/scripts/visual-page-template.js',
  'companions/charts/scripts/wsapp-vector-diagram.js',
  'companions/charts/scripts/wsapp-ct-accuracy-graph.js',
  'companions/charts/scripts/wsapp-ct-drop-graph.js',
  'companions/charts/scripts/wsapp-ct-parallelogram.js',
  'companions/charts/scripts/wsapp-pt-accuracy-graph.js',
  'companions/charts/scripts/wsapp-pt-drop-graph.js',
  'companions/route-map/route-map.html',
  'companions/route-map/scripts/wsapp-route-map.js',
  './manifest.json'
];

function isNetworkFirst(url) {
  if (url.indexOf('tile.openstreetmap.org') !== -1) return true;
  if (/\.html(\?|#|$)/.test(url)) return true;
  if (url.indexOf('wsapp-paths.js') !== -1) return true;
  if (url.indexOf('wsapp-route-map.js') !== -1) return true;
  if (url.indexOf('launch.html') !== -1) return true;
  return false;
}

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(WSAPP_CACHE).then(function(cache) {
      return cache.addAll(CACHE_URLS).catch(function() {});
    }).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== WSAPP_CACHE; }).map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  var url = event.request.url;

  if (isNetworkFirst(url)) {
    event.respondWith(
      fetch(event.request).then(function(response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var clone = response.clone();
          caches.open(WSAPP_CACHE).then(function(cache) { cache.put(event.request, clone); });
        }
        return response;
      }).catch(function() {
        return caches.match(event.request).then(function(cached) {
          return cached || caches.match('./launch.html');
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        var clone = response.clone();
        caches.open(WSAPP_CACHE).then(function(cache) { cache.put(event.request, clone); });
        return response;
      });
    }).catch(function() { return caches.match('./launch.html'); })
  );
});
