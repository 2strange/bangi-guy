// sw.js — macht Bangi Bay installierbar (Vollbild vom Startbildschirm). Kein Cache: jeder Start lädt den aktuellen Stand.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
