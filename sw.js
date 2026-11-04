// Service worker: makes the app work offline.
// Strategy: network-first, falling back to the cache. When online you always get the latest
// files (so updates arrive without a manual cache bump); with no signal the cached copy loads.
// Keep SHELL in sync when new files are added so a first offline launch has everything.
const CACHE = "workout-v2";
const SHELL = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "store.js",
  "progression.js",
  "chart.js",
  "manifest.webmanifest",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});


self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  // Network first, bypassing the browser's HTTP cache (GitHub Pages sends max-age=600) so updates show
  // up straight away. If the network takes longer than 3 s (weak gym signal) use the cached copy instead.
  // An error page (404 if hosting is switched off, 5xx) is treated like "no network": never shown, never cached.
  const net = fetch(req, { cache: "no-cache" }).then((res) => {
    if (!res.ok) throw new Error("bad response " + res.status);
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
    return res;
  });
  net.catch(() => {}); // avoid an unhandled-rejection warning if the cache answered first
  const slow = new Promise((_, reject) => setTimeout(() => reject(new Error("slow")), 3000));
  event.respondWith(
    Promise.race([net, slow]).catch(() =>
      caches.match(req)
        .then((hit) => hit || (req.mode === "navigate" ? caches.match("index.html") : null))
        .then((hit) => hit || net) // nothing cached: keep waiting for the network
    )
  );
});
