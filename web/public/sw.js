// Oydin service worker (без зависимостей). Статика и оболочка — stale-while-revalidate, /api/* никогда не кэшируется.
// Смена VERSION удаляет старые кэши при активации.
const VERSION = "v2";
const STATIC_CACHE = `oydin-static-${VERSION}`;
const PAGES_CACHE = `oydin-pages-${VERSION}`;
const QUICK = "/app/quick";
const PRECACHE = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"];
const STATIC = /^\/(_next\/static|icons|brand|logos)\/|\.(?:css|js|woff2?|png|jpe?g|svg|webp|ico)$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined)));
      // Экран быстрой записи — заранее, чтобы открывался без сети (если не требует входа, редирект не кэшируем).
      try {
        const res = await fetch(QUICK, { credentials: "include" });
        if (res.ok && !res.redirected) await (await caches.open(PAGES_CACHE)).put(QUICK, res);
      } catch {}
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, PAGES_CACHE]);
      for (const key of await caches.keys()) if (key.startsWith("oydin-") && !keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

async function staleWhileRevalidate(req) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(req);
  const fresh = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => undefined);
  return hit || (await fresh) || Response.error();
}

async function navigate(req, url) {
  const isQuick = url.pathname === QUICK || url.pathname === QUICK + "/";
  try {
    const res = await fetch(req);
    if (isQuick && res.ok && !res.redirected) (await caches.open(PAGES_CACHE)).put(QUICK, res.clone());
    return res;
  } catch {
    if (isQuick) {
      const hit = await caches.match(QUICK, { cacheName: PAGES_CACHE });
      if (hit) return hit;
    }
    return (await caches.match("/offline.html")) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") return event.respondWith(navigate(req, url));
  if (STATIC.test(url.pathname)) event.respondWith(staleWhileRevalidate(req));
});
