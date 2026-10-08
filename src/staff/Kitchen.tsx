import { useState } from 'react'
import { api, type Order, type Status } from '../api'
import StockTab from './Stock'
import CookRecipes from './CookRecipes'
import { Availability, OrderHeader, useBeep, useNow, useOrders, useWakeLock } from './shared'

const COLS: { id: Status; title: string; action?: { label: string; next: Status } }[] = [
  { id: 'new', title: 'Da preparare', action: { label: 'Inizia', next: 'preparing' } },
  { id: 'preparing', title: 'In preparazione', action: { label: 'Pronto', next: 'ready' } },
  { id: 'ready', title: 'Pronti al ritiro' },
]
const CAT_LABEL: Record<string, string> = { tea: 'Tè', pastry: 'Dolci', savoury: 'Salato', hamper: 'Cestini', mocktail: 'Analcolici' }

export default function Kitchen({ onLogout }: { onLogout: () => void }) {
  const beep = useBeep()
  const { orders, error } = useOrders(() => beep.play())
  const now = useNow(15000)
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
          <button aria-pressed={tab === 'stock'} onClick={() => setTab('stock')}>Scorte</button>
          <button aria-pressed={tab === 'recipes'} onClick={() => setTab('recipes')}>Ricettario</button>
        </nav>
        <div className="st-tools">
          <button className="st-ghost" aria-pressed={beep.on} onClick={beep.enable}>{beep.on ? 'Suono attivo' : 'Attiva suono'}</button>
          <button className="st-ghost" onClick={onLogout}>Esci</button>
        </div>
      </header>
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
