const CACHE_NAME = 'supportv8-pwa-v2';
const STATIC_ASSETS = [
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

  // Tenant pages must be verified by the server on every navigation, never
  // replayed from an old cache (including a formerly registered workspace).
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request, {cache: 'no-store'}).catch(() => new Response(
      '<!doctype html><html lang="en"><title>Workspace unavailable</title><body><h1>Workspace verification unavailable</h1><p>Reconnect to verify your workspace.</p></body></html>',
      {status: 503, statusText: 'Service Unavailable', headers: {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}}
    )));
    return;
  }
  // Only known same-origin static assets may be cached. No auth, RSC, HTML,
  // CAPTCHA, API or query responses are eligible.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.search || !STATIC_ASSETS.includes(url.pathname)) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)));
    }
    return response;
  })));
});
