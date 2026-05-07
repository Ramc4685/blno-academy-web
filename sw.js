const CACHE_NAME = "blno-academy-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./parent.html",
  "./parent/history/",
  "./coach.html",
  "./coach/payslip/",
  "./admin.html",
  "./admin/dues.html",
  "./admin/sessions.html",
  "./admin/coaches.html",
  "./admin/payments.html",
  "./admin/attendance.html",
  "./css/styles.css",
  "./js/config.js",
  "./js/auth.js",
  "./js/api.js",
  "./js/ui.js",
  "./js/pwa.js",
  "./js/parent.js",
  "./js/coach.js",
  "./js/admin.js",
  "./favicon.svg",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((cached) => cached || caches.match("./")))
  );
});
