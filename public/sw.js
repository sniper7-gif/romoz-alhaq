// Network-first pass-through worker. It satisfies PWA installability but never
// stores responses, so an old HTML shell can never be served from a cache.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response("<!doctype html><meta charset=utf-8><title>Offline</title><body style='background:#000;color:#0f0;font-family:monospace;display:grid;place-items:center;height:100vh'>OFFLINE", { headers: { "Content-Type": "text/html; charset=utf-8" } })
    )
  );
});
