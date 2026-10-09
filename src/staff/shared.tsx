import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { api, type Order, type PayMethod } from '../api'
import { useCatalog, sortMenu, catsOf } from '../catalog'
import { eur } from '../data'

export const money = (n: number) => eur(n, 'it')
export const pad = (n: number) => String(n).padStart(3, '0')

export function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t) }, [ms])
  return now
}

/** Ordini di oggi, aggiornati in tempo reale (con polling di sicurezza). */
export function useOrders(onNew?: (o: Order[]) => void, onReady?: (o: Order[]) => void) {
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const seen = useRef<Set<string> | null>(null)
  const cb = useRef(onNew); cb.current = onNew
  const cbReady = useRef(onReady); cbReady.current = onReady
  const statuses = useRef<Map<string, string> | null>(null)

  const load = useCallback(async () => {
    try {
      const list = await api.listOrders()
      setOrders(list); setError(null); setLoaded(true)
      if (seen.current) {
        const fresh = list.filter(o => !seen.current!.has(o.id))
        if (fresh.length) cb.current?.(fresh)
      }
      if (statuses.current) {
        const turned = list.filter(o => o.status === 'ready' && statuses.current!.get(o.id) && statuses.current!.get(o.id) !== 'ready')
        if (turned.length) cbReady.current?.(turned)
      }
      statuses.current = new Map(list.map(o => [o.id, o.status]))
      seen.current = new Set(list.map(o => o.id))
    } catch (e) { setError((e as Error).message) }
  }, [])

  useEffect(() => {
    void load()
    const off = api.subscribe(() => void load())
    const t = setInterval(() => void load(), 10000)
    return () => { off(); clearInterval(t) }
  }, [load])
  return { orders, error, loaded, reload: load }
}

/** Tiene lo schermo acceso (tablet in cucina). */
export function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const get = async () => {
      try { lock = await (navigator as unknown as { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen') } catch { /* non supportato */ }
    }
    void get()
    const onVis = () => { if (document.visibilityState === 'visible') void get() }
    document.addEventListener('visibilitychange', onVis)
    return () => { document.removeEventListener('visibilitychange', onVis); void lock?.release() }
  }, [])
}

/** Minuti al ritiro (negativo = in ritardo); null se senza fascia. */
export function minsToSlot(o: Order, now: number) {
  if (!o.pickup_slot) return null
  const [h, m] = o.pickup_slot.split(':').map(Number)
  const d = new Date(o.created_at); d.setHours(h, m, 0, 0)
  return Math.round((d.getTime() - now) / 60000)
}
export const ageMin = (o: Order, now: number) => Math.max(0, Math.round((now - new Date(o.created_at).getTime()) / 60000))

export function OrderHeader({ o, now }: { o: Order; now: number }) {
  const m = minsToSlot(o, now)
  const late = m !== null && m <= 0
  const soon = m !== null && m > 0 && m <= 10
  return (
    <div className="st-ohead">
      <div className="st-num tnum">{pad(o.number)}</div>
      <div className="st-who">
        <div className="st-name">{o.customer_name || o.table_label || '—'}</div>
        <div className="st-sub">
          <span className={`st-src ${o.source}`}>{o.source === 'app' ? 'App' : o.source === 'floor' ? 'Sala' : 'Banco'}</span>
          {o.table_label && o.customer_name ? <span>{o.table_label}</span> : null}
          {o.pickup_slot && <span className="tnum">ritiro {o.pickup_slot}</span>}
        </div>
      </div>
      <div className={`st-when tnum ${late ? 'late' : soon ? 'soon' : ''}`}>
        {m === null ? `da ${ageMin(o, now)}′` : m <= 0 ? `ritardo ${-m}′` : m >= 90 ? `ore ${o.pickup_slot}` : `tra ${m}′`}
      </div>
    </div>
  )
}

/** Servire un ordine pronto: se già pagato si chiude, altrimenti resta "servito" in attesa del conto. */
export const serveOrder = (o: Order) => api.setStatus(o.id, o.payment_status === 'paid' ? 'completed' : 'served')
/** Incassare un ordine; se era già stato servito si chiude. */
export async function settleOrder(o: Order, method: PayMethod) {
  await api.setPayment(o.id, method)
  if (o.status === 'served') await api.setStatus(o.id, 'completed')
}
export const tableName = (n: number) => `Tavolo ${n}`

export function Availability() {
  const { catalog, reload } = useCatalog()
  const CATS = catsOf(catalog.content)
  const [busy, setBusy] = useState<string | null>(null)
  const items = sortMenu(catalog.menu.filter(m => m.visible))
  const toggle = async (id: string, available: boolean) => {
    setBusy(id)
    try { await api.setAvailability(id, available); await reload() } finally { setBusy(null) }
  }
  return (
    <div className="st-pane">
      <p className="st-hint">Segna come esaurito ciò che è finito: sparisce subito dall’ordine nell’app, in sala e in cassa.</p>
      {CATS.map(c => (
        <section key={c.id} className="st-avail-group">
          <h3 className="st-h3">{c.it}</h3>
          <div className="st-avail-grid">
            {items.filter(m => m.cat === c.id).map(m => (
              <button key={m.id} className={`st-avail ${m.available ? '' : 'off'}`} disabled={busy === m.id} aria-pressed={!m.available} onClick={() => toggle(m.id, !m.available)}>
                <span>{m.name.it}</span>
                <span className="st-avail-tag">{m.available ? 'Disponibile' : 'Esaurito'}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export function Field({ label, id, children, hint }: { label: string; id: string; children: ReactNode; hint?: string }) {
  return <div className="st-field"><label htmlFor={id}>{label}</label>{children}{hint && <small>{hint}</small>}</div>
}
export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} className="st-switch" onClick={() => onChange(!on)}><i aria-hidden /> {label}</button>
}

