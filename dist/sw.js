/* Lady Bedford's — service worker. Tiene l'app avviabile anche senza rete.
   Mai in cache: le chiamate al database (altro dominio) — gli ordini sono sempre in diretta. */
const VERSION = 'b952cf92d8'
const CACHE = 'lb-' + VERSION
const PRECACHE = ["assets/main-DLG6UZj-.js","assets/main-csyWkYlP.css","cassa.html","cassa.webmanifest","cucina.html","cucina.webmanifest","icons/192.png","icons/512.png","icons/apple-180.png","icons/cassa-192.png","icons/cassa-512.png","icons/cassa-apple-180.png","icons/cassa-maskable-512.png","icons/cucina-192.png","icons/cucina-512.png","icons/cucina-apple-180.png","icons/cucina-maskable-512.png","icons/maskable-512.png","icons/proprieta-192.png","icons/proprieta-512.png","icons/proprieta-apple-180.png","icons/proprieta-maskable-512.png","icons/sala-192.png","icons/sala-512.png","icons/sala-apple-180.png","icons/sala-maskable-512.png","icons/staff-192.png","icons/staff-512.png","icons/staff-apple-180.png","icons/staff-maskable-512.png","img/gal-0.webp","img/gal-1.webp","img/gal-2.webp","img/gal-3.webp","img/photo-4662.webp","img/photo-4663.webp","img/photo-4664.webp","img/photo-4666.webp","img/photo-4667.webp","img/story-I.webp","img/story-II.webp","img/story-III.webp","index.html","manifest.webmanifest","proprieta.html","proprieta.webmanifest","sala.html","sala.webmanifest","staff.html","staff.webmanifest"]

self.addEventListener('install', e => {
  const base = self.registration.scope
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([base, ...PRECACHE.map(f => new URL(f, base).href)])))
})
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('lb-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
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
