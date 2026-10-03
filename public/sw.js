const CACHE_NAME = 'supportv8-pwa-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/family-theme.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Dynamic API and chat streaming requests always bypass cache
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          if (event.request.mode === 'navigate') {
            const rootCached = await caches.match('/');
            if (rootCached) {
              return rootCached;
            }
            return new Response(
              '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Offline</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="background:#090E15;color:#EAF1F8;font-family:system-ui,sans-serif;padding:2rem;text-align:center;"><h1>Offline</h1><p style="color:#8E9AA8;">Network unavailable. Please reconnect.</p></body></html>',
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
              }
            );
          }

          return new Response('Network unavailable', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        });
    })
  );
});
