import { useEffect, useMemo, useState } from 'react'
import { api, type Order } from '../api'
import type { Closure } from '../api/types'
import { dayKey } from '../backup'
import { Field, money } from './shared'

const toNum = (t: string) => parseFloat(t.replace(',', '.'))
const fmt = (n: number) => (n ? String(n).replace('.', ',') : '')

/** Chiusura di cassa di oggi: confronta i contanti contati con quelli attesi. */
export default function CashClose({ orders, role }: { orders: Order[]; role: 'cashier' | 'owner' }) {
  const day = dayKey(new Date())
  const [saved, setSaved] = useState<Closure | null | undefined>(undefined)
  const [fs, setFs] = useState(''), [counted, setCounted] = useState(''), [fn, setFn] = useState(''), [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)

  const t = useMemo(() => {
    const valid = orders.filter(o => o.status !== 'cancelled')
    const paid = valid.filter(o => o.payment_status === 'paid')
    const sum = (l: Order[]) => Math.round(l.reduce((a, o) => a + o.total, 0) * 100) / 100
    return { cash: sum(paid.filter(o => o.payment_method === 'cash')), card: sum(paid.filter(o => o.payment_method === 'card')), unpaid: valid.filter(o => o.payment_status === 'unpaid'), count: valid.length, cancelled: orders.length - valid.length }
  }, [orders])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const [c, prev] = await Promise.all([api.getClosure(day), api.listClosures(5)])
        if (!alive) return
        setSaved(c)
        const last = prev.find(p => p.day < day)
        if (c) { setFs(fmt(c.float_start)); setCounted(fmt(c.counted_cash)); setFn(fmt(c.float_next)); setNote(c.note || '') } else setFs(fmt(last?.float_next ?? 0))
      } catch (e) { if (alive) { setSaved(null); setErr((e as Error).message) } }
    })()
    return () => { alive = false }
  }, [day])

  const start = toNum(fs || '0'), cnt = toNum(counted), next = toNum(fn || '0')
  const expected = Math.round((start + t.cash) * 100) / 100
  const ready = Number.isFinite(start) && Number.isFinite(cnt) && Number.isFinite(next) && counted.trim() !== ''
  const diff = ready ? Math.round((cnt - expected) * 100) / 100 : 0

  const close = async () => {
    setErr(null)
    if (!ready) return setErr('Inserisci i contanti contati nel cassetto.')
    if (next > cnt) return setErr('Il fondo da lasciare non può superare i contanti contati.')
    if (t.unpaid.length && !confirm(`Ci sono ${t.unpaid.length} ordini non ancora pagati (${money(t.unpaid.reduce((a, o) => a + o.total, 0))}). Chiudere comunque?`)) return
    if (Math.abs(diff) >= 0.01 && !confirm(`C’è una differenza di ${money(diff)}. Confermi la chiusura?`)) return
    setBusy(true)
    try {
      const c: Closure = { day, float_start: start, cash_total: t.cash, card_total: t.card, unpaid_total: Math.round(t.unpaid.reduce((a, o) => a + o.total, 0) * 100) / 100, orders_count: t.count, cancelled_count: t.cancelled, counted_cash: cnt, float_next: next, diff, note: note.trim() || undefined, closed_by: role, closed_at: new Date().toISOString() }
      await api.saveClosure(c); setSaved(c); setEditing(false)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  if (saved === undefined) return <div className="st-pane"><p className="st-hint">Carico…</p></div>
  const done = saved && !editing
  const stat = (label: string, v: string, sub?: string) => <div className="st-stat"><span>{label}</span><b className="tnum">{v}</b>{sub && <small>{sub}</small>}</div>
  return (
    <div className="st-pane">
      <h2 className="st-h2">Chiusura di cassa</h2>
      <div className="st-stats">
        {stat('Contanti incassati', money(t.cash), 'registrati dall’app oggi')}
        {stat('Carta / POS', money(t.card), 'da confrontare con il POS')}
        {stat('Non pagati', money(t.unpaid.reduce((a, o) => a + o.total, 0)), `${t.unpaid.length} ordini`)}
      </div>

      {done ? (
        <section className="st-sheet" aria-live="polite">
          <h3 className="st-h3">Giornata chiusa alle {new Date(saved.closed_at).toTimeString().slice(0, 5)}</h3>
          <div className="st-stats">
            {stat('Atteso nel cassetto', money(saved.float_start + saved.cash_total), `fondo ${money(saved.float_start)} + contanti ${money(saved.cash_total)}`)}
            {stat('Contato', money(saved.counted_cash))}
            {stat('Differenza', `${saved.diff > 0 ? '+' : ''}${money(saved.diff)}`, Math.abs(saved.diff) < 0.01 ? 'quadra' : saved.diff > 0 ? 'in più' : 'mancano')}
            {stat('Da versare / mettere via', money(saved.counted_cash - saved.float_next), `restano ${money(saved.float_next)} di fondo per domani`)}
          </div>
          {saved.note && <p className="st-hint">Nota: {saved.note}</p>}
          <div className="st-actions"><button className="st-act alt" onClick={() => setEditing(true)}>Correggi la chiusura</button></div>
        </section>
      ) : (
        <section className="st-sheet">
          <h3 className="st-h3">Conta il cassetto</h3>
          <div className="st-form">
            <Field label="Fondo cassa a inizio giornata (€)" id="cc-fs" hint="Precompilato con quanto avevi lasciato ieri."><input id="cc-fs" inputMode="decimal" value={fs} onChange={e => setFs(e.target.value)} placeholder="0" /></Field>
            <Field label="Contanti contati ora nel cassetto (€)" id="cc-ct"><input id="cc-ct" inputMode="decimal" value={counted} onChange={e => setCounted(e.target.value)} /></Field>
            <Field label="Fondo da lasciare per domani (€)" id="cc-fn"><input id="cc-fn" inputMode="decimal" value={fn} onChange={e => setFn(e.target.value)} placeholder="0" /></Field>
            <Field label="Nota (facoltativa)" id="cc-nt"><input id="cc-nt" value={note} onChange={e => setNote(e.target.value)} maxLength={200} /></Field>
          </div>
          <div className="st-sum"><span>Atteso: {money(start || 0)} fondo + {money(t.cash)} contanti</span><b className="tnum">{money(expected)}</b></div>
          {ready && <div className={Math.abs(diff) < 0.01 ? 'st-flash' : 'st-alert inline'} role="status" style={Math.abs(diff) < 0.01 ? { position: 'static' } : undefined}>{Math.abs(diff) < 0.01 ? 'La cassa quadra.' : `Differenza: ${diff > 0 ? '+' : ''}${money(diff)} (${diff > 0 ? 'in più' : 'mancano'}).`}</div>}
          {t.unpaid.length > 0 && <div className="st-alert inline" role="status">Ordini ancora da pagare: {t.unpaid.map(o => `#${o.number}`).join(', ')}.</div>}
          {err && <div className="st-alert inline" role="alert">{err}</div>}
          <div className="st-actions">
            <button className="st-act" disabled={busy || !ready} onClick={() => void close()}>{busy ? 'Salvo…' : 'Chiudi la giornata'}</button>
            {editing && <button className="st-act alt" onClick={() => setEditing(false)}>Annulla</button>}
          </div>
          <p className="st-hint">Questa chiusura è un controllo interno: non sostituisce la chiusura fiscale giornaliera del registratore telematico.</p>
        </section>
      )}
    </div>
  )
}
