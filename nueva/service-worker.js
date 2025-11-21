const CACHE_NAME = 'gestor-ofrecimientos-v9'; // Nueva versión para forzar la actualización
const URLS_TO_CACHE = [
  '/nueva/nueva.html',
  '/nueva/nueva.css',
  '/nueva/app.js',
  '/nueva/offerings.js',
  '/nueva/firebase-config.js',
  '/nueva/manifest.json',
  '/nueva/icon-192x192.jpeg'
];

// Instalar el Service Worker y guardar los archivos base en caché.
self.addEventListener('install', event => {
  // skipWaiting() fuerza al nuevo Service Worker a activarse inmediatamente.
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Service Worker: Cache abierto y guardando recursos base.');
      // Usar addAll con manejo de errores para archivos individuales
      return Promise.allSettled(
        URLS_TO_CACHE.map(url => cache.add(url))
      ).then(results => {
        const failed = results
          .map((r, i) => r.status === 'rejected' ? URLS_TO_CACHE[i] : null)
          .filter(Boolean);
        if (failed.length > 0) {
          console.warn('Service Worker: Algunos archivos no pudieron cachearse:', failed);
        }
      });
    }).catch(err => {
      console.error('Service Worker: Error abriendo caché:', err);
    })
  );
});

// Activar y limpiar cachés antiguos.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => {
          console.log('Service Worker: Limpiando caché antiguo:', name);
          return caches.delete(name);
        })
      );
    })
  );
});

// Interceptar peticiones.
self.addEventListener('fetch', event => {
  // Las peticiones a Firebase siempre van a la red.
  if (event.request.url.includes('firestore.googleapis.com')) {
    return;
  }

  // Estrategia: Network Falling Back to Cache
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});