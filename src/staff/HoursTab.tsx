import { Fragment, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { Shift, StaffMember } from '../api/types'
import { downloadCsv } from '../backup'
import { ADJ_LABEL, KIND_LABEL, ROLE_LABEL, addDays, adjMin, dueMin, fmtHM, hoursDec, iso, parseDay, plannedMin, totals, workedMin } from '../shifts'

type Mode = 'week' | 'month'
const monthStart = (d: Date) => iso(new Date(d.getFullYear(), d.getMonth(), 1))
const monthEnd = (d: Date) => iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))

/** Conto delle ore per persona: ore assegnate nei turni, più straordinari, meno uscite anticipate. */
export default function HoursTab({ members }: { members: StaffMember[] }) {
  const [mode, setMode] = useState<Mode>('month')
  const [anchor, setAnchor] = useState(() => new Date())
  const [shifts, setShifts] = useState<Shift[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const [from, to] = useMemo(() => {
    if (mode === 'month') return [monthStart(anchor), monthEnd(anchor)]
    const mon = addDays(iso(anchor), -((anchor.getDay() + 6) % 7)); return [mon, addDays(mon, 6)]
  }, [mode, anchor])
  const days = Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86400000) + 1
  useEffect(() => {
    let alive = true; setShifts(null); setErr(null)
    api.listShifts(from, to).then(s => alive && setShifts(s)).catch(e => alive && setErr((e as Error).message))
    return () => { alive = false }
  }, [from, to])

  const move = (n: number) => setAnchor(a => { const d = new Date(a); if (mode === 'month') d.setMonth(d.getMonth() + n, 1); else d.setDate(d.getDate() + 7 * n); return d })
  const label = mode === 'month' ? anchor.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }) : `${parseDay(from).getDate()}/${parseDay(from).getMonth() + 1} – ${parseDay(to).getDate()}/${parseDay(to).getMonth() + 1}/${parseDay(to).getFullYear()}`
  const fmtDay = (d: string) => parseDay(d).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })

  const rows = useMemo(() => {
    if (!shifts) return []
    const withShifts = new Set(shifts.map(s => s.member_id))
    return members.filter(m => m.active || withShifts.has(m.id)).map(m => {
      const mine = shifts.filter(s => s.member_id === m.id), t = totals(mine), due = dueMin(m, days)
      return { m, mine, t, due, balance: due === null ? null : t.worked - due }
    })
  }, [shifts, members, days])
  const sum = rows.reduce((a, r) => ({ planned: a.planned + r.t.planned, overtime: a.overtime + r.t.overtime, deducted: a.deducted + r.t.deducted, worked: a.worked + r.t.worked }), { planned: 0, overtime: 0, deducted: 0, worked: 0 })

  const exportSummary = () => downloadCsv(`ore-${from}_${to}.csv`, ['persona', 'ruolo', 'ore assegnate', 'straordinari', 'uscite anticipate e ritardi', 'ore effettive', 'giorni lavorati', 'riposi', 'ferie', 'permessi', 'malattia', 'ore da contratto', 'saldo'],
    rows.map(r => [r.m.name, ROLE_LABEL[r.m.role], hoursDec(r.t.planned), hoursDec(r.t.overtime), hoursDec(r.t.deducted), hoursDec(r.t.worked), r.t.days, r.t.rest, r.t.vacation, r.t.permit, r.t.sick, r.due === null ? '' : hoursDec(r.due), r.balance === null ? '' : hoursDec(r.balance)]))
  const exportDetail = () => downloadCsv(`turni-dettaglio-${from}_${to}.csv`, ['data', 'persona', 'tipo', 'dalle', 'alle', 'pausa min', 'ore assegnate', 'correzione', 'minuti', 'ore effettive', 'nota'],
    (shifts ?? []).map(s => [s.day, members.find(m => m.id === s.member_id)?.name ?? '', KIND_LABEL[s.kind], s.start, s.end, s.break_min, hoursDec(plannedMin(s)), s.adj_kind ? ADJ_LABEL[s.adj_kind] : '', s.adj_kind ? adjMin(s) : '', hoursDec(workedMin(s)), s.note]))

  return (
    <div className="st-pane wide">
      <div className="st-rowline" style={{ justifyContent: 'space-between' }}>
        <div className="st-rowline">
          <div className="st-chips" role="group" aria-label="Periodo">
            <button className="st-daybtn" aria-pressed={mode === 'month'} onClick={() => setMode('month')}>Mese</button>
            <button className="st-daybtn" aria-pressed={mode === 'week'} onClick={() => setMode('week')}>Settimana</button>
          </div>
          <button className="st-ghost" aria-label="Periodo precedente" onClick={() => move(-1)}>←</button>
          <b className="st-weeklabel">{label}</b>
          <button className="st-ghost" aria-label="Periodo successivo" onClick={() => move(1)}>→</button>
        </div>
        <div className="st-rowline"><button className="st-ghost" onClick={exportSummary} disabled={!rows.length}>Esporta riepilogo (CSV)</button><button className="st-ghost" onClick={exportDetail} disabled={!shifts?.length}>Esporta dettaglio (CSV)</button></div>
      </div>
      <p className="st-hint">Ore effettive = ore dei turni assegnati (pausa esclusa) + straordinari − uscite anticipate e ritardi. Ferie, permessi, malattia e riposi non contano come ore lavorate. Il conteggio interno non sostituisce le buste paga o il Libro Unico del consulente.</p>
      {err && <div className="st-alert" role="alert">{err}</div>}
      {!shifts && !err && <p className="st-hint">Caricamento…</p>}
      {shifts && (
        <>
          <div className="st-stats">
            <div className="st-stat"><span>Ore assegnate</span><b className="tnum">{fmtHM(sum.planned)}</b></div>
            <div className="st-stat"><span>Straordinari</span><b className="tnum">{fmtHM(sum.overtime)}</b></div>
            <div className="st-stat"><span>Uscite anticipate e ritardi</span><b className="tnum">{sum.deducted ? '−' : ''}{fmtHM(sum.deducted)}</b></div>
            <div className="st-stat"><span>Ore effettive</span><b className="tnum">{fmtHM(sum.worked)}</b></div>
          </div>
          <div className="st-tablewrap"><table className="st-table">
            <thead><tr><th>Persona</th><th className="r">Assegnate</th><th className="r">Straord.</th><th className="r">Anticipi</th><th className="r">Effettive</th><th className="r">Giorni</th><th className="r">Riposi</th><th className="r">Ferie</th><th className="r">Permessi</th><th className="r">Malattia</th><th className="r">Contratto</th><th className="r">Saldo</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <Fragment key={r.m.id}>
                  <tr>
                    <td><button className="st-thbtn" aria-expanded={open === r.m.id} onClick={() => setOpen(open === r.m.id ? null : r.m.id)}><b>{r.m.name}</b> <small>{ROLE_LABEL[r.m.role]}{r.m.active ? '' : ' · archiviata'}</small> {open === r.m.id ? '▾' : '▸'}</button></td>
                    <td className="r tnum">{fmtHM(r.t.planned)}</td><td className="r tnum">{r.t.overtime ? '+' + fmtHM(r.t.overtime) : '—'}</td><td className="r tnum">{r.t.deducted ? '−' + fmtHM(r.t.deducted) : '—'}</td>
                    <td className="r tnum"><b>{fmtHM(r.t.worked)}</b></td><td className="r tnum">{r.t.days}</td><td className="r tnum">{r.t.rest}</td><td className="r tnum">{r.t.vacation}</td><td className="r tnum">{r.t.permit}</td><td className="r tnum">{r.t.sick}</td>
                    <td className="r tnum">{r.due === null ? '—' : fmtHM(r.due)}</td>
                    <td className="r tnum">{r.balance === null ? '—' : `${r.balance > 0 ? '+' : ''}${fmtHM(r.balance)}`}</td>
                  </tr>
                  {open === r.m.id && (
                    <tr className="st-detail"><td colSpan={12}>
                      {r.mine.length === 0 ? 'Nessun turno nel periodo.' : (
                        <ul className="st-daylist">
                          {[...r.mine].sort((a, b) => a.day.localeCompare(b.day) || (a.start ?? '').localeCompare(b.start ?? '')).map(s => (
                            <li key={s.id} className="tnum"><b>{fmtDay(s.day)}</b> {s.kind === 'work' ? <>{s.start}–{s.end}{s.break_min ? ` (pausa ${s.break_min}′)` : ''} · {fmtHM(plannedMin(s))}{s.adj_kind && <> · <b>{ADJ_LABEL[s.adj_kind]} {adjMin(s) > 0 ? '+' : '−'}{s.adj_min}′</b> → {fmtHM(workedMin(s))}</>}</> : KIND_LABEL[s.kind]}{s.note ? <em> — {s.note}</em> : null}</li>
                          ))}
                        </ul>
                      )}
                    </td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table></div>
          <p className="st-hint">“Contratto” sono le ore da contratto in proporzione ai giorni del periodo ({days} giorni); il saldo è la differenza con le ore effettive. Compare solo per chi ha le ore settimanali impostate.</p>
        </>
      )}
    </div>
  )
}
