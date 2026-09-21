// Minimal Service Worker to satisfy PWA installation criteria
const CACHE_NAME = 'pek-cache-v5';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/logo.png',
  '/logo-splash.gif',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.png'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event (Network first, fallback to cache for offline basic support)
self.addEventListener('fetch', (event) => {
  // Only handle GET requests and local assets to avoid CORS issues
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.pathname.startsWith('/api/') || requestUrl.pathname.startsWith('/admin/') || requestUrl.pathname.startsWith('/payment/')) {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful requests dynamically
        if (response && response.status === 200 && response.type === 'basic' && !/no-store|private/i.test(response.headers.get('Cache-Control') || '')) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache if network is down
        return caches.match(event.request);
      })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const requestedUrl = new URL(event.notification.data?.url || '/notifications', self.location.origin);
  const targetUrl = requestedUrl.origin === self.location.origin
    ? requestedUrl.href
    : new URL('/notifications', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      for (const client of clientList) {
        if ('navigate' in client) {
          await client.navigate(targetUrl);
        }
        if ('focus' in client) {
          return client.focus();
        }
      }

      return clients.openWindow(targetUrl);
    })
  );
});
