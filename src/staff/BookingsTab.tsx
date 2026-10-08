import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import type { Booking, BookingStatus } from '../api/types'
import { KIND_LABEL, STATUS_LABEL, isoDay } from '../booking'
import { useCatalog } from '../catalog'
import { Field } from './shared'

/** Prenotazioni da oggi ai prossimi 90 giorni, aggiornate in tempo reale. */
export function useBookings(onNew?: (fresh: Booking[]) => void) {
  const [list, setList] = useState<Booking[]>([])
  const seen = useRef<Set<string> | null>(null)
  const cb = useRef(onNew); cb.current = onNew
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    try {
      const a = new Date(), b = new Date(); b.setDate(b.getDate() + 90)
      const next = await api.listBookings(isoDay(a), isoDay(b)); setList(next); setError(null)
      const pend = next.filter(x => x.status === 'pending')
      if (seen.current) { const fresh = pend.filter(x => !seen.current!.has(x.id)); if (fresh.length) cb.current?.(fresh) }
      seen.current = new Set(pend.map(x => x.id))
    } catch (e) { setError((e as Error).message) }
  }, [])
  useEffect(() => {
    void load(); const off = api.subscribe(() => void load()); const t = setInterval(() => void load(), 15000)
    return () => { off(); clearInterval(t) }
  }, [load])
  return { list, error, reload: load, pending: list.filter(b => b.status === 'pending').length }
}

const PILL: Record<BookingStatus, string> = { pending: 'unpaid', confirmed: '', declined: '', cancelled: '', seated: 'paid', noshow: '' }

export default function BookingsTab({ bookings }: { bookings: ReturnType<typeof useBookings> }) {
  const { catalog } = useCatalog()
  const { list, reload, error } = bookings
  const today = isoDay(new Date())
  const [day, setDay] = useState(today)
  const [err, setErr] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const svcName = (k: string) => KIND_LABEL[k] ?? catalog.services.find(s => s.id === k)?.title.it ?? k
  const act = async (f: () => Promise<void>) => { try { setErr(null); await f(); await reload() } catch (e) { setErr((e as Error).message) } }

  const pendingAll = list.filter(b => b.status === 'pending')
  const ofDay = useMemo(() => list.filter(b => b.day === day), [list, day])
  const covers = ofDay.filter(b => ['pending', 'confirmed', 'seated'].includes(b.status) && b.time).reduce((a, b) => a + b.party, 0)
  const shift = (n: number) => { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + n); setDay(isoDay(d)) }
  const fmt = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })

  const card = (b: Booking, showDay = false) => (
    <li key={b.id} className="st-card" style={{ opacity: ['cancelled', 'declined', 'noshow'].includes(b.status) ? 0.6 : 1 }}>
      <div className="st-rowline" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <b className="tnum" style={{ fontSize: 22 }}>{showDay ? `${fmt(b.day)} · ` : ''}{b.time ?? 'richiesta'}</b>
        <span className={`st-pill ${PILL[b.status]}`}>{STATUS_LABEL[b.status].it}</span>
      </div>
      <div style={{ fontSize: 17 }}><b>{b.name}</b> · {b.party} {b.party === 1 ? 'persona' : 'persone'} · {svcName(b.kind)}{b.source === 'staff' ? ' · telefono' : ''}</div>
      {b.phone && <div><a href={`tel:${b.phone.replace(/\s/g, '')}`}>{b.phone}</a></div>}
      {b.note && <div className="st-hint">Nota: {b.note}</div>}
      <div className="st-rowline" style={{ flexWrap: 'wrap' }}>
        {b.time && ['confirmed', 'seated', 'pending'].includes(b.status) && (
          <select aria-label="Tavolo" value={b.table_label ?? ''} onChange={e => void act(() => api.setBookingStatus(b.id, b.status, e.target.value || null))} style={{ minHeight: 44, fontSize: 15 }}>
            <option value="">Tavolo…</option>
            {Array.from({ length: catalog.settings.tables }, (_, i) => <option key={i} value={`Tavolo ${i + 1}`}>Tavolo {i + 1}</option>)}
          </select>
        )}
        {b.status === 'pending' && <><button className="st-act" onClick={() => void act(() => api.setBookingStatus(b.id, 'confirmed'))}>Conferma</button><button className="st-act alt" onClick={() => void act(() => api.setBookingStatus(b.id, 'declined'))}>Rifiuta</button></>}
        {b.status === 'confirmed' && <>
          {b.time && <button className="st-act" onClick={() => void act(() => api.setBookingStatus(b.id, 'seated'))}>Arrivati</button>}
          <button className="st-act alt" onClick={() => void act(() => api.setBookingStatus(b.id, 'noshow'))}>Non si è presentato</button>
          <button className="st-ghost" onClick={() => { if (confirm('Annullare questa prenotazione?')) void act(() => api.setBookingStatus(b.id, 'cancelled')) }}>Annulla</button>
        </>}
        {['cancelled', 'declined', 'noshow'].includes(b.status) && <button className="st-ghost" onClick={() => void act(() => api.setBookingStatus(b.id, 'confirmed'))}>Rimetti confermata</button>}
      </div>
    </li>
  )

  return (
    <div className="st-pane">
      {(err || error) && <div className="st-alert inline" role="alert">{err || error}</div>}
      {pendingAll.length > 0 && (
        <section className="st-sheet">
          <h2 className="st-h3">Da confermare ({pendingAll.length})</h2>
          <ul className="st-rows" style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>{pendingAll.map(b => card(b, true))}</ul>
        </section>
      )}
      <div className="st-rowline" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div className="st-rowline">
          <button className="st-ghost" aria-label="Giorno prima" onClick={() => shift(-1)}>←</button>
          <input type="date" aria-label="Giorno" value={day} onChange={e => e.target.value && setDay(e.target.value)} style={{ minHeight: 44, fontSize: 16 }} />
          <button className="st-ghost" aria-label="Giorno dopo" onClick={() => shift(1)}>→</button>
          {day !== today && <button className="st-ghost" onClick={() => setDay(today)}>Oggi</button>}
        </div>
        <button className="st-act" style={{ minHeight: 44, fontSize: 16 }} onClick={() => setAdding(a => !a)}>{adding ? 'Chiudi' : 'Nuova prenotazione'}</button>
      </div>
      {adding && <NewBooking day={day} slots={catalog.booking.slots} onDone={async () => { setAdding(false); await reload() }} />}
      <div className="st-sum"><span>{fmt(day)} · {ofDay.length} prenotazioni</span><b className="tnum">{covers} coperti</b></div>
      <ul className="st-rows" style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {ofDay.length === 0 && <li className="st-empty">Nessuna prenotazione per questo giorno.</li>}
        {ofDay.map(b => card(b))}
      </ul>
    </div>
  )
}

function NewBooking({ day, slots, onDone }: { day: string; slots: string[]; onDone: () => void }) {
  const [kind, setKind] = useState('table'), [d, setD] = useState(day), [time, setTime] = useState(slots[0] ?? '12:00'), [party, setParty] = useState('2')
  const [name, setName] = useState(''), [phone, setPhone] = useState(''), [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const submit = async () => {
    const n = parseInt(party, 10)
    if (!name.trim()) return setErr('Scrivi il nome.')
    if (!(n >= 1 && n <= 60)) return setErr('Numero di persone non valido.')
    try { await api.createStaffBooking({ kind, day: d, time, party: n, name, phone, note }); onDone() } catch (e) { setErr((e as Error).message) }
  }
  return (
    <section className="st-sheet" aria-label="Nuova prenotazione">
      <h3 className="st-h3">Nuova prenotazione (telefono / banco)</h3>
      <div className="st-form">
        <Field label="Tipo" id="nb-k"><select id="nb-k" value={kind} onChange={e => setKind(e.target.value)}><option value="table">Tavolo</option><option value="tea">Afternoon tea</option></select></Field>
        <Field label="Giorno" id="nb-d"><input id="nb-d" type="date" value={d} onChange={e => setD(e.target.value)} /></Field>
        <Field label="Orario" id="nb-t"><select id="nb-t" value={time} onChange={e => setTime(e.target.value)}>{slots.map(s => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Persone" id="nb-p"><input id="nb-p" inputMode="numeric" value={party} onChange={e => setParty(e.target.value.replace(/\D/g, ''))} /></Field>
        <Field label="Nome" id="nb-n"><input id="nb-n" value={name} onChange={e => setName(e.target.value)} maxLength={60} /></Field>
        <Field label="Telefono" id="nb-ph"><input id="nb-ph" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} maxLength={30} /></Field>
        <Field label="Note" id="nb-nt"><input id="nb-nt" value={note} onChange={e => setNote(e.target.value)} maxLength={300} /></Field>
      </div>
      {err && <div className="st-alert inline" role="alert">{err}</div>}
      <div className="st-actions"><button className="st-act" onClick={() => void submit()}>Salva</button></div>
    </section>
  )
}
