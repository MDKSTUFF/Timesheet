const CACHE = "mdk-field-v10";
const APP_SHELL = [
  "./", "./index.html", "./styles.css?v=10", "./app.js?v=10", "./data.js", "./pdf.js",
  "./manifest.webmanifest", "./assets/mdk-logo.jpg", "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png", "./vendor/jspdf.umd.min.js"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match("./index.html"))));
});
