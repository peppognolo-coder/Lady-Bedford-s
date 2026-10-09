import { useEffect, useRef, useState } from 'react'
import { api, type Order, type Status } from '../api'
import StockTab from './Stock'
import CookRecipes from './CookRecipes'
import { Availability, OrderHeader, minsToSlot, useNow, useOrders, useWakeLock } from './shared'
import { useCatalog } from '../catalog'
import { AlertsButton, useAlerts, useLowStock } from './alerts'
import NewOrderPopup from './NewOrderPopup'

const COLS: { id: Status; title: string; action?: { label: string; next: Status } }[] = [
  { id: 'new', title: 'Da preparare', action: { label: 'Inizia', next: 'preparing' } },
  { id: 'preparing', title: 'In preparazione', action: { label: 'Pronto', next: 'ready' } },
  { id: 'ready', title: 'Pronti al ritiro' },
]
const CAT_LABEL: Record<string, string> = { tea: 'Tè', pastry: 'Dolci', savoury: 'Salato', hamper: 'Cestini', mocktail: 'Analcolici' }

export default function Kitchen({ onLogout }: { onLogout: () => void }) {
  const alerts = useAlerts()
  const [incoming, setIncoming] = useState<string[]>([])
  const { orders, error } = useOrders(fresh => {
    alerts.play('order', fresh.map(o => o.items.map(i => `${i.qty}× ${i.name}`).join(', ')).join(' · '))
    if (alerts.prefs.popup) setIncoming(q => [...q, ...fresh.filter(o => o.status === 'new').map(o => o.id)])
  })
  const lowStock = useLowStock(alerts)
  const now = useNow(15000)
  const { catalog } = useCatalog()
  const warn = catalog.settings.late_warn_min ?? 6
  const [lateQ, setLateQ] = useState<string[]>([])
  const warned = useRef(new Set<string>()), due = useRef(new Set<string>())
  // ordini da asporto in ritardo: avviso con finestra se non sono ancora iniziati vicino al ritiro, suono se sono in preparazione all'ora del ritiro
  useEffect(() => {
    const check = () => {
      const t = Date.now(), add: string[] = [], dueNow: string[] = []
      for (const o of orders) {
        const m = o.pickup_slot ? minsToSlot(o, t) : null
        if (m === null) continue
        if (o.status === 'new' && m <= warn && !warned.current.has(o.id)) { warned.current.add(o.id); add.push(o.id) }
        if (o.status === 'preparing' && m <= 0 && !due.current.has(o.id)) { due.current.add(o.id); dueNow.push(o.id) }
      }
      if (add.length) { alerts.play('late', `${add.length} ordin${add.length === 1 ? 'e' : 'i'} da avviare: ritiro vicino`); if (alerts.prefs.popup) setLateQ(q => [...q, ...add]) }
      else if (dueNow.length) alerts.play('late', 'Ritiro adesso: ordine ancora in preparazione')
    }
    check()
    const iv = setInterval(check, 20000)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, warn])
  const lateNow = orders.filter(o => { const m = o.pickup_slot ? minsToSlot(o, now) : null; return m !== null && ((o.status === 'new' && m <= warn) || (o.status === 'preparing' && m <= 0)) })
  const [tab, setTab] = useState<'board' | 'out' | 'stock' | 'recipes'>('board')
  const [col, setCol] = useState<Status>('new')
  const [err, setErr] = useState<string | null>(null)
  useWakeLock()

  const move = async (o: Order, next: Status) => {
    try { setErr(null); await api.setStatus(o.id, next) } catch (e) { setErr((e as Error).message) }
  }
  const byStatus = (s: Status) => orders.filter(o => o.status === s)

  return (
    <div className="st-shell">
      <header className="st-bar">
        <div className="st-brand"><span className="st-mono">LB</span><div><div className="st-kicker">Cucina</div><div className="st-title">{byStatus('new').length} nuovi · {byStatus('preparing').length} in corso</div></div></div>
        <nav className="st-tabs" aria-label="Sezioni">
          <button aria-pressed={tab === 'board'} onClick={() => setTab('board')}>Ordini</button>
          <button aria-pressed={tab === 'out'} onClick={() => setTab('out')}>Esaurito</button>
          <button aria-pressed={tab === 'stock'} onClick={() => setTab('stock')}>Scorte{lowStock.length > 0 && <i className="st-dot" aria-label={`${lowStock.length} sotto scorta`}>{lowStock.length}</i>}</button>
          <button aria-pressed={tab === 'recipes'} onClick={() => setTab('recipes')}>Ricettario</button>
        </nav>
        <div className="st-tools">
          <AlertsButton alerts={alerts} />
          <button className="st-ghost" onClick={onLogout}>Esci</button>
        </div>
      </header>
      <NewOrderPopup late queue={lateQ} orders={orders} now={now} alerts={alerts} onStart={o => { setLateQ(q => q.filter(x => x !== o.id)); void move(o, 'preparing') }} onDismiss={id => setLateQ(q => q.filter(x => x !== id))} />
      <NewOrderPopup queue={lateQ.length ? [] : incoming} orders={orders} now={now} alerts={alerts} onStart={o => { setIncoming(q => q.filter(x => x !== o.id)); void move(o, 'preparing') }} onDismiss={id => setIncoming(q => q.filter(x => x !== id))} />
      {lateNow.length > 0 && <div className="st-alert" role="alert"><b>In ritardo sul ritiro:</b> {lateNow.map(o => `${String(o.number).padStart(3, '0')} ${o.customer_name || o.table_label || ''} (ritiro ${o.pickup_slot}, ${o.status === 'new' ? 'non ancora iniziato' : 'in preparazione'})`).join(' · ')}</div>}
      {(error || err) && <div className="st-alert" role="alert">{err || `Connessione: ${error}`}</div>}

      {tab === 'out' ? <main className="st-main"><Availability /></main> : tab === 'stock' ? <main className="st-main"><StockTab /></main> : tab === 'recipes' ? <main className="st-main"><CookRecipes /></main> : (
        <>
          <div className="st-coltabs" role="tablist">
            {COLS.map(c => <button key={c.id} role="tab" aria-selected={col === c.id} onClick={() => setCol(c.id)}>{c.title} <b className="tnum">{byStatus(c.id).length}</b></button>)}
          </div>
          <main className="st-board">
            {COLS.map(c => (
              <section key={c.id} className={`st-col ${col === c.id ? 'show' : ''}`} aria-label={c.title}>
                <h2 className="st-colhead">{c.title}<span className="tnum">{byStatus(c.id).length}</span></h2>
                <div className="st-cards">
                  {byStatus(c.id).length === 0 && <div className="st-empty">Nessun ordine</div>}
                  {byStatus(c.id).map(o => (
                    <article key={o.id} className={`st-card s-${o.status}`}>
                      <OrderHeader o={o} now={now} />
                      <ul className="st-lines">
                        {o.items.map((i, k) => (
                          <li key={k}><b className="st-qty tnum">{i.qty}×</b><span>{i.name}</span><em>{CAT_LABEL[i.cat] || ''}</em></li>
                        ))}
                      </ul>
                      {o.note && <div className="st-note"><b>Nota</b> {o.note}</div>}
                      {c.action && <button className="st-act" onClick={() => move(o, c.action!.next)}>{c.action.label}</button>}
                      {c.id === 'preparing' && <button className="st-back" onClick={() => move(o, 'new')}>Rimetti in coda</button>}
                      {c.id === 'ready' && <button className="st-back" onClick={() => move(o, 'preparing')}>Riporta in preparazione</button>}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </main>
        </>
      )}
    </div>
  )
}
