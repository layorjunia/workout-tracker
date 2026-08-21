// Service worker — minimal offline shell so the app loads without a network
// (useful inside gyms with bad signal). Also flips iOS into "PWA" mode when
// added to the home screen, which protects localStorage from the 7-day purge.

const VERSION = "v21";
const CACHE = `workout-tracker-${VERSION}`;
const SHELL = [
  "./",
  "./index.html",
  `./styles.css?v=${VERSION.slice(1)}`,
  `./app.js?v=${VERSION.slice(1)}`,
  `./capacitor-health.js?v=${VERSION.slice(1)}`,
  `./vendor/chart.umd.js?v=${VERSION.slice(1)}`,
  `./vendor/firebase-sync.bundle.js?v=${VERSION.slice(1)}`,
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // Only handle same-origin requests; let external APIs (gist, chart.js cdn) pass through
  if (url.origin !== self.location.origin) return;

  const isHTML = url.pathname.endsWith("/") || url.pathname.endsWith(".html");
  if (isHTML) {
    // Network-first for HTML so updates land immediately when online; fall back to cache offline
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return r;
        })
        .catch(() => caches.match(e.request).then(m => m || caches.match("./index.html")))
    );
    return;
  }

  // Cache-first for static assets (versioned URLs make cache busting deterministic)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(r => {
        if (r.ok) {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return r;
      });
    })
  );
});
