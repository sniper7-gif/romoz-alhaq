// Network-first worker. Pages and static assets are cached only as an offline fallback, so an old
// shell is never served while online. Caches named "rah-tiles*" hold downloaded map tiles and are kept.
const SHELL = "rah-shell-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith("rah-tiles") && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  if (req.mode !== "navigate" && !url.pathname.startsWith("/_next/static/")) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && !res.redirected) {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(req, { ignoreSearch: req.mode === "navigate" });
        if (hit) return hit;
        if (req.mode !== "navigate") return Response.error();
        return new Response("<!doctype html><meta charset=utf-8><title>Offline</title><body style='background:#000;color:#0f0;font-family:monospace;display:grid;place-items:center;height:100vh'>OFFLINE", { headers: { "Content-Type": "text/html; charset=utf-8" } });
      })
  );
});
