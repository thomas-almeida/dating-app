// Trocar a versão apaga o cache antigo no próximo activate.
const CACHE = "static-v1";
const OFFLINE_URL = "/offline";

async function precacheOffline() {
  const cache = await caches.open(CACHE);
  const response = await fetch(OFFLINE_URL, { cache: "reload" });
  const html = await response.clone().text();
  await cache.put(OFFLINE_URL, response);

  // A tela offline precisa do CSS e dos scripts dela, que têm nome com hash.
  const assets = new Set(html.match(/\/_next\/static\/[^"'\s\\]+/g) ?? []);
  await Promise.allSettled([...assets].map((asset) => cache.add(asset)));
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheOffline().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// O HTML nunca entra no cache: as páginas têm dados de quem está logado.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
});
