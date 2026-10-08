import type { Shift, StaffMember } from './api/types'
import { addDays, iso, mondayOf } from './shifts'

/** Personale e turni di prova (solo modalità demo): settimana scorsa e questa, con qualche buco e un paio di correzioni. */
export function demoStaff(): { members: StaffMember[]; shifts: Shift[] } {
  const members: StaffMember[] = [
    { id: 'sm-marta', name: 'Marta', role: 'sala', weekly_hours: 38, active: true, sort: 0 },
    { id: 'sm-giulia', name: 'Giulia', role: 'sala', weekly_hours: 28, active: true, sort: 1 },
    { id: 'sm-luca', name: 'Luca', role: 'cucina', weekly_hours: 38, active: true, sort: 2 },
    { id: 'sm-paolo', name: 'Paolo', role: 'cucina', weekly_hours: 20, active: true, sort: 3 },
  ]
  const mon = mondayOf(iso(new Date())), prev = addDays(mon, -7)
  const shifts: Shift[] = []
  let n = 0
  const w = (m: string, day: string, start: string, end: string, br = 0, adj: Partial<Shift> = {}) =>
    shifts.push({ id: 'ss' + ++n, member_id: m, day, kind: 'work', start, end, break_min: br, adj_kind: null, adj_min: 0, note: null, ...adj })
  const a = (m: string, day: string, kind: Shift['kind']) =>
    shifts.push({ id: 'ss' + ++n, member_id: m, day, kind, start: null, end: null, break_min: 0, adj_kind: null, adj_min: 0, note: null })
  // lunedì chiuso; martedì = +1 … domenica = +6
  for (const base of [prev, mon]) {
    const cur = base === mon
    for (let d = 1; d <= 6; d++) {
      const day = addDays(base, d)
      if (d <= 5) w('sm-luca', day, '11:00', '19:00', 30)               // cucina martedì–sabato
      if (d === 6) w('sm-paolo', day, '11:00', '19:00', 30)             // cucina domenica
      if (d === 3) w('sm-paolo', day, '12:00', '18:00')
      if (d !== 3) w('sm-marta', day, '11:00', '19:00', 30)             // sala: Marta tutti i giorni tranne giovedì
      if (d === 1 || d === 2) w('sm-giulia', day, '14:00', '19:30')
      if (d === 3) { if (cur) a('sm-giulia', day, 'vacation'); else w('sm-giulia', day, '11:00', '19:00', 30) }
      if (d === 4 && cur) a('sm-giulia', day, 'vacation')
      if (d === 4 && !cur) w('sm-giulia', day, '14:00', '19:30')
      if (d >= 5) w('sm-giulia', day, '11:00', '19:00', 30)
    }
    ;['sm-marta', 'sm-giulia', 'sm-luca', 'sm-paolo'].forEach(m => a(m, base, 'rest'))
  }
  // un po' di storia: straordinario e uscita anticipata la settimana scorsa
  const s = shifts.find(x => x.member_id === 'sm-marta' && x.day === addDays(prev, 5))
  if (s) { s.adj_kind = 'overtime'; s.adj_min = 45; s.note = 'Evento privato, ha chiuso lei' }
  const e = shifts.find(x => x.member_id === 'sm-paolo' && x.day === addDays(prev, 3))
  if (e) { e.adj_kind = 'early'; e.adj_min = 60; e.note = 'Visita medica' }
  return { members, shifts }
}
