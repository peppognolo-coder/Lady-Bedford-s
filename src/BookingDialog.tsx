import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { api } from './api'
import type { BookingConfig, BookingPublic, Catalog } from './api/types'
import { KIND_LABEL, MODE_LABEL, STATUS_LABEL, isoDay, modeFor } from './booking'

type Lang = 'it' | 'en'
const TXT = {
  it: { book: 'Prenota', request: 'Richiesta', table: 'Un tavolo', tea: 'Afternoon tea', day: 'Giorno', time: 'Orario', guests: 'Ospiti', name: 'Il tuo nome', phone: 'Telefono (per confermare)', note: 'Note (allergie, ricorrenze…)', send: 'Prenota', sendReq: 'Invia la richiesta', close: 'Chiudi', full: 'completo', left: 'posti', closed: 'Chiusi', none: 'Nessun orario disponibile per questa data.',
    freeMsg: 'In questa data non serve prenotare: vieni pure, ti aspettiamo.', confirmed: 'Prenotazione confermata', pending: 'Richiesta ricevuta', ref: 'Codice', keep: 'Conserva il codice: lo staff può cercarti da qui.', pendMsg: 'Ti confermiamo appena possibile. Puoi controllare lo stato qui sotto o nella home.', cancel: 'Annulla la prenotazione', cancelled: 'Prenotazione annullata.', mine: 'La tua prenotazione', more: 'Altre date', today: 'Oggi', dows: ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'], reqNote: 'Ti rispondiamo entro oggi per confermare.', bigger: 'Per gruppi più grandi chiamaci.' },
  en: { book: 'Book', request: 'Request', table: 'A table', tea: 'Afternoon tea', day: 'Day', time: 'Time', guests: 'Guests', name: 'Your name', phone: 'Phone (to confirm)', note: 'Notes (allergies, occasions…)', send: 'Book', sendReq: 'Send request', close: 'Close', full: 'full', left: 'seats', closed: 'Closed', none: 'No times available on this date.',
    freeMsg: 'No booking needed on this date: just drop in, we’ll be glad to see you.', confirmed: 'Booking confirmed', pending: 'Request received', ref: 'Code', keep: 'Keep the code: our staff can find you with it.', pendMsg: 'We’ll confirm as soon as possible. Check the status below or on the home page.', cancel: 'Cancel booking', cancelled: 'Booking cancelled.', mine: 'Your booking', more: 'More dates', today: 'Today', dows: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], reqNote: 'We’ll reply today to confirm.', bigger: 'For larger groups please call us.' },
}
const KEY = 'lb:booking'
export const savedBookingId = (): string | null => { try { return localStorage.getItem(KEY) } catch { return null } }
const saveId = (id: string | null) => { try { id ? localStorage.setItem(KEY, id) : localStorage.removeItem(KEY) } catch { /* ignore */ } }

const field: CSSProperties = { width: '100%', boxSizing: 'border-box', height: 46, padding: '0 12px', fontSize: 16, border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--color-text)', font: 'inherit' }
const dayLabel = (day: string, lang: Lang) => new Date(day + 'T12:00:00').toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

/** Stato e annullamento della propria prenotazione (home dell'app). */
export function MyBooking({ lang }: { lang: Lang }) {
  const t = TXT[lang]
  const [b, setB] = useState<BookingPublic | null>(null)
  useEffect(() => {
    const id = savedBookingId(); if (!id) return
    api.bookingStatus(id).then(r => { if (r && r.day >= isoDay(new Date()) && !['cancelled', 'declined', 'noshow'].includes(r.status)) setB(r); else saveId(null) }).catch(() => undefined)
  }, [])
  if (!b) return null
  return (
    <div style={{ border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-md)', padding: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="kicker">{t.mine} · {STATUS_LABEL[b.status]?.[lang]}</div>
      <div className="h-serif" style={{ fontWeight: 600, fontSize: 18 }}>{lang === 'it' ? KIND_LABEL[b.kind] ?? b.kind : b.kind === 'table' ? 'Table' : b.kind === 'tea' ? 'Afternoon tea' : b.kind} · {b.party}</div>
      <div style={{ fontSize: 13 }}>{dayLabel(b.day, lang)}{b.time ? ` · ${b.time}` : ''}{b.table_label ? ` · ${b.table_label}` : ''}</div>
      <button className="link" style={{ alignSelf: 'flex-start', fontSize: 12, marginTop: 4 }} onClick={async () => { try { await api.cancelBooking(b.id) } catch { /* ignore */ } saveId(null); setB(null) }}>{t.cancel}</button>
    </div>
  )
}

export default function BookingDialog({ kind, svcTitle, catalog, lang, onClose }: { kind: string; svcTitle?: string; catalog: Catalog; lang: Lang; onClose: () => void }) {
  const t = TXT[lang]
  const cfg: BookingConfig = catalog.booking
  const isSlot = kind === 'table' || kind === 'tea'
  const openDays = catalog.settings.open_days
  const todayStr = isoDay(new Date())
  const days = useMemo(() => Array.from({ length: Math.min(cfg.advance_days, 60) + 1 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return { iso: isoDay(d), d, open: openDays.includes(d.getDay()) } }), [cfg.advance_days, openDays])
  const nm = new Date().getHours() * 60 + new Date().getMinutes()
  const todayHasSlots = !isSlot || cfg.slots.some(s => Number(s.slice(0, 2)) * 60 + Number(s.slice(3)) >= nm + cfg.min_notice_h * 60)
  const first = days.find(x => x.open && (!isSlot || modeFor(cfg, x.iso).mode !== 'free') && (x.iso !== todayStr || todayHasSlots))?.iso ?? days[0].iso
  const [day, setDay] = useState(first)
  const [party, setParty] = useState(2)
  const [time, setTime] = useState<string | null>(null)
  const [left, setLeft] = useState<Record<string, number> | null>(null)
  const [name, setName] = useState(''), [phone, setPhone] = useState(''), [note, setNote] = useState('')
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<BookingPublic | null>(null)

  const mode = modeFor(cfg, day)
  const free = isSlot && mode.mode === 'free'
  useEffect(() => {
    if (!isSlot || free) { setLeft(null); return }
    let alive = true; setLeft(null); setTime(null)
    api.bookingAvailability(day).then(r => alive && setLeft(r)).catch(() => alive && setLeft({}))
    return () => { alive = false }
  }, [day, isSlot, free])
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const slotOk = (s: string) => !(day === todayStr && Number(s.slice(0, 2)) * 60 + Number(s.slice(3)) < nowMin + cfg.min_notice_h * 60)
  const submit = async () => {
    setErr(null)
    if (!name.trim()) return setErr(lang === 'it' ? 'Scrivi il tuo nome.' : 'Please enter your name.')
    if (isSlot && !time) return setErr(lang === 'it' ? 'Scegli un orario.' : 'Please pick a time.')
    setBusy(true)
    try { const r = await api.placeBooking({ kind, day, time: isSlot ? time : null, party, name: name.trim(), phone: phone.trim() || undefined, note: note.trim() || undefined }); saveId(r.id); setDone(r) }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const title = isSlot ? (kind === 'tea' ? t.tea : t.table) : svcTitle || kind
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'color-mix(in srgb, var(--color-neutral-900) 45%, transparent)', display: 'flex', alignItems: 'flex-end' }}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()} className="fade" style={{ width: '100%', maxHeight: '92%', overflowY: 'auto', background: 'var(--color-bg)', borderRadius: '22px 22px 0 0', padding: '22px 22px 28px', display: 'flex', flexDirection: 'column', gap: 16, boxShadow: 'var(--shadow-lg)' }}>
        {done ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 0' }}>
            <div className="kicker">{done.status === 'confirmed' ? t.confirmed : t.pending}</div>
            <div className="h-serif" style={{ fontStyle: 'italic', fontSize: 21, lineHeight: 1.3 }}>{title} · {done.party}<br />{dayLabel(done.day, lang)}{done.time ? ` · ${done.time}` : ''}</div>
            <div className="tnum" style={{ fontSize: 13 }}>{t.ref}: <b>{done.ref}</b></div>
            <div style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{isSlot ? (done.status === 'confirmed' ? t.keep : t.pendMsg) : t.reqNote}</div>
            <button className="btn-o sm" style={{ height: 46, fontSize: 16, marginTop: 6 }} onClick={onClose}>{t.close}</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <div className="kicker">{isSlot ? t.book : t.request}</div>
                <div className="h-serif" style={{ fontWeight: 600, fontSize: 23, lineHeight: 1.15, marginTop: 4 }}>{title}</div>
              </div>
              <button className="circ" style={{ width: 36, height: 36 }} aria-label={t.close} onClick={onClose}>×</button>
            </div>

            <div>
              <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginBottom: 8 }}>{t.day}</div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {days.slice(0, 14).map(x => {
                  const m = isSlot ? modeFor(cfg, x.iso).mode : 'recommended'
                  const off = !x.open || (isSlot && m === 'free')
                  return (
                    <button key={x.iso} className="choice" aria-pressed={day === x.iso} disabled={!x.open} onClick={() => setDay(x.iso)}
                      style={{ flex: 'none', width: 54, padding: '8px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, opacity: !x.open ? 0.4 : off ? 0.75 : 1 }}>
                      <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em' }}>{x.iso === todayStr ? t.today : t.dows[x.d.getDay()]}</span>
                      <span className="h-serif tnum" style={{ fontSize: 21, fontWeight: 600 }}>{x.d.getDate()}</span>
                      {isSlot && x.open && m === 'required' && <span aria-hidden style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-accent-700)' }} />}
                    </button>
                  )
                })}
              </div>
              <input type="date" aria-label={t.more} min={todayStr} max={days[days.length - 1].iso} value={day} onChange={e => e.target.value && setDay(e.target.value)} style={{ ...field, height: 40, marginTop: 8, fontSize: 14 }} />
              {isSlot && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-accent-800)' }}>{MODE_LABEL[mode.mode][lang]}{mode.label ? ` · ${mode.label}` : ''}</div>}
              {!openDays.includes(new Date(day + 'T12:00:00').getDay()) && <div style={{ marginTop: 4, fontSize: 12 }}>{t.closed}</div>}
            </div>

            {free ? (
              <div className="h-serif" style={{ fontStyle: 'italic', fontSize: 18, lineHeight: 1.35 }}>{t.freeMsg}</div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{t.guests}</span>
                  <div className="stepper" style={{ height: 36, borderRadius: 18 }}>
                    <button style={{ width: 38, height: 34 }} aria-label="−" onClick={() => setParty(g => Math.max(1, g - 1))}>−</button>
                    <span style={{ minWidth: 22, fontSize: 14 }}>{party}</span>
                    <button style={{ width: 38, height: 34 }} aria-label="+" onClick={() => setParty(g => Math.min(isSlot ? cfg.max_party : 24, g + 1))}>+</button>
                  </div>
                </div>
                {isSlot && party >= cfg.max_party && <div style={{ fontSize: 11.5, fontStyle: 'italic' }}>{t.bigger}</div>}

                {isSlot && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginBottom: 8 }}>{t.time}</div>
                    {left === null ? <div style={{ fontSize: 12 }}>…</div> : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                        {cfg.slots.map(s => {
                          const ok = slotOk(s) && (left[s] ?? 0) >= party
                          return <button key={s} className="choice" aria-pressed={time === s} disabled={!ok} onClick={() => setTime(s)} title={ok ? `${left[s]} ${t.left}` : t.full} style={{ padding: '10px 0', fontSize: 14, opacity: ok ? 1 : 0.35 }}><span className="tnum">{s}</span></button>
                        })}
                      </div>
                    )}
                    {left !== null && !cfg.slots.some(s => slotOk(s) && (left[s] ?? 0) >= party) && <div style={{ marginTop: 8, fontSize: 12 }}>{t.none}</div>}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input style={field} value={name} onChange={e => setName(e.target.value)} placeholder={t.name} autoComplete="name" maxLength={60} aria-label={t.name} />
                  <input style={field} value={phone} onChange={e => setPhone(e.target.value)} placeholder={t.phone} autoComplete="tel" inputMode="tel" maxLength={30} aria-label={t.phone} />
                  <input style={field} value={note} onChange={e => setNote(e.target.value)} placeholder={t.note} maxLength={300} aria-label={t.note} />
                </div>
                {err && <div role="alert" style={{ fontSize: 13, color: 'var(--color-accent-800)' }}>{err}</div>}
                <button className="btn-o" style={{ height: 50, fontSize: 17 }} disabled={busy} onClick={() => void submit()}>{isSlot ? t.send : t.sendReq}</button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
