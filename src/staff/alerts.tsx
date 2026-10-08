import { useCallback, useEffect, useRef, useState } from 'react'
import type { Order } from '../api'
import { useBackoffice } from '../backoffice'
import { flagTitle, playTune, systemNotify, unlockOnGesture, vibrate, type AlertKind } from '../alertsound'

export type { AlertKind }
export interface AlertPrefs { sound: boolean; volume: number; vibrate: boolean; system: boolean; kinds: Record<AlertKind, boolean> }
const KEY = 'lb:alerts'
const DEFAULTS: AlertPrefs = { sound: true, volume: 0.7, vibrate: true, system: false, kinds: { order: true, ready: true, booking: true, stock: true } }
export const KIND_TEXT: Record<AlertKind, { label: string; hint: string; title: string }> = {
  order: { label: 'Nuovi ordini', hint: 'Due note ascendenti', title: 'Nuovo ordine' },
  ready: { label: 'Ordini pronti da servire', hint: 'Tre note, ripetute se restano in attesa', title: 'Ordine pronto' },
  booking: { label: 'Nuove prenotazioni', hint: 'Campanella', title: 'Nuova prenotazione' },
  stock: { label: 'Scorte sotto soglia', hint: 'Due note discendenti', title: 'Scorta in esaurimento' },
}

const read = (): AlertPrefs => {
  try { const r = JSON.parse(localStorage.getItem(KEY) || 'null'); if (r) return { ...DEFAULTS, ...r, kinds: { ...DEFAULTS.kinds, ...(r.kinds || {}) } } } catch { /* default */ }
  return DEFAULTS
}

/** Avvisi del dispositivo: suono, vibrazione, titolo della scheda e notifica di sistema. Le scelte si ricordano su questo dispositivo. */
export function useAlerts() {
  const [prefs, setPrefsState] = useState<AlertPrefs>(read)
  const [ready, setReady] = useState(false)
  const [perm, setPerm] = useState<NotificationPermission | 'none'>(() => (typeof Notification === 'undefined' ? 'none' : Notification.permission))
  const ref = useRef(prefs); ref.current = prefs

  useEffect(() => { unlockOnGesture(() => setReady(true)) }, [])
  const setPrefs = useCallback((p: Partial<AlertPrefs>) => {
    setPrefsState(o => { const n = { ...o, ...p }; try { localStorage.setItem(KEY, JSON.stringify(n)) } catch { /* ignora */ } return n })
  }, [])
  const setKind = (k: AlertKind, v: boolean) => setPrefs({ kinds: { ...prefs.kinds, [k]: v } })

  const play = useCallback((kind: AlertKind = 'order', detail?: string) => {
    const p = ref.current
    if (!p.kinds[kind]) return
    if (p.sound) playTune(kind, p.volume)
    if (p.vibrate) vibrate(kind)
    flagTitle()
    if (p.system) void systemNotify(KIND_TEXT[kind].title, detail || KIND_TEXT[kind].label, 'lb-' + kind)
  }, [])
  const askSystem = async () => {
    if (typeof Notification === 'undefined') return
    try { const r = await Notification.requestPermission(); setPerm(r); setPrefs({ system: r === 'granted' }) } catch { /* ignora */ }
  }
  /** Compatibile con il vecchio pulsante "Attiva suono". */
  const enable = () => { setReady(true); setPrefs({ sound: true }); playTune('order', prefs.volume) }
  return { prefs, setPrefs, setKind, play, perm, askSystem, on: prefs.sound && ready, enable }
}
export type Alerts = ReturnType<typeof useAlerts>

/** Ripete l'avviso finché ci sono ordini pronti non ancora serviti (dopo `afterMin` minuti, ogni `everyMin`). */
export function useReadyReminder(orders: Order[], alerts: Alerts, filter: (o: Order) => boolean = () => true, afterMin = 3, everyMin = 2) {
  const list = useRef(orders); list.current = orders
  const f = useRef(filter); f.current = filter
  const since = useRef(new Map<string, number>())   // da quando questo dispositivo vede l'ordine "pronto"
  const last = useRef(0)
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now(), ready = list.current.filter(o => o.status === 'ready' && f.current(o))
      const keep = new Map<string, number>()
      ready.forEach(o => keep.set(o.id, since.current.get(o.id) ?? now))
      since.current = keep
      const waiting = ready.filter(o => now - keep.get(o.id)! > afterMin * 60000)
      if (waiting.length && now - last.current > everyMin * 60000) { last.current = now; alerts.play('ready', `${waiting.length} in attesa di essere serviti`) }
    }, 20000)
    return () => clearInterval(t)
  }, [alerts, afterMin, everyMin])
}

/** Ingredienti sotto la soglia di riordino; avvisa quando uno ne entra (il primo caricamento è silenzioso). */
export function useLowStock(alerts: Alerts) {
  const { data } = useBackoffice()
  const low = data.ingredients.filter(i => i.min_stock > 0 && i.stock <= i.min_stock)
  const seen = useRef<Set<string> | null>(null)
  const key = low.map(i => i.id).sort().join(',')
  useEffect(() => {
    if (!data.ingredients.length) return
    const ids = new Set(low.map(i => i.id))
    if (seen.current) {
      const fresh = low.filter(i => !seen.current!.has(i.id))
      if (fresh.length) alerts.play('stock', fresh.map(i => i.name).slice(0, 3).join(', '))
    }
    seen.current = ids
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, data.ingredients.length])
  return low
}

/** Pulsante "Avvisi" con pannello delle preferenze di questo dispositivo. */
export function AlertsButton({ alerts }: { alerts: Alerts }) {
  const [open, setOpen] = useState(false)
  const { prefs, setPrefs, setKind, play, perm, askSystem } = alerts
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])
  const muted = !prefs.sound && !prefs.vibrate
  return (
    <div className="st-popwrap" ref={box}>
      <button className="st-ghost" aria-expanded={open} aria-haspopup="dialog" aria-pressed={!muted} onClick={() => setOpen(o => !o)}>{muted ? 'Avvisi spenti' : 'Avvisi'}</button>
      {open && (
        <div className="st-pop" role="dialog" aria-label="Avvisi di questo dispositivo">
          <h3 className="st-h3">Avvisi di questo dispositivo</h3>
          <div className="st-switches">
            <button type="button" className="st-switch" role="switch" aria-checked={prefs.sound} onClick={() => setPrefs({ sound: !prefs.sound })}><i /> Suono</button>
            <button type="button" className="st-switch" role="switch" aria-checked={prefs.vibrate} onClick={() => setPrefs({ vibrate: !prefs.vibrate })}><i /> Vibrazione</button>
          </div>
          <label className="st-vol">Volume
            <input type="range" min={0.1} max={1} step={0.05} value={prefs.volume} onChange={e => setPrefs({ volume: Number(e.target.value) })} onPointerUp={() => play('order')} />
          </label>
          <ul className="st-kinds">
            {(Object.keys(KIND_TEXT) as AlertKind[]).map(k => (
              <li key={k}>
                <button type="button" className="st-switch" role="switch" aria-checked={prefs.kinds[k]} onClick={() => setKind(k, !prefs.kinds[k])}><i /> <span>{KIND_TEXT[k].label}<small>{KIND_TEXT[k].hint}</small></span></button>
                <button type="button" className="st-ghost small" onClick={() => play(k)}>Prova</button>
              </li>
            ))}
          </ul>
          {perm !== 'none' && (
            <div className="st-sys">
              {perm === 'granted'
                ? <button type="button" className="st-switch" role="switch" aria-checked={prefs.system} onClick={() => setPrefs({ system: !prefs.system })}><i /> Notifica di sistema quando l’app è in secondo piano</button>
                : perm === 'denied'
                  ? <p className="st-hint">Le notifiche di sistema sono bloccate: si riattivano dalle impostazioni del browser.</p>
                  : <button type="button" className="st-ghost" onClick={() => void askSystem()}>Attiva le notifiche di sistema</button>}
            </div>
          )}
          <p className="st-hint">Gli avvisi suonano mentre l’app è aperta, anche se sei su un’altra scheda. Tieni lo schermo acceso e il volume alzato.</p>
        </div>
      )}
    </div>
  )
}

