 // Task Progress Tracker Service Worker
const CACHE_NAME = 'task-tracker-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/normalize.css',
  '/css/styles.css',
  '/js/app.js',
  '/js/storage.js',
  '/js/taskManager.js',
  '/js/ui.js',
  '/manifest.json'
];

// Install event - cache all static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache if available, fall back to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response from cache
        if (response) {
          return response;
        }
        
        // Clone the request for the fetch call
        const fetchRequest = event.request.clone();
        
        // Make network request and cache the response
        return fetch(fetchRequest).then(response => {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clone the response for cache and return
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
            
          return response;
        });
      })
      .catch(() => {
        // If both cache and network fail, show a generic fallback
        console.log('Fetch failed, displaying offline page');
        // This would be where you'd return a custom offline page if implemented
      })
  );
});
