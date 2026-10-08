import { useState } from 'react'
import { useCatalog } from '../catalog'
import { type Order } from '../api'
import Pos from './Pos'
import BookingsTab, { useBookings } from './BookingsTab'
import { Availability, OrderHeader, money, serveOrder, tableName, useBeep, useNow, useOrders } from './shared'

const STATUS_LABEL = { new: 'In coda', preparing: 'In preparazione', ready: 'Pronto da servire', served: 'Servito', completed: 'Chiuso', cancelled: 'Annullato' } as const

type TableState = 'free' | 'kitchen' | 'ready' | 'served'
function stateOf(os: Order[]): TableState {
  if (os.some(o => o.status === 'ready')) return 'ready'
  if (os.some(o => o.status === 'new' || o.status === 'preparing')) return 'kitchen'
  if (os.length) return 'served'
  return 'free'
}
const STATE_TXT: Record<TableState, string> = { free: 'Libero', kitchen: 'In cucina', ready: 'Da servire', served: 'Servito' }

export default function Waiter({ onLogout }: { onLogout: () => void }) {
  const beep = useBeep()
  const { catalog } = useCatalog()
  const { orders, error, reload } = useOrders(undefined, () => beep.play())
  const now = useNow(15000)
  const bookings = useBookings()
  const [tab, setTab] = useState<'tables' | 'book' | 'out'>('tables')
  const [table, setTable] = useState<number | null>(null)
  const [ordering, setOrdering] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const open = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled' && o.table_label)
  const forTable = (n: number) => open.filter(o => o.table_label === tableName(n))
  const toServe = open.filter(o => o.status === 'ready').length

  const serve = async (o: Order) => { try { setErr(null); await serveOrder(o); await reload() } catch (e) { setErr((e as Error).message) } }

  return (
    <div className="st-shell">
      <header className="st-bar">
        <div className="st-brand"><span className="st-mono">LB</span><div><div className="st-kicker">Sala</div><div className="st-title">{table ? tableName(table) : toServe ? `${toServe} da servire` : 'Tavoli'}</div></div></div>
        <nav className="st-tabs" aria-label="Sezioni">
          <button aria-pressed={tab === 'tables'} onClick={() => { setTab('tables'); setOrdering(false) }}>Tavoli{toServe > 0 && <i className="st-dot">{toServe}</i>}</button>
          <button aria-pressed={tab === 'book'} onClick={() => setTab('book')}>Prenotazioni{bookings.pending > 0 && <i className="st-dot">{bookings.pending}</i>}</button>
          <button aria-pressed={tab === 'out'} onClick={() => setTab('out')}>Esaurito</button>
        </nav>
        <div className="st-tools">
          <button className="st-ghost" aria-pressed={beep.on} onClick={beep.enable}>{beep.on ? 'Suono attivo' : 'Attiva suono'}</button>
          <button className="st-ghost" onClick={onLogout}>Esci</button>
        </div>
      </header>
      {(error || err) && <div className="st-alert" role="alert">{err || `Connessione: ${error}`}</div>}

      <main className="st-main">
        {tab === 'out' && <Availability />}
        {tab === 'book' && <BookingsTab bookings={bookings} />}
        {tab === 'tables' && table === null && (
          <div className="st-pane wide">
            <div className="st-tables">
              {Array.from({ length: catalog.settings.tables }, (_, i) => i + 1).map(n => {
                const os = forTable(n), st = stateOf(os)
                const due = os.filter(o => o.payment_status === 'unpaid').reduce((a, o) => a + o.total, 0)
                return (
                  <button key={n} className={`st-table-tile ${st}`} onClick={() => setTable(n)} aria-label={`${tableName(n)}: ${STATE_TXT[st]}`}>
                    <span className="st-table-n tnum">{n}</span>
                    <span className="st-table-s">{STATE_TXT[st]}</span>
                    {st !== 'free' && <span className="st-table-m tnum">{money(due)}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'tables' && table !== null && !ordering && (
          <div className="st-pane">
            <div className="st-rowline">
              <button className="st-ghost" onClick={() => setTable(null)}>← Tavoli</button>
              <b className="st-total tnum">{money(forTable(table).filter(o => o.payment_status === 'unpaid').reduce((a, o) => a + o.total, 0))}</b>
            </div>
            <button className="st-act" onClick={() => setOrdering(true)}>Nuova comanda</button>
            {forTable(table).length === 0 && <div className="st-empty">Nessuna comanda aperta per questo tavolo.</div>}
            {forTable(table).map(o => (
              <article key={o.id} className={`st-card s-${o.status}`}>
                <OrderHeader o={o} now={now} />
                <ul className="st-lines compact">
                  {o.items.map((i, k) => <li key={k}><b className="st-qty tnum">{i.qty}×</b><span>{i.name}</span></li>)}
                </ul>
                {o.note && <div className="st-note"><b>Nota</b> {o.note}</div>}
                <div className="st-rowline"><span className={`st-pill ${o.status}`}>{STATUS_LABEL[o.status]}</span>
                  {o.payment_status === 'paid' && <span className="st-pill paid">Pagato</span>}</div>
                {o.status === 'ready' && <button className="st-act" onClick={() => serve(o)}>Servito</button>}
              </article>
            ))}
            <p className="st-hint">Il conto si chiude in cassa, nella scheda Tavoli.</p>
          </div>
        )}

        {tab === 'tables' && table !== null && ordering && (
          <Pos mode="waiter" table={tableName(table)} onSent={() => { setOrdering(false); void reload() }} onCancel={() => setOrdering(false)} />
        )}
      </main>
    </div>
  )
}
