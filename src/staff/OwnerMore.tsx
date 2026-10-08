import { useEffect, useMemo, useState } from 'react'
import { api, type Catalog, type Order, type Settings } from '../api'
import { sortMenu, DAY_NAMES } from '../catalog'
import { Field, Switch, money } from './shared'

type Save = (f: () => Promise<void>, ok?: string) => Promise<boolean>
const WEEK = [1, 2, 3, 4, 5, 6, 0] // lunedì → domenica

/* ---------- orari e impostazioni ---------- */
export function SettingsTab({ catalog, save }: { catalog: Catalog; save: Save }) {
  const base = catalog.settings
  const [s, setS] = useState<Settings>(base)
  const [slot, setSlot] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const baseKey = JSON.stringify(base)
  useEffect(() => { setS(base) }, [baseKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(s) !== baseKey
  const menu = sortMenu(catalog.menu.filter(m => m.visible))

  const toggleDay = (d: number) => setS(o => ({ ...o, open_days: o.open_days.includes(d) ? o.open_days.filter(x => x !== d) : [...o.open_days, d] }))
  const addSlot = () => {
    if (!/^\d{2}:\d{2}$/.test(slot)) return
    setS(o => ({ ...o, slots: [...new Set([...o.slots, slot])].sort() })); setSlot('')
  }
  const toggleFeatured = (id: string) => setS(o => {
    const has = o.featured.includes(id)
    return { ...o, featured: has ? o.featured.filter(x => x !== id) : o.featured.length >= 4 ? o.featured : [...o.featured, id] }
  })
  const submit = async () => {
    if (s.open_time >= s.close_time) return setErr('L’orario di apertura deve essere prima della chiusura.')
    if (!s.slots.length) return setErr('Serve almeno una fascia di ritiro.')
    if (!Number.isInteger(s.tables) || s.tables < 1 || s.tables > 60) return setErr('Il numero di tavoli deve essere tra 1 e 60.')
    setErr(null)
    await save(() => api.saveSettings(s))
  }
  return (
    <div className="st-pane">
      <section className="st-sheet flat">
        <h2 className="st-h3">Orari di apertura</h2>
        <div className="st-chips" role="group" aria-label="Giorni di apertura">
          {WEEK.map(d => <button key={d} aria-pressed={s.open_days.includes(d)} className="st-daybtn" onClick={() => toggleDay(d)}>{DAY_NAMES.it[d]}</button>)}
        </div>
        <div className="st-form two">
          <Field label="Apre alle" id="o-open"><input id="o-open" type="time" value={s.open_time} onChange={e => setS({ ...s, open_time: e.target.value })} /></Field>
          <Field label="Chiude alle" id="o-close"><input id="o-close" type="time" value={s.close_time} onChange={e => setS({ ...s, close_time: e.target.value })} /></Field>
        </div>
      </section>

      <section className="st-sheet flat">
        <h2 className="st-h3">Fasce di ritiro (asporto)</h2>
        <div className="st-chips">
          {s.slots.map(x => <span key={x} className="st-chip-x tnum">{x}<button aria-label={`Rimuovi ${x}`} onClick={() => setS(o => ({ ...o, slots: o.slots.filter(y => y !== x) }))}>✕</button></span>)}
        </div>
        <div className="st-rowline">
          <input aria-label="Nuova fascia" type="time" value={slot} onChange={e => setSlot(e.target.value)} className="st-input-sm" />
          <button className="st-ghost" onClick={addSlot}>Aggiungi fascia</button>
        </div>
      </section>

      <section className="st-sheet flat">
        <h2 className="st-h3">Sala</h2>
        <div className="st-form two"><Field label="Numero di tavoli" id="o-tables"><input id="o-tables" type="number" min={1} max={60} value={s.tables} onChange={e => setS({ ...s, tables: Number(e.target.value) })} /></Field></div>
      </section>

      <section className="st-sheet flat">
        <h2 className="st-h3">In home</h2>
        <div className="st-form">
          <Field label="Consiglio del giorno (italiano)" id="o-b-it" hint="Firmato Mr. Hawkins nell’app."><textarea id="o-b-it" rows={2} value={s.butler.it} onChange={e => setS({ ...s, butler: { ...s.butler, it: e.target.value } })} maxLength={200} /></Field>
          <Field label="Consiglio del giorno (inglese)" id="o-b-en"><textarea id="o-b-en" rows={2} value={s.butler.en} onChange={e => setS({ ...s, butler: { ...s.butler, en: e.target.value } })} maxLength={200} /></Field>
        </div>
        <div className="st-sub" style={{ margin: '4px 0' }}>Oggi in dispensa (fino a 4 prodotti, selezionati: {s.featured.length})</div>
        <div className="st-checks">
          {menu.map(m => <Switch key={m.id} on={s.featured.includes(m.id)} onChange={() => toggleFeatured(m.id)} label={m.name.it} />)}
        </div>
      </section>

      {err && <div className="st-alert inline" role="alert">{err}</div>}
      <div className="st-actions" style={{ position: 'sticky', bottom: 0, background: 'var(--color-bg)', padding: '10px 0' }}>
        <button className="st-act" disabled={!dirty} onClick={submit}>Salva modifiche</button>
        <button className="st-act alt" disabled={!dirty} onClick={() => setS(base)}>Annulla</button>
      </div>
    </div>
  )
}

/* ---------- vendite ---------- */
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const niceMax = (v: number) => { for (const s of [10, 20, 40, 50, 100, 200, 400, 500, 1000, 2000, 5000, 10000]) if (v <= s) return s; return Math.ceil(v / 1000) * 1000 }

export function SalesTab() {
  const [days, setDays] = useState(14)
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    const from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - (days - 1))
    setOrders(null)
    api.listOrdersSince(from).then(o => alive && setOrders(o)).catch(e => alive && setErr((e as Error).message))
    return () => { alive = false }
  }, [days])

  const data = useMemo(() => {
    const valid = (orders || []).filter(o => o.status !== 'cancelled')
    const series = Array.from({ length: days }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (days - 1 - i)); return { d, key: dayKey(d), rev: 0, n: 0 } })
    const idx = new Map(series.map((x, i) => [x.key, i]))
    valid.forEach(o => { const i = idx.get(dayKey(new Date(o.created_at))); if (i !== undefined) { series[i].rev += o.total; series[i].n += 1 } })
    const sold = new Map<string, { name: string; qty: number; rev: number }>()
    valid.forEach(o => o.items.forEach(it => { const e = sold.get(it.item_id) || { name: it.name, qty: 0, rev: 0 }; e.qty += it.qty; e.rev += it.qty * it.unit_price; sold.set(it.item_id, e) }))
    const rev = valid.reduce((a, o) => a + o.total, 0)
    return { valid, series, rev, products: [...sold.values()].sort((a, b) => b.rev - a.rev), app: valid.filter(o => o.source === 'app').length, floor: valid.filter(o => o.source === 'floor').length, counter: valid.filter(o => o.source === 'counter').length }
  }, [orders, days])

  const exportCsv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const rows = [['data', 'ora', 'numero', 'origine', 'tavolo', 'cliente', 'stato', 'pagamento', 'totale', 'prodotti'].join(',')]
    ;(orders || []).forEach(o => {
      const d = new Date(o.created_at)
      rows.push([dayKey(d), d.toTimeString().slice(0, 5), o.number, o.source, o.table_label || '', o.customer_name, o.status, o.payment_status === 'paid' ? (o.payment_method || 'pagato') : 'da pagare', o.total.toFixed(2), o.items.map(i => `${i.qty}x ${i.name}`).join(' + ')].map(esc).join(','))
    })
    const url = URL.createObjectURL(new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `vendite-${dayKey(new Date())}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  // grafico
  const W = 640, H = 230, ML = 46, MR = 8, MT = 12, MB = 30
  const max = niceMax(Math.max(1, ...data.series.map(x => x.rev)))
  const pw = W - ML - MR, ph = H - MT - MB, slotW = pw / days, bw = Math.max(4, Math.min(34, slotW * 0.62))
  const y = (v: number) => MT + ph - (v / max) * ph
  const every = Math.ceil(days / 8)
  const fmtDay = (d: Date) => d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
  const h = hover !== null ? data.series[hover] : null

  return (
    <div className="st-pane">
      <div className="st-rowline" style={{ justifyContent: 'space-between' }}>
        <div className="st-chips" role="group" aria-label="Periodo">
          {[7, 14, 30].map(n => <button key={n} aria-pressed={days === n} className="st-daybtn" onClick={() => setDays(n)}>{n} giorni</button>)}
        </div>
        <button className="st-ghost" onClick={exportCsv} disabled={!orders?.length}>Esporta CSV</button>
      </div>
      {err && <div className="st-alert" role="alert">{err}</div>}
      {!orders && !err && <p className="st-hint">Caricamento…</p>}
      {orders && (
        <>
          <div className="st-stats">
            <div className="st-stat"><span>Ricavi</span><b className="tnum">{money(data.rev)}</b><small>ultimi {days} giorni</small></div>
            <div className="st-stat"><span>Ordini</span><b className="tnum">{data.valid.length}</b><small>{data.app} app · {data.floor} sala · {data.counter} banco</small></div>
            <div className="st-stat"><span>Scontrino medio</span><b className="tnum">{money(data.valid.length ? data.rev / data.valid.length : 0)}</b></div>
          </div>

          <section aria-label="Ricavi per giorno">
            <div className="st-chart-head">
              <h2 className="st-h3">Ricavi per giorno</h2>
              <div className="st-readout tnum" aria-live="polite">{h ? `${fmtDay(h.d)} · ${money(h.rev)} · ${h.n} ordini` : 'Passa su una barra per il dettaglio'}</div>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="st-chart" role="img" aria-label={`Ricavi giornalieri degli ultimi ${days} giorni, totale ${money(data.rev)}`}>
              {[0, 1, 2, 3, 4].map(i => { const v = (max / 4) * i; return (
                <g key={i}>
                  <line x1={ML} x2={W - MR} y1={y(v)} y2={y(v)} className={i === 0 ? 'axis' : 'grid'} />
                  <text x={ML - 6} y={y(v) + 4} textAnchor="end" className="tick tnum">{Math.round(v)}</text>
                </g>
              ) })}
              {data.series.map((x, i) => {
                const cx = ML + slotW * i + slotW / 2, top = y(x.rev), r = Math.min(4, bw / 2)
                return (
                  <g key={x.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${fmtDay(x.d)}: ${money(x.rev)}, ${x.n} ordini`}>
                    <rect x={ML + slotW * i} y={MT} width={slotW} height={ph} fill="transparent" />
                    {x.rev > 0 && <path className={`bar ${hover === i ? 'on' : ''}`} d={`M${cx - bw / 2},${y(0)} V${top + r} Q${cx - bw / 2},${top} ${cx - bw / 2 + r},${top} H${cx + bw / 2 - r} Q${cx + bw / 2},${top} ${cx + bw / 2},${top + r} V${y(0)} Z`} />}
                    {(i % every === 0 || i === days - 1) && <text x={cx} y={H - 9} textAnchor="middle" className="tick tnum">{x.d.getDate()}/{x.d.getMonth() + 1}</text>}
                  </g>
                )
              })}
              <text x={ML} y={9} className="tick">€</text>
            </svg>
          </section>

          <section>
            <h2 className="st-h3">Prodotti più venduti</h2>
            {data.products.length === 0 ? <div className="st-empty">Ancora nessuna vendita nel periodo.</div> : (
              <div className="st-tablewrap"><table className="st-table">
                <thead><tr><th>Prodotto</th><th className="r">Quantità</th><th className="r">Ricavi</th></tr></thead>
                <tbody>{data.products.slice(0, 15).map(p => <tr key={p.name}><td>{p.name}</td><td className="r tnum">{p.qty}</td><td className="r tnum">{money(p.rev)}</td></tr>)}</tbody>
              </table></div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
