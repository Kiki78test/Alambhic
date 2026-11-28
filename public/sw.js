/* Cache de l'interface pour l'installation ; l'API passe toujours par le réseau. Notifications push (titres, alertes, repas, badges). */
const V = "yd-v19";
const SHELL = ["/", "/app.css", "/engine.js", "/avatar.js", "/demo-data.js", "/i18n.js", "/app.js", "/logo.png", "/manifest.webmanifest", "/icons/icon-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api") || u.pathname === "/ws" || u.pathname.startsWith("/docs")) return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match("/"))));
});
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  const care = d.tag === "alertes";
  e.waitUntil(self.registration.showNotification(d.title || "Alamb'hic", {
    body: d.body || "", icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: d.tag ? d.tag + ":" + (d.title || "") : undefined,
    data: { url: d.url || "/" }, requireInteraction: care, vibrate: care ? [200, 100, 200, 100, 200] : [80],
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if (new URL(c.url).origin === location.origin) { c.focus(); if (url !== "/") c.navigate(url).catch(() => {}); return; }
    return self.clients.openWindow(url);
  }));
});
