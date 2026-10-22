// sw.js — Bangi Bay installierbar und offline spielbar.
// Netz zuerst: online kommt bei jedem Start der aktuelle Stand (und landet im Cache), offline springt der Cache ein.
// Beim Installieren wird das ganze Spiel vorab geladen (precache.json, entsteht beim Veröffentlichen).
const VERSION = 'ffae798'; // beim Veröffentlichen ersetzt: neuer Stand → neuer Service Worker → frischer Vorab-Cache
const CACHE = 'bangi-' + VERSION;
const THREE = 'https://cdn.jsdelivr.net/npm/three@0.170.0/';
const THREE_FILES = ['build/three.module.js', 'examples/jsm/controls/OrbitControls.js', 'examples/jsm/geometries/RoundedBoxGeometry.js', 'examples/jsm/utils/BufferGeometryUtils.js'].map((f) => THREE + f);

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    let list = [];
    try { const r = await fetch('precache.json', { cache: 'no-store' }); if (r.ok) list = await r.json(); } catch (err) { /* ohne Liste: Cache füllt sich beim Spielen */ }
    await Promise.all([...list, ...THREE_FILES].map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})));
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('bangi-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res.ok && res.status === 200) cache.put(req, res.clone()).catch(() => {});
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') { const start = await cache.match('./', { ignoreSearch: true }) || await cache.match('index.html', { ignoreSearch: true }); if (start) return start; }
      throw err;
    }
  })());
});
