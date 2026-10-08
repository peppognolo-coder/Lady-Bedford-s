/* Lady Bedford's — service worker. Tiene l'app avviabile anche senza rete.
   Mai in cache: le chiamate al database (altro dominio) — gli ordini sono sempre in diretta. */
const VERSION = '__VERSION__'
const CACHE = 'lb-' + VERSION
const PRECACHE = __PRECACHE__

self.addEventListener('install', e => {
  const base = self.registration.scope
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([base, ...PRECACHE.map(f => new URL(f, base).href)])))
})
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('lb-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => (list[0] ? list[0].focus() : self.clients.openWindow(self.registration.scope))))
})
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting() })

// pagina di riserva quando manca la rete: /cucina → cucina.html, /staff → staff.html, altrimenti la home
function pageFor(url) {
  const last = url.pathname.split('/').pop()
  if (/^(staff|cucina|sala|cassa|proprieta)$/.test(last)) return last + '.html'
  return /\.html$/.test(last) ? last : './'
}
self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return   // database, font, ecc.: sempre in rete

  if (req.mode === 'navigate') {
    // pagina: prima la rete (così si vede subito una nuova versione), se manca la rete la copia salvata
    e.respondWith(
      fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)) } return res })
        .catch(async () => (await caches.match(req)) || (await caches.match(new URL(pageFor(url), self.registration.scope).href)) || Response.error()),
    )
    return
  }
  // file dell'app (nomi con impronta) e immagini: dalla copia, se manca dalla rete
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)) } return res })))
})
