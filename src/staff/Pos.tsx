import { useState } from 'react'
import { api, type PayMethod } from '../api'
import { useCatalog, sortMenu } from '../catalog'
import { CATS } from '../data'
import { money, useNow } from './shared'
import { menuNow } from '../schedule'

/** Comanda: usata dalla cassa (banco, può incassare) e dalla sala (tavolo fisso, solo invio in cucina). */
export default function Pos({ mode, table, onSent, onCancel }: { mode: 'cashier' | 'waiter'; table?: string; onSent: () => void; onCancel?: () => void }) {
  const { catalog } = useCatalog()
  const [cat, setCat] = useState('tea')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [who, setWho] = useState('')
  const [tableText, setTableText] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useNow(60000)
  const menu = menuNow(sortMenu(catalog.menu.filter(m => m.visible)), catalog.settings)
  const byId = Object.fromEntries(menu.map(m => [m.id, m]))
  const lines = Object.entries(cart).filter(([id]) => byId[id]).map(([id, q]) => ({ id, q, m: byId[id] }))
  const total = lines.reduce((a, l) => a + l.m.price * l.q, 0)
  const add = (id: string, d: number) => setCart(c => { const q = Math.max(0, (c[id] || 0) + d); const n = { ...c, [id]: q }; if (!q) delete n[id]; return n })
  const tableLabel = table ?? tableText

  const send = async (pay: PayMethod | null) => {
    if (!lines.length) return
    setBusy(true); setErr(null)
    try {
      await api.createCounterOrder({ customer_name: who, table_label: tableLabel, note, pay, source: mode === 'waiter' ? 'floor' : 'counter', items: lines.map(l => ({ item_id: l.id, qty: l.q })) })
      setCart({}); setWho(''); setTableText(''); setNote(''); onSent()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="st-pos">
      <div className="st-pos-menu">
        <div className="st-chips" role="tablist">
          {CATS.map(c => <button key={c.id} role="tab" aria-selected={cat === c.id} onClick={() => setCat(c.id)}>{c.it}</button>)}
        </div>
        <div className="st-tiles">
          {menu.filter(m => m.cat === cat).map(m => (
            <button key={m.id} className="st-tile" disabled={!m.available} onClick={() => add(m.id, 1)}>
              <span className="st-tile-name">{m.name.it}</span>
              <span className="st-tile-price tnum">{m.available ? money(m.price) : 'Esaurito'}</span>
              {cart[m.id] ? <i className="st-badge tnum">{cart[m.id]}</i> : null}
            </button>
          ))}
        </div>
      </div>
      <aside className="st-ticket" aria-label="Comanda in corso">
        <h2 className="st-h3">{table ? `Comanda · ${table}` : 'Nuovo ordine'}</h2>
        <div className="st-fields">
          {!table && <><label htmlFor="pos-table">Tavolo o posto</label>
            <input id="pos-table" value={tableText} onChange={e => setTableText(e.target.value)} placeholder="Tavolo 4" maxLength={30} /></>}
          {!table && <><label htmlFor="pos-who">Nome (facoltativo)</label>
            <input id="pos-who" value={who} onChange={e => setWho(e.target.value)} placeholder="Nome cliente" maxLength={60} /></>}
          <label htmlFor="pos-note">Nota per la cucina</label>
          <input id="pos-note" value={note} onChange={e => setNote(e.target.value)} placeholder="Senza glutine, latte d’avena…" maxLength={300} />
        </div>
        <ul className="st-lines ticket">
          {lines.length === 0 && <li className="st-empty">Tocca i prodotti per aggiungerli.</li>}
          {lines.map(l => (
            <li key={l.id}>
              <span className="grow">{l.m.name.it}</span>
              <span className="st-step"><button aria-label={`Meno ${l.m.name.it}`} onClick={() => add(l.id, -1)}>−</button><b className="tnum">{l.q}</b><button aria-label={`Più ${l.m.name.it}`} onClick={() => add(l.id, 1)}>+</button></span>
              <em className="tnum">{money(l.m.price * l.q)}</em>
            </li>
          ))}
        </ul>
        <div className="st-sum"><span>Totale</span><b className="tnum">{money(total)}</b></div>
        {err && <div className="st-alert inline" role="alert">{err}</div>}
        <div className="st-actions col">
          {mode === 'cashier' && <>
            <button className="st-act" disabled={busy || !lines.length} onClick={() => send('cash')}>Incassa contanti</button>
            <button className="st-act" disabled={busy || !lines.length} onClick={() => send('card')}>Incassa carta</button>
          </>}
          <button className={mode === 'waiter' ? 'st-act' : 'st-act alt'} disabled={busy || !lines.length} onClick={() => send(null)}>{mode === 'waiter' ? 'Invia in cucina' : 'Invia in cucina, paga dopo'}</button>
          {onCancel && <button className="st-back" onClick={onCancel}>Torna ai tavoli</button>}
        </div>
      </aside>
    </div>
  )
}
