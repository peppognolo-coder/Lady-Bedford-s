import { useEffect, useRef } from 'react'
import type { Order } from '../api'
import { OrderHeader, money } from './shared'
import type { Alerts } from './alerts'
import { minsToSlot } from './shared'

/** Finestra a comparsa per i nuovi ordini: resta aperta e ripete il suono finché qualcuno non risponde. */
export default function NewOrderPopup({ queue, orders, now, alerts, onStart, onDismiss, late }: {
  queue: string[]; orders: Order[]; now: number; alerts: Alerts; onStart: (o: Order) => void; onDismiss: (id: string) => void; late?: boolean
}) {
  // solo gli ordini ancora "da preparare"
  const open = queue.map(id => orders.find(o => o.id === id)).filter((o): o is Order => !!o && o.status === 'new')
  const cur = open[0]
  const al = useRef(alerts); al.current = alerts
  const btn = useRef<HTMLButtonElement>(null)

  // se un ordine è già stato preso in carico (da un altro dispositivo) lo togliamo dalla coda
  useEffect(() => {
    queue.forEach(id => { const o = orders.find(x => x.id === id); if (o && o.status !== 'new') onDismiss(id) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders])
  // ripete il suono ogni 15 secondi finché la finestra è aperta
  useEffect(() => {
    if (!cur) return
    const t = setInterval(() => al.current.play(late ? 'late' : 'order'), 15000)
    return () => clearInterval(t)
  }, [cur?.id])
  useEffect(() => { if (cur) btn.current?.focus() }, [cur?.id])
  if (!cur) return null
  const total = cur.items.reduce((a, i) => a + i.qty, 0)
  return (
    <div className="st-popup-back" role="presentation">
      <div className={`st-popup${late ? ' late' : ''}`} role="alertdialog" aria-modal="true" aria-label={late ? 'Ordine in ritardo' : 'Nuovo ordine'}>
        <div className="st-popup-kicker">{late ? 'Ordine in ritardo' : 'Nuovo ordine'}{open.length > 1 ? ` · altri ${open.length - 1} in attesa` : ''}</div>
        <OrderHeader o={cur} now={now} />
        {late && (() => { const m = minsToSlot(cur, now); return m !== null && <div className="st-late-line">{m > 0 ? `Il cliente ritira alle ${cur.pickup_slot} (tra ${m}′) e l’ordine non è ancora iniziato.` : `Il ritiro era alle ${cur.pickup_slot}: il cliente sta aspettando.`}</div> })()}
        <ul className="st-lines">
          {cur.items.map((i, k) => <li key={k}><b className="st-qty tnum">{i.qty}×</b><span>{i.name}</span></li>)}
        </ul>
        {cur.note && <div className="st-note"><b>Nota</b> {cur.note}</div>}
        <div className="st-hint">{total} {total === 1 ? 'prodotto' : 'prodotti'} · {money(cur.total)}</div>
        <div className="st-actions">
          <button ref={btn} className="st-act" onClick={() => onStart(cur)}>Inizia subito</button>
          <button className="st-act alt" onClick={() => onDismiss(cur.id)}>Visto, lo preparo dopo</button>
        </div>
      </div>
    </div>
  )
}
