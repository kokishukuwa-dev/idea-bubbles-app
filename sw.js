const CACHE_NAME = "idea-bubbles-v4";
const CORE_FILES = [
  "./",
  "./index.html",
  "./app.js",
  "./tab-prefs.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 画面本体はキャッシュ優先(オフラインでも開ける)。それ以外はネット優先でフォールバックにキャッシュを使う。
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  // 同じgithub.io上の他アプリや外部のリクエストはキャッシュに入れず、このアプリの範囲だけ扱う
  if (!event.request.url.startsWith(self.registration.scope)) return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request)
        .then(res => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
