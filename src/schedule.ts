import type { MenuItem, Schedule, Settings } from './api/types'
import { DAY_NAMES } from './catalog'

export const catKey = (cat: string) => 'cat:' + cat
const md = (d: string) => d.slice(5, 10)
const hm = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const isEmptySchedule = (s?: Schedule | null) => !s || (!s.from && !s.to && !(s.days && s.days.length) && !s.start && !s.end)

/** Il momento `at` rientra nella programmazione? Senza programmazione: sempre sì. */
export function scheduleOn(s: Schedule | undefined | null, at = new Date()): boolean {
  if (isEmptySchedule(s)) return true
  const x = s as Schedule
  const day = isoLocal(at)
  if (x.from || x.to) {
    if (x.yearly && x.from && x.to) {
      const a = md(x.from), b = md(x.to), c = md(day)
      if (!(a <= b ? c >= a && c <= b : c >= a || c <= b)) return false
    } else if (x.yearly) {
      if (x.from && md(day) < md(x.from)) return false
      if (x.to && md(day) > md(x.to)) return false
    } else {
      if (x.from && day < x.from) return false
      if (x.to && day > x.to) return false
    }
  }
  if (x.days?.length && !x.days.includes(at.getDay())) return false
  if (x.start || x.end) {
    const m = at.getHours() * 60 + at.getMinutes()
    const a = x.start ? hm(x.start) : 0, b = x.end ? hm(x.end) : 24 * 60
    if (!(a <= b ? m >= a && m < b : m >= a || m < b)) return false
  }
  return true
}

const fmtDay = (d: string, lang: 'it' | 'en', yearly?: boolean) =>
  new Date(d + 'T12:00:00').toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', yearly ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' })

/** Descrizione breve: "1 dic – 6 gen, ogni anno · lun–ven · 15:00–19:00". */
export function describeSchedule(s: Schedule | undefined | null, lang: 'it' | 'en' = 'it'): string {
  if (isEmptySchedule(s)) return lang === 'it' ? 'Sempre in menu' : 'Always on the menu'
  const x = s as Schedule, parts: string[] = []
  const it = lang === 'it'
  if (x.from && x.to) parts.push(`${fmtDay(x.from, lang, x.yearly)} – ${fmtDay(x.to, lang, x.yearly)}${x.yearly ? (it ? ', ogni anno' : ', every year') : ''}`)
  else if (x.from) parts.push(`${it ? 'dal' : 'from'} ${fmtDay(x.from, lang, x.yearly)}`)
  else if (x.to) parts.push(`${it ? 'fino al' : 'until'} ${fmtDay(x.to, lang, x.yearly)}`)
  if (x.days?.length && x.days.length < 7) {
    const order = [1, 2, 3, 4, 5, 6, 0].filter(d => x.days!.includes(d)), n = DAY_NAMES[lang]
    parts.push(order.map(d => n[d]).join(', '))
  }
  if (x.start || x.end) parts.push(x.start && x.end ? `${x.start}–${x.end}` : x.start ? `${it ? 'dalle' : 'from'} ${x.start}` : `${it ? 'fino alle' : 'until'} ${x.end}`)
  return parts.join(' · ')
}

export type Offer = { state: 'on' } | { state: 'hide' } | { state: 'teaser'; note: string }

/** Stato di un prodotto: in menu, nascosto o "in arrivo" (considera sia il prodotto sia la sua sezione). */
export function offerOf(settings: Pick<Settings, 'schedules'>, m: Pick<MenuItem, 'id' | 'cat'>, at = new Date(), lang: 'it' | 'en' = 'it'): Offer {
  const sch = settings.schedules
  if (!sch) return { state: 'on' }
  const off = [sch[m.id], sch[catKey(m.cat)]].filter(s => !isEmptySchedule(s) && !scheduleOn(s, at)) as Schedule[]
  if (!off.length) return { state: 'on' }
  if (off.every(s => s.teaser)) return { state: 'teaser', note: (lang === 'it' ? 'In menu: ' : 'On menu: ') + describeSchedule(off[0], lang) }
  return { state: 'hide' }
}

/** Prodotti visibili in questo momento (per cassa e sala). */
export const menuNow = (menu: MenuItem[], settings: Pick<Settings, 'schedules'>, at = new Date()) => menu.filter(m => offerOf(settings, m, at).state === 'on')
