import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { Order } from '../api/types'
import { SOURCE, STATUS, dayKey, downloadCsv, downloadFullBackup, lastBackup, ordersCsv, restoreBackup } from '../backup'
import { Field, money } from './shared'

const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return dayKey(d) }
const startOf = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }

export default function BackupTab() {
  const [from, setFrom] = useState(daysAgo(6)), [to, setTo] = useState(dayKey(new Date()))
  const [q, setQ] = useState('')
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState(lastBackup())

  useEffect(() => {
    let alive = true
    setOrders(null)
    const end = startOf(to); end.setDate(end.getDate() + 1)
    api.listOrdersSince(startOf(from), end).then(o => alive && setOrders(o)).catch(e => alive && setMsg({ ok: false, t: (e as Error).message }))
    return () => { alive = false }
  }, [from, to])

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return [...(orders || [])].reverse().filter(o => !t || String(o.number) === t || o.customer_name.toLowerCase().includes(t) || (o.table_label || '').toLowerCase().includes(t) || o.items.some(i => i.name.toLowerCase().includes(t)))
  }, [orders, q])
  const total = shown.filter(o => o.status !== 'cancelled').reduce((a, o) => a + o.total, 0)
  const days = last ? Math.floor((Date.now() - last.getTime()) / 86400000) : null

  const run = async (f: () => Promise<string>) => { setBusy(true); setMsg(null); try { setMsg({ ok: true, t: await f() }) } catch (e) { setMsg({ ok: false, t: (e as Error).message }) } finally { setBusy(false) } }
  const backup = () => run(async () => { const r = await downloadFullBackup(); setLast(lastBackup()); return `Backup scaricato: ${r.orders} ordini, ${r.menu} prodotti, ${r.ingredients} ingredienti. Conservalo fuori da questo dispositivo (cloud, chiavetta, email).` })
  const restore = (f?: File) => f && run(async () => {
    if (!confirm('Ripristinare da questo backup? Menu, prezzi, servizi, impostazioni, contenuti, ricette, costi, personale e turni verranno sostituiti con quelli del file. Ordini e giacenze non cambiano.')) return 'Ripristino annullato.'
    const r = await restoreBackup(await f.text()); return `Ripristinati ${r.menu} prodotti, ${r.recipes} ricette, ${r.ingredients} ingredienti.`
  })
  const exportMenu = () => run(async () => {
    const c = await api.getCatalog()
    downloadCsv(`menu-${dayKey(new Date())}.csv`, ['Categoria', 'Nome IT', 'Nome EN', 'Prezzo €', 'Vegano', 'Disponibile', 'Visibile'], c.menu.map(m => [m.cat, m.name.it, m.name.en, m.price, m.vg ? 'sì' : 'no', m.available ? 'sì' : 'no', m.visible ? 'sì' : 'no']))
    return 'Menu esportato.'
  })
  const exportStock = () => run(async () => {
    const b = await api.getBackoffice(), mv = await api.listAllMoves(), name = new Map(b.ingredients.map(i => [i.id, i.name]))
    downloadCsv(`scorte-${dayKey(new Date())}.csv`, ['Ingrediente', 'Unità', 'Giacenza', 'Soglia', 'Confezione', 'Prezzo confezione €', 'Fornitore'], b.ingredients.map(i => [i.name, i.unit, i.stock, i.min_stock, i.pack_qty, i.pack_price, i.supplier]))
    downloadCsv(`movimenti-scorte-${dayKey(new Date())}.csv`, ['Data', 'Ora', 'Ingrediente', 'Motivo', 'Variazione', 'Nota'], mv.map(m => { const d = new Date(m.at); return [dayKey(d), d.toTimeString().slice(0, 5), name.get(m.ingredient_id) || m.ingredient_id, m.reason, m.delta, m.note] }))
    return 'Scorte e movimenti esportati (due file).'
  })

  return (
    <div className="st-pane">
      <section className="st-sheet">
        <h2 className="st-h3">Backup dei dati</h2>
        {days === null || days > 7
          ? <div className="st-alert inline" role="status">{days === null ? 'Non hai ancora fatto nessun backup su questo dispositivo.' : `Ultimo backup ${days} giorni fa.`} Ne consiglio uno a settimana.</div>
          : <p className="st-hint">Ultimo backup: {last!.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} ({days === 0 ? 'oggi' : `${days} giorni fa`}).</p>}
        <div className="st-actions">
          <button className="st-act" disabled={busy} onClick={() => void backup()}>{busy ? 'Attendi…' : 'Scarica backup completo'}</button>
          <label className="st-act alt" style={{ cursor: 'pointer' }}>Ripristina da file<input type="file" accept="application/json,.json" hidden onChange={e => { void restore(e.target.files?.[0]); e.target.value = '' }} /></label>
        </div>
        <p className="st-hint">Il backup è un unico file con menu, servizi, impostazioni, contenuti, ricette, costi, scorte, personale e turni e tutti gli ordini. Il ripristino riporta menu, ricette, impostazioni, personale e turni; ordini e giacenze restano come sono.</p>
        {msg && <div className={msg.ok ? 'st-flash' : 'st-alert inline'} role={msg.ok ? 'status' : 'alert'} style={msg.ok ? { position: 'static' } : undefined}>{msg.t}</div>}
        <div className="st-actions">
          <button className="st-ghost" disabled={busy} onClick={() => void exportMenu()}>Menu in Excel (CSV)</button>
          <button className="st-ghost" disabled={busy} onClick={() => void exportStock()}>Scorte e movimenti (CSV)</button>
        </div>
      </section>

      <section className="st-sheet">
        <h2 className="st-h3">Storico ordini</h2>
        <div className="st-form">
          <Field label="Dal" id="h-from"><input id="h-from" type="date" value={from} max={to} onChange={e => e.target.value && setFrom(e.target.value)} /></Field>
          <Field label="Al" id="h-to"><input id="h-to" type="date" value={to} min={from} max={dayKey(new Date())} onChange={e => e.target.value && setTo(e.target.value)} /></Field>
          <Field label="Cerca (numero, nome, tavolo, prodotto)" id="h-q"><input id="h-q" value={q} onChange={e => setQ(e.target.value)} /></Field>
        </div>
        <div className="st-chips" role="group" aria-label="Periodi rapidi">
          <button onClick={() => { setFrom(dayKey(new Date())); setTo(dayKey(new Date())) }}>Oggi</button>
          <button onClick={() => { setFrom(daysAgo(6)); setTo(dayKey(new Date())) }}>7 giorni</button>
          <button onClick={() => { setFrom(daysAgo(29)); setTo(dayKey(new Date())) }}>30 giorni</button>
          <button onClick={() => { const d = new Date(); setFrom(dayKey(new Date(d.getFullYear(), d.getMonth(), 1))); setTo(dayKey(d)) }}>Questo mese</button>
        </div>
        {orders === null ? <p className="st-hint">Carico…</p> : (
          <>
            <div className="st-sum"><span>{shown.length} ordini{shown.some(o => o.status === 'cancelled') ? ' (annullati esclusi dal totale)' : ''}</span><b className="tnum">{money(total)}</b></div>
            <ul className="st-rows">
              {shown.length === 0 && <li className="st-empty">Nessun ordine in questo periodo.</li>}
              {shown.slice(0, 150).map(o => {
                const d = new Date(o.created_at)
                return (
                  <li key={o.id} className="st-row" style={{ flexWrap: 'wrap' }}>
                    <button className="st-row-main" style={{ textAlign: 'left', background: 'none', border: 0, cursor: 'pointer', color: 'inherit' }} aria-expanded={open === o.id} onClick={() => setOpen(open === o.id ? null : o.id)}>
                      <div className="st-row-title">#{o.number} · {o.customer_name || SOURCE[o.source]}<small>{d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} {d.toTimeString().slice(0, 5)} · {SOURCE[o.source]}{o.table_label ? ` · ${o.table_label}` : ''} · {STATUS[o.status] ?? o.status} · {o.payment_status === 'paid' ? (o.payment_method === 'cash' ? 'contanti' : o.payment_method === 'card' ? 'carta' : 'pagato') : 'da pagare'}</small></div>
                    </button>
                    <b className="tnum st-row-price">{money(o.total)}</b>
                    {open === o.id && <div style={{ flexBasis: '100%', fontSize: 14, padding: '4px 0 8px' }}>{o.items.map(i => <div key={i.item_id}>{i.qty}× {i.name} <span className="tnum" style={{ float: 'right' }}>{money(i.qty * i.unit_price)}</span></div>)}{o.note && <div className="st-hint">Nota: {o.note}</div>}</div>}
                  </li>
                )
              })}
            </ul>
            {shown.length > 150 && <p className="st-hint">Mostrati i primi 150: restringi il periodo o scarica il CSV per averli tutti.</p>}
            <div className="st-actions"><button className="st-act alt" disabled={!shown.length} onClick={() => { const c = ordersCsv([...shown].reverse()); downloadCsv(`ordini-${from}_${to}.csv`, c.head, c.rows) }}>Scarica questi ordini (CSV)</button></div>
          </>
        )}
      </section>
    </div>
  )
}
