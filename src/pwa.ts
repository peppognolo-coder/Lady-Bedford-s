/** Registra il service worker (solo in produzione, su http/https). Gli aggiornamenti dello staff non si applicano da soli:
 *  compare un avviso e si ricarica quando la cuoca o il cassiere lo decidono, mai a metà di un ordine. */
export function registerPwa(staff: boolean) {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol) || !import.meta.env.PROD) return
  if ((window as { __LB_DEMO?: unknown }).__LB_DEMO) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      if (!staff) return
      const offer = (w: ServiceWorker) => showUpdate(() => w.postMessage('SKIP_WAITING'))
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const w = reg.installing
        w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w) })
      })
      setInterval(() => void reg.update().catch(() => undefined), 30 * 60 * 1000)   // controlla nuove versioni ogni mezz'ora
    }).catch(() => undefined)
    let reloaded = false
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (staff && !reloaded) { reloaded = true; location.reload() } })
  })
}

function showUpdate(apply: () => void) {
  if (document.getElementById('lb-update')) return
  const bar = document.createElement('div')
  bar.id = 'lb-update'; bar.setAttribute('role', 'status')
  bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:99;display:flex;gap:12px;align-items:center;justify-content:space-between;padding:12px 14px;background:#1e423a;color:#f3f2f2;border-radius:6px;font:15px/1.3 Lora,Georgia,serif;box-shadow:0 4px 18px rgba(0,0,0,.25)'
  const t = document.createElement('span'); t.textContent = 'È pronta una nuova versione.'
  const b = document.createElement('button'); b.textContent = 'Aggiorna ora'
  b.style.cssText = 'min-height:44px;padding:0 16px;border:1px solid #d6aa5c;background:transparent;color:#f3f2f2;border-radius:4px;font:inherit;cursor:pointer'
  b.onclick = () => { b.disabled = true; apply() }
  bar.append(t, b); document.body.appendChild(bar)
}
