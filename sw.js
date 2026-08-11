/* Sundar Gutka offline service worker
 * - App shell (HTML/CSS/JS): network-first, fall back to cache
 * - Heavy assets (PDF, PDF.js, text index, icons): cache-first
 */
const CACHE = "sundar-gutka-v5";

const PRECACHE = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./lib/pdf.min.mjs",
  "./lib/pdf.worker.min.mjs",
  "./assets/sundar-gutka.pdf",
  "./data/text-index.json",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  // standard_fonts fetched on demand; covered by /lib/ cache-first
];

const SHELL_RE = /\/(index\.html)?$|\/css\/|\/js\/|manifest\.webmanifest$/;
const HEAVY_RE = /\/(assets|lib|data|icons)\//;

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(async (cache) => {
        // Precache individually so one failure does not abort install
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
      .then(() => self.skipWaiting())
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
      return cache.match("./index.html");
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
  if (url.origin !== self.location.origin) {
    // Allow font CDN to be cached opportunistically
    if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
      event.respondWith(cacheFirst(event.request));
    }
    return;
  }

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
