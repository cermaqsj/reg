const CACHE_NAME = 'planta-v8.0-offline-first'; 
const ASSETS = [
    './',
    './index.html',
    './monitor.html',
    './style.css',
    './app.js',
    './theme-pwa.js',
    './Cermaq_logo2.png',
    './Q.png',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[SW] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    // Cache First for Assets, Network First for API (not applicable here as API is POST/GET data)
    // But for the App Shell, we want speed.
    if (e.request.method !== 'GET') return;
    
    e.respondWith(
        caches.match(e.request).then((response) => {
            return response || fetch(e.request).catch(() => {
                // Return offline fallback if needed, but for now just fail gracefully
            });
        })
    );
});
