import { useMemo, useState } from 'react'
import { api, type Order, type PayMethod } from '../api'
import Pos from './Pos'
import { Availability, OrderHeader, money, pad, serveOrder, settleOrder, useBeep, useNow, useOrders } from './shared'

type Tab = 'orders' | 'tables' | 'pos' | 'day' | 'out'
const STATUS_LABEL = { new: 'In coda', preparing: 'In preparazione', ready: 'Pronto', served: 'Servito', completed: 'Consegnato', cancelled: 'Annullato' } as const
const PAY_LABEL: Record<PayMethod, string> = { cash: 'Contanti', card: 'Carta' }

export default function Cashier({ onLogout }: { onLogout: () => void }) {
  const beep = useBeep()
  const { orders, error, reload } = useOrders(() => beep.play())
  const now = useNow(15000)
  const [tab, setTab] = useState<Tab>('orders')
  const [err, setErr] = useState<string | null>(null)
  const open = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled')
  const readyUnpaid = open.filter(o => o.status === 'ready' && o.payment_status === 'unpaid').length

  const run = async (f: () => Promise<void>) => { try { setErr(null); await f(); await reload() } catch (e) { setErr((e as Error).message) } }

  return (
    <div className="st-shell">
      <header className="st-bar">
        <div className="st-brand"><span className="st-mono">LB</span><div><div className="st-kicker">Cassa</div><div className="st-title">{open.length} ordini aperti</div></div></div>
        <nav className="st-tabs" aria-label="Sezioni">
          <button aria-pressed={tab === 'orders'} onClick={() => setTab('orders')}>Ordini{readyUnpaid > 0 && <i className="st-dot" aria-label={`${readyUnpaid} pronti da incassare`}>{readyUnpaid}</i>}</button>
          <button aria-pressed={tab === 'tables'} onClick={() => setTab('tables')}>Tavoli</button>
          <button aria-pressed={tab === 'pos'} onClick={() => setTab('pos')}>Nuovo ordine</button>
          <button aria-pressed={tab === 'day'} onClick={() => setTab('day')}>Giornata</button>
          <button aria-pressed={tab === 'out'} onClick={() => setTab('out')}>Esaurito</button>
        </nav>
        <div className="st-tools">
          <button className="st-ghost" aria-pressed={beep.on} onClick={beep.enable}>{beep.on ? 'Suono attivo' : 'Attiva suono'}</button>
          <button className="st-ghost" onClick={onLogout}>Esci</button>
        </div>
      </header>
      {(error || err) && <div className="st-alert" role="alert">{err || `Connessione: ${error}`}</div>}
      <main className="st-main">
        {tab === 'orders' && <OrdersTab orders={orders} now={now} run={run} />}
        {tab === 'tables' && <TablesTab orders={orders} now={now} run={run} />}
        {tab === 'pos' && <Pos mode="cashier" onSent={() => { void reload(); setTab('orders') }} />}
        {tab === 'day' && <Day orders={orders} />}
        {tab === 'out' && <Availability />}
      </main>
    </div>
  )
}

function OrdersTab({ orders, now, run }: { orders: Order[]; now: number; run: (f: () => Promise<void>) => Promise<void> }) {
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)
  const open = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled')
    .sort((a, b) => (a.status === 'ready' ? -1 : 0) - (b.status === 'ready' ? -1 : 0) || a.number - b.number)
  const closed = orders.filter(o => o.status === 'completed' || o.status === 'cancelled').sort((a, b) => b.number - a.number)

  const card = (o: Order, closedCard = false) => {
    const unpaid = o.payment_status === 'unpaid'
    return (
      <article key={o.id} className={`st-card s-${o.status}`}>
        <OrderHeader o={o} now={now} />
        <ul className="st-lines compact">
          {o.items.map((i, k) => <li key={k}><b className="st-qty tnum">{i.qty}×</b><span>{i.name}</span><em className="tnum">{money(i.unit_price * i.qty)}</em></li>)}
        </ul>
        {o.note && <div className="st-note"><b>Nota</b> {o.note}</div>}
        <div className="st-rowline">
          <span className={`st-pill ${o.status}`}>{STATUS_LABEL[o.status]}</span>
          <span className={`st-pill ${unpaid ? 'unpaid' : 'paid'}`}>{unpaid ? 'Da incassare' : `Pagato · ${PAY_LABEL[o.payment_method as PayMethod] || ''}`}</span>
          <b className="st-total tnum">{money(o.total)}</b>
        </div>
        {!closedCard && (
          <div className="st-actions">
            {unpaid && (['cash', 'card'] as PayMethod[]).map(m => <button key={m} className="st-act alt" onClick={() => run(() => settleOrder(o, m))}>{PAY_LABEL[m]}</button>)}
            {o.status === 'ready' && !unpaid && <button className="st-act" onClick={() => run(() => serveOrder(o))}>{o.source === 'app' ? 'Consegnato' : 'Servito'}</button>}
            {(o.status === 'new' || o.status === 'preparing') && !unpaid && <span className="st-hint">{o.status === 'new' ? 'In attesa della cucina' : 'In preparazione'}</span>}
            {o.status === 'ready' && unpaid && o.source === 'app' && <span className="st-hint">Incassa per consegnare</span>}
            {confirmCancel === o.id
              ? <button className="st-act danger" onClick={() => { setConfirmCancel(null); void run(() => api.setStatus(o.id, 'cancelled')) }}>Conferma annullo</button>
              : <button className="st-back" onClick={() => setConfirmCancel(o.id)}>Annulla ordine</button>}
          </div>
        )}
      </article>
    )
  }
  return (
    <div className="st-pane wide">
      {open.length === 0 && <div className="st-empty big">Nessun ordine aperto.</div>}
      <div className="st-grid">{open.map(o => card(o))}</div>
      {closed.length > 0 && (
        <section>
          <button className="st-ghost" onClick={() => setShowDone(v => !v)} aria-expanded={showDone}>{showDone ? 'Nascondi' : 'Mostra'} chiusi oggi ({closed.length})</button>
          {showDone && <div className="st-grid">{closed.map(o => card(o, true))}</div>}
        </section>
      )}
    </div>
  )
}

function Day({ orders }: { orders: Order[] }) {
  const s = useMemo(() => {
    const valid = orders.filter(o => o.status !== 'cancelled')
    const paid = valid.filter(o => o.payment_status === 'paid')
    const sum = (l: Order[]) => l.reduce((a, o) => a + o.total, 0)
    const sold = new Map<string, { name: string; qty: number; rev: number }>()
    valid.forEach(o => o.items.forEach(i => { const e = sold.get(i.item_id) || { name: i.name, qty: 0, rev: 0 }; e.qty += i.qty; e.rev += i.qty * i.unit_price; sold.set(i.item_id, e) }))
    return {
      count: valid.length, cancelled: orders.length - valid.length,
      paidTotal: sum(paid), cash: sum(paid.filter(o => o.payment_method === 'cash')), card: sum(paid.filter(o => o.payment_method === 'card')),
      unpaid: sum(valid.filter(o => o.payment_status === 'unpaid')), avg: valid.length ? sum(valid) / valid.length : 0,
      app: valid.filter(o => o.source === 'app').length, counter: valid.filter(o => o.source === 'counter').length,
      products: [...sold.values()].sort((a, b) => b.qty - a.qty),
    }
  }, [orders])
  const stat = (label: string, v: string, sub?: string) => <div className="st-stat"><span>{label}</span><b className="tnum">{v}</b>{sub && <small>{sub}</small>}</div>
  return (
    <div className="st-pane">
      <h2 className="st-h2">Riepilogo di oggi</h2>
      <div className="st-stats">
        {stat('Incassato', money(s.paidTotal), `${money(s.cash)} contanti · ${money(s.card)} carta`)}
        {stat('Da incassare', money(s.unpaid), 'ordini aperti non pagati')}
        {stat('Ordini', String(s.count), `${s.app} da app · ${s.counter} al banco${s.cancelled ? ` · ${s.cancelled} annullati` : ''}`)}
        {stat('Scontrino medio', money(s.avg))}
      </div>
      <h3 className="st-h3">Prodotti venduti</h3>
      {s.products.length === 0 ? <div className="st-empty">Ancora nessuna vendita.</div> : (
        <div className="st-tablewrap"><table className="st-table">
          <thead><tr><th>Prodotto</th><th className="r">Quantità</th><th className="r">Valore</th></tr></thead>
          <tbody>{s.products.map(p => <tr key={p.name}><td>{p.name}</td><td className="r tnum">{p.qty}</td><td className="r tnum">{money(p.rev)}</td></tr>)}</tbody>
        </table></div>
      )}
      <p className="st-hint">Ultimo ordine di oggi: n. {orders.length ? pad(Math.max(...orders.map(o => o.number))) : '—'}. Il conteggio riparte da 001 ogni giorno.</p>
    </div>
  )
}

function TablesTab({ orders, now, run }: { orders: Order[]; now: number; run: (f: () => Promise<void>) => Promise<void> }) {
  const open = orders.filter(o => o.table_label && o.status !== 'completed' && o.status !== 'cancelled')
  const groups = new Map<string, Order[]>()
  open.forEach(o => groups.set(o.table_label!, [...(groups.get(o.table_label!) || []), o]))
  const list = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'it', { numeric: true }))
  const pay = (os: Order[], m: PayMethod) => run(async () => { for (const o of os.filter(x => x.payment_status === 'unpaid')) await settleOrder(o, m) })
  return (
    <div className="st-pane wide">
      <p className="st-hint">Un conto per tavolo: incassa tutte le comande aperte in un colpo solo.</p>
      {list.length === 0 && <div className="st-empty big">Nessun tavolo con ordini aperti.</div>}
      <div className="st-grid">
        {list.map(([label, os]) => {
          const due = os.filter(o => o.payment_status === 'unpaid').reduce((a, o) => a + o.total, 0)
          const pending = os.filter(o => o.status === 'new' || o.status === 'preparing').length
          return (
            <article key={label} className="st-card">
              <div className="st-ohead"><div className="st-who"><div className="st-name" style={{ fontSize: 24 }}>{label}</div>
                <div className="st-sub"><span>{os.length} comande</span>{pending > 0 && <span>{pending} in cucina</span>}<span className="tnum">dalle {new Date(os[0].created_at).toTimeString().slice(0, 5)}</span></div></div>
                <div className="st-when tnum">{Math.round((now - new Date(os[0].created_at).getTime()) / 60000)}′</div></div>
              <ul className="st-lines compact">
                {os.flatMap(o => o.items.map((i, k) => <li key={`${o.id}-${k}`}><b className="st-qty tnum">{i.qty}×</b><span>{i.name}</span><em className="tnum">{money(i.unit_price * i.qty)}</em></li>))}
              </ul>
              <div className="st-rowline"><span className="st-hint">Da incassare</span><b className="st-total tnum">{money(due)}</b></div>
              {due > 0
                ? <div className="st-actions"><button className="st-act" onClick={() => pay(os, 'cash')}>Contanti</button><button className="st-act" onClick={() => pay(os, 'card')}>Carta</button></div>
                : <span className="st-pill paid" style={{ alignSelf: 'flex-start' }}>Tutto pagato</span>}
            </article>
          )
        })}
      </div>
    </div>
  )
}
