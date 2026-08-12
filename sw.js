/* Sundar Gutka offline service worker
 * - App shell (HTML/CSS/JS): network-first, fall back to cache
 * - Heavy assets (PDF, PDF.js, icons): cache-first
 *
 * Intentionally does NOT force clients to reload. Aggressive skipWaiting +
 * page reload caused a blink/reload loop on some phones.
 */
const CACHE = "sundar-gutka-v8";

const PRECACHE = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./lib/pdf.min.mjs",
  "./lib/pdf.worker.min.mjs",
  "./assets/sundar-gutka.pdf",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

const SHELL_RE = /\/(index\.html)?$|\/css\/|\/js\/|manifest\.webmanifest$/;
const HEAVY_RE = /\/(assets|lib|icons)\//;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            await cache.add(url);
          } catch (err) {
            console.warn("SW precache failed", url, err);
          }
        })
      );
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      return (
        (await cache.match("./index.html")) ||
        (await cache.match("index.html")) ||
        new Response("Offline", { status: 503, statusText: "Offline" })
      );
    }
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept the service worker script itself
  if (url.pathname.endsWith("/sw.js")) return;

  const path = url.pathname;
  if (HEAVY_RE.test(path)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }
  if (event.request.mode === "navigate" || SHELL_RE.test(path)) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  event.respondWith(networkFirst(event.request));
});
