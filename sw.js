const CACHE = "trip-list-v5";
const ASSETS = ["/", "/index.html", "/styles.css", "/app.js", "/manifest.webmanifest", "/icon.svg"];
const APP_SHELL = new Set(["document", "script", "style"]);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;

  const isAppShell = APP_SHELL.has(event.request.destination) || event.request.mode === "navigate";
  event.respondWith(isAppShell ? networkFirst(event.request) : cacheFirst(event.request));
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) await putInCache(request, response.clone());
    return response;
  } catch {
    return (await caches.match(request)) || caches.match("/");
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await putInCache(request, response.clone());
  return response;
}

async function putInCache(request, response) {
  const cache = await caches.open(CACHE);
  await cache.put(request, response);
}
