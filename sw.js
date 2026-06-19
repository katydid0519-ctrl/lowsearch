// 국가법령 검색기 PWA Service Worker
const VERSION = 'v1.1.9';
const APP_CACHE = `law-app-${VERSION}`;
const RUNTIME_CACHE = `law-runtime-${VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-maskable.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== APP_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 같은 출처 + HTML 문서: 네트워크 우선, 실패 시 캐시
  if (req.mode === 'navigate' || (url.origin === location.origin && req.destination === 'document')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(APP_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match('./index.html')))
    );
    return;
  }

  // 같은 출처 정적 리소스: 캐시 우선
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(APP_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        });
      })
    );
    return;
  }

  // 외부 CDN(폰트/스크립트): stale-while-revalidate
  const isCdn = /cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host);
  if (isCdn) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          const fetchPromise = fetch(req)
            .then((res) => {
              if (res && res.status === 200) cache.put(req, res.clone()).catch(() => {});
              return res;
            })
            .catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // 그 외(API 등): 네트워크 그대로 통과
});
