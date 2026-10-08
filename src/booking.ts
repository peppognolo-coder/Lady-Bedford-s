import type { Booking, BookingConfig, BookingMode } from './api/types'

export const DEFAULT_BOOKING: BookingConfig = {
  enabled: true, default_mode: 'recommended', rules: [],
  slots: ['11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'],
  capacity: 24, duration_min: 90, max_party: 10, advance_days: 60, min_notice_h: 2, auto_confirm: true,
}
export const MODE_LABEL: Record<BookingMode, { it: string; en: string }> = {
  required: { it: 'Prenotazione necessaria', en: 'Booking required' },
  recommended: { it: 'Prenotazione consigliata', en: 'Booking recommended' },
  free: { it: 'Accesso libero', en: 'Walk-ins welcome' },
}
export const ACTIVE = ['pending', 'confirmed', 'seated']
export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const md = (s: string) => Number(s.slice(5, 7)) * 100 + Number(s.slice(8, 10))

/** Modalità valida in un giorno: il primo periodo che lo contiene, altrimenti quella predefinita. */
export function modeFor(cfg: BookingConfig, day: string): { mode: BookingMode; label?: string } {
  for (const r of cfg.rules) {
    const inside = r.yearly
      ? (md(r.from) <= md(r.to) ? md(day) >= md(r.from) && md(day) <= md(r.to) : md(day) >= md(r.from) || md(day) <= md(r.to))
      : day >= r.from && day <= r.to
    if (inside) return { mode: r.mode, label: r.label }
  }
  return { mode: cfg.default_mode }
}

/** Coperti già occupati in un dato minuto del giorno. */
const occupied = (cfg: BookingConfig, list: Booking[], at: number) =>
  list.filter(b => ACTIVE.includes(b.status) && b.time && toMin(b.time) <= at && at < toMin(b.time) + cfg.duration_min).reduce((a, b) => a + b.party, 0)

/** Posti ancora liberi se qualcuno si siede a `slot` e resta per tutta la durata. */
export function seatsLeft(cfg: BookingConfig, list: Booking[], slot: string): number {
  const s = toMin(slot)
  let worst = cfg.capacity
  for (let u = s; u < s + cfg.duration_min; u += 15) worst = Math.min(worst, cfg.capacity - occupied(cfg, list, u))
  return Math.max(0, worst)
}
export const availability = (cfg: BookingConfig, list: Booking[]) => Object.fromEntries(cfg.slots.map(s => [s, seatsLeft(cfg, list, s)])) as Record<string, number>

export const KIND_LABEL: Record<string, string> = { table: 'Tavolo', tea: 'Afternoon tea' }
export const STATUS_LABEL: Record<string, { it: string; en: string }> = {
  pending: { it: 'In attesa di conferma', en: 'Awaiting confirmation' }, confirmed: { it: 'Confermata', en: 'Confirmed' },
  declined: { it: 'Non disponibile', en: 'Unavailable' }, cancelled: { it: 'Annullata', en: 'Cancelled' },
  seated: { it: 'Al tavolo', en: 'Seated' }, noshow: { it: 'Non presentato', en: 'No-show' },
}

/** Controlli di una prenotazione dell'app (gli stessi li rifà il database). Restituisce il messaggio d'errore o null. */
export function checkBooking(cfg: BookingConfig, openDays: number[], list: Booking[], b: { kind: string; day: string; time?: string | null; party: number }, now = new Date()): string | null {
  if (b.party < 1) return 'Indica quanti siete.'
  if (b.day < isoDay(now)) return 'Questa data è già passata.'
  if (b.kind !== 'table' && b.kind !== 'tea') return null            // richieste di servizi: solo data e ospiti
  if (!cfg.enabled) return 'Le prenotazioni online non sono attive: chiamaci o passa a trovarci.'
  const last = new Date(now); last.setDate(last.getDate() + cfg.advance_days)
  if (b.day > isoDay(last)) return `Si prenota fino a ${cfg.advance_days} giorni prima.`
  const dow = new Date(b.day + 'T12:00:00').getDay()
  if (!openDays.includes(dow)) return 'Quel giorno siamo chiusi.'
  if (modeFor(cfg, b.day).mode === 'free') return 'In quel giorno non serve prenotare: vieni pure, ti aspettiamo.'
  if (b.party > cfg.max_party) return `Per gruppi oltre ${cfg.max_party} persone chiamaci.`
  if (!b.time || !cfg.slots.includes(b.time)) return 'Scegli un orario valido.'
  if (b.day === isoDay(now) && toMin(b.time) < now.getHours() * 60 + now.getMinutes() + cfg.min_notice_h * 60) return `Servono almeno ${cfg.min_notice_h} ore di anticipo.`
  if (seatsLeft(cfg, list.filter(x => x.day === b.day), b.time) < b.party) return 'Quell’orario non ha più posti: scegline un altro.'
  return null
}
