const CACHE_NAME = 'khubara-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  
  // نمنع سيرفس وركر من كاش الصفحة الرئيسية أو أي صفحة HTML
  // هذا يضمن أن المتصفح يطلب index.html دائماً من السيرفر مباشرة ليحصل على آخر تحديث
  if (
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    event.request.mode === 'navigate' ||
    event.request.headers.get('accept').includes('text/html')
  ) {
    return; // دع المتصفح يذهب للشبكة مباشرة دون تدخل السيرفس وركر
  }
  
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache the updated resource if it's successful
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache if network fails
        return caches.match(event.request);
      })
  );
});
