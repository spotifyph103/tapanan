// Tapanan service worker — caches the app shell so the installed app loads fast
// and still opens offline. Video streams and TMDB data always come from network.
//
// Strategy: network-first for all same-origin files, falling back to cache.
// (An earlier version cached JS/CSS cache-first forever, so site updates never
// reached returning visitors. Never do that again.)
const CACHE = 'tapanan-v2';
const CORE = [
  './index.html',
  './css/home.css',
  './js/home.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html'))
      )
  );
});
