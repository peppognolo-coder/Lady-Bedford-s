import type { AdjKind, Shift, ShiftKind, ShiftTemplate, StaffConfig, StaffMember, StaffRole } from './api/types'
import type { Settings } from './api/types'

export const ROLE_LABEL: Record<StaffRole, string> = { cucina: 'Cucina', sala: 'Sala', cassa: 'Cassa', altro: 'Altro' }
export const ROLES: StaffRole[] = ['cucina', 'sala', 'cassa', 'altro']
export const KIND_LABEL: Record<ShiftKind, string> = { work: 'Turno', rest: 'Riposo', vacation: 'Ferie', permit: 'Permesso', sick: 'Malattia' }
export const ADJ_LABEL: Record<AdjKind, string> = { overtime: 'Straordinario', early: 'Uscita anticipata', late: 'Ritardo' }

export const DEFAULT_STAFF_CONFIG: StaffConfig = {
  min: { cucina: 1, sala: 1, cassa: 0, altro: 0 },
  templates: [
    { id: 't-mattina', label: 'Mattina', start: '09:00', end: '14:00', break_min: 0 },
    { id: 't-pomeriggio', label: 'Pomeriggio', start: '14:00', end: '19:30', break_min: 0 },
    { id: 't-giornata', label: 'Giornata', start: '11:00', end: '19:00', break_min: 30 },
  ],
}
export const withConfigDefaults = (c: Partial<StaffConfig> | null | undefined): StaffConfig => ({
  min: { ...DEFAULT_STAFF_CONFIG.min, ...(c?.min ?? {}) },
  templates: Array.isArray(c?.templates) ? c!.templates! : DEFAULT_STAFF_CONFIG.templates,
})

/* ---------- date e orari ---------- */
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const parseDay = (s: string) => new Date(s + 'T12:00:00')
export const addDays = (s: string, n: number) => { const d = parseDay(s); d.setDate(d.getDate() + n); return iso(d) }
export const mondayOf = (s: string) => addDays(s, -((parseDay(s).getDay() + 6) % 7))
export const weekDays = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i))
export const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
export const fmtHM = (min: number) => { const sign = min < 0 ? '−' : ''; const a = Math.abs(Math.round(min)); return `${sign}${Math.floor(a / 60)}h${a % 60 ? String(a % 60).padStart(2, '0') : ''}` }
/** Ore in formato decimale per Excel: 7,5 */
export const hoursDec = (min: number) => Math.round((min / 60) * 100) / 100
export const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : 'x' + Math.random().toString(36).slice(2) + Date.now().toString(36))

/* ---------- ore ---------- */
/** Minuti del turno come assegnato (senza pausa). */
export const plannedMin = (s: Shift) => (s.kind === 'work' && s.start && s.end ? Math.max(0, toMin(s.end) - toMin(s.start) - s.break_min) : 0)
/** Correzione in minuti: positiva per lo straordinario, negativa per uscita anticipata o ritardo. */
export const adjMin = (s: Shift) => (s.adj_kind ? (s.adj_kind === 'overtime' ? s.adj_min : -s.adj_min) : 0)
/** Ore effettivamente lavorate: turno assegnato più/meno la correzione. */
export const workedMin = (s: Shift) => (s.kind === 'work' ? Math.max(0, plannedMin(s) + adjMin(s)) : 0)

export interface Totals { planned: number; overtime: number; deducted: number; worked: number; days: number; rest: number; vacation: number; permit: number; sick: number }
export function totals(shifts: Shift[]): Totals {
  const t: Totals = { planned: 0, overtime: 0, deducted: 0, worked: 0, days: 0, rest: 0, vacation: 0, permit: 0, sick: 0 }
  const workDays = new Set<string>(), absDays: Record<string, Set<string>> = { rest: new Set(), vacation: new Set(), permit: new Set(), sick: new Set() }
  for (const s of shifts) {
    if (s.kind === 'work') {
      t.planned += plannedMin(s); const a = adjMin(s); if (a > 0) t.overtime += a; else t.deducted += -a
      t.worked += workedMin(s); workDays.add(s.day)
    } else absDays[s.kind].add(s.day)
  }
  t.days = workDays.size; t.rest = absDays.rest.size; t.vacation = absDays.vacation.size; t.permit = absDays.permit.size; t.sick = absDays.sick.size
  return t
}

/** Ore dovute da contratto in un intervallo di `days` giorni (proporzionale alle settimane). */
export const dueMin = (m: StaffMember, days: number) => (m.weekly_hours ? (m.weekly_hours * 60 * days) / 7 : null)

/* ---------- controlli: buchi di copertura e anomalie ---------- */
export interface Issue { id: string; level: 'gap' | 'warn'; day: string; text: string }
const dayName = (s: string) => parseDay(s).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })

/** Buchi: per ogni giorno di apertura e ogni mezz'ora, chi manca rispetto ai minimi per ruolo. */
export function coverageGaps(days: string[], shifts: Shift[], members: StaffMember[], cfg: StaffConfig, st: Pick<Settings, 'open_days' | 'open_time' | 'close_time'>): Issue[] {
  const out: Issue[] = [], by = new Map(members.map(m => [m.id, m]))
  const open = toMin(st.open_time), close = toMin(st.close_time)
  for (const day of days) {
    if (!st.open_days.includes(parseDay(day).getDay())) continue
    const work = shifts.filter(s => s.day === day && s.kind === 'work' && s.start && s.end && by.get(s.member_id)?.active)
    for (const role of ROLES) {
      const need = cfg.min[role] ?? 0; if (need <= 0) continue
      // intervalli consecutivi (mezz'ora) con meno persone del necessario
      let runStart: number | null = null, worst = need
      const flush = (end: number) => { if (runStart !== null) { const h = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; out.push({ id: `gap-${day}-${role}-${runStart}`, level: 'gap', day, text: `${dayName(day)}: ${h(runStart)}–${h(end)} ${ROLE_LABEL[role].toLowerCase()}, ${worst === 0 ? `nessuno (ne servono ${need})` : `manca${need - worst > 1 ? 'no' : ''} ${need - worst}`}` }); runStart = null; worst = need } }
      for (let t = open; t < close; t += 30) {
        const n = work.filter(s => by.get(s.member_id)!.role === role && toMin(s.start!) < t + 30 && toMin(s.end!) > t).length
        if (n < need) { if (runStart === null) runStart = t; worst = Math.min(worst, n) } else flush(t)
      }
      flush(close)
    }
  }
  return out
}

/** Anomalie sui turni: sovrapposizioni, giornate troppo lunghe, settimana senza riposo, ore sopra contratto, turno e assenza lo stesso giorno. */
export function anomalies(days: string[], shifts: Shift[], members: StaffMember[]): Issue[] {
  const out: Issue[] = []
  for (const m of members.filter(x => x.active)) {
    const mine = shifts.filter(s => s.member_id === m.id)
    let weekMin = 0, free = 0
    for (const day of days) {
      const ds = mine.filter(s => s.day === day), work = ds.filter(s => s.kind === 'work'), away = ds.filter(s => s.kind !== 'work')
      if (work.length && away.some(a => a.kind !== 'rest')) out.push({ id: `ca-${m.id}-${day}`, level: 'warn', day, text: `${m.name}, ${dayName(day)}: ha un turno e anche ${KIND_LABEL[away.find(a => a.kind !== 'rest')!.kind].toLowerCase()}` })
      const sorted = [...work].sort((a, b) => toMin(a.start!) - toMin(b.start!))
      for (let i = 1; i < sorted.length; i++) if (toMin(sorted[i].start!) < toMin(sorted[i - 1].end!)) out.push({ id: `ov-${m.id}-${day}`, level: 'warn', day, text: `${m.name}, ${dayName(day)}: turni sovrapposti` })
      const dayMin = work.reduce((a, s) => a + workedMin(s), 0); weekMin += dayMin
      if (dayMin > 10 * 60) out.push({ id: `long-${m.id}-${day}`, level: 'warn', day, text: `${m.name}, ${dayName(day)}: ${fmtHM(dayMin)} in una giornata` })
      if (!work.length) free++
    }
    if (days.length === 7 && hasWork(mine, days) && free === 0) out.push({ id: `norest-${m.id}-${days[0]}`, level: 'warn', day: days[0], text: `${m.name}: nessun giorno libero nella settimana` })
    if (days.length === 7 && m.weekly_hours && weekMin > m.weekly_hours * 60 + 1) out.push({ id: `over-${m.id}-${days[0]}`, level: 'warn', day: days[0], text: `${m.name}: ${fmtHM(weekMin)} in settimana, oltre le ${m.weekly_hours} ore di contratto` })
  }
  return out
}
const hasWork = (mine: Shift[], days: string[]) => mine.some(s => s.kind === 'work' && days.includes(s.day))

/* ---------- copia e riuso ---------- */
/** Copia i turni di una settimana in un'altra (stesso giorno della settimana). Le correzioni (straordinari…) non si copiano.
 *  mode 'merge': salta le celle dove la persona ha già qualcosa; 'replace': sostituisce. */
export function copyWeek(from: Shift[], fromMonday: string, toMonday: string, existing: Shift[], mode: 'merge' | 'replace', activeIds: Set<string>) {
  const offset = Math.round((parseDay(toMonday).getTime() - parseDay(fromMonday).getTime()) / 86400000)
  const busy = new Set(existing.map(s => `${s.member_id}|${s.day}`))
  const created: Shift[] = [], removed: string[] = []
  if (mode === 'replace') removed.push(...existing.map(s => s.id))
  for (const s of from) {
    if (!activeIds.has(s.member_id)) continue
    const day = addDays(s.day, offset)
    if (mode === 'merge' && busy.has(`${s.member_id}|${day}`)) continue
    created.push({ ...s, id: uid(), day, adj_kind: null, adj_min: 0, note: null })
  }
  return { created, removed }
}
export const fromTemplate = (t: ShiftTemplate, member_id: string, day: string): Shift => ({ id: uid(), member_id, day, kind: 'work', start: t.start, end: t.end, break_min: t.break_min, adj_kind: null, adj_min: 0, note: null })
