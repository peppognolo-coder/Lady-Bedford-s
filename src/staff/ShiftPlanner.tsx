import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import type { AdjKind, Shift, ShiftKind, StaffConfig, StaffMember } from '../api/types'
import { useCatalog } from '../catalog'
import {
  ADJ_LABEL, KIND_LABEL, ROLES, ROLE_LABEL, addDays, anomalies, copyWeek, coverageGaps, fmtHM, fromTemplate, iso, mondayOf,
  parseDay, plannedMin, toMin, totals, uid, weekDays, workedMin, adjMin,
} from '../shifts'
import { Field } from './shared'

const DOW = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
const longDay = (s: string) => parseDay(s).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
const weekLabel = (mon: string) => { const a = parseDay(mon), b = parseDay(addDays(mon, 6)); return `${a.getDate()}${a.getMonth() !== b.getMonth() ? ' ' + a.toLocaleDateString('it-IT', { month: 'short' }) : ''} – ${b.getDate()} ${b.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}` }
const ABSENCES: ShiftKind[] = ['rest', 'vacation', 'permit', 'sick']

export default function ShiftPlanner({ members, config }: { members: StaffMember[]; config: StaffConfig }) {
  const { catalog } = useCatalog()
  const [monday, setMonday] = useState(() => mondayOf(iso(new Date())))
  const [shifts, setShifts] = useState<Shift[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [sheet, setSheet] = useState<{ m: StaffMember; day: string } | null>(null)
  const [copy, setCopy] = useState<'prev' | 'next' | null>(null)
  const days = useMemo(() => weekDays(monday), [monday])
  const active = useMemo(() => [...members].filter(m => m.active).sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.sort - b.sort), [members])

  const load = useCallback(async () => {
    try { setShifts(await api.listShifts(days[0], days[6])); setErr(null) } catch (e) { setErr((e as Error).message) }
  }, [days])
  useEffect(() => { setShifts(null); void load() }, [load])

  const cell = useMemo(() => { const m = new Map<string, Shift[]>(); (shifts ?? []).forEach(s => { const k = s.member_id + '|' + s.day; m.set(k, [...(m.get(k) ?? []), s].sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))) }); return m }, [shifts])
  const issues = useMemo(() => shifts ? [...coverageGaps(days, shifts, members, config, catalog.settings), ...anomalies(days, shifts, members)] : [], [shifts, days, members, config, catalog.settings])
  const gapDays = new Set(issues.filter(i => i.level === 'gap').map(i => i.day))
  const isOpen = (d: string) => catalog.settings.open_days.includes(parseDay(d).getDay())
  const today = iso(new Date())

  const clearWeek = async () => {
    if (!shifts?.length) return
    if (!confirm(`Svuotare tutta la settimana (${shifts.length} voci)? Si perdono anche straordinari e note registrati.`)) return
    try { await api.deleteShifts(shifts.map(s => s.id)); await load() } catch (e) { setErr((e as Error).message) }
  }

  return (
    <div className="st-pane wide">
      <div className="st-rowline" style={{ justifyContent: 'space-between' }}>
        <div className="st-rowline">
          <button className="st-ghost" aria-label="Settimana precedente" onClick={() => setMonday(addDays(monday, -7))}>←</button>
          <b className="st-weeklabel">{weekLabel(monday)}</b>
          <button className="st-ghost" aria-label="Settimana successiva" onClick={() => setMonday(addDays(monday, 7))}>→</button>
          {monday !== mondayOf(today) && <button className="st-ghost" onClick={() => setMonday(mondayOf(today))}>Questa settimana</button>}
        </div>
        <div className="st-rowline">
          <button className="st-ghost" onClick={() => setCopy('prev')}>Copia dalla settimana prima</button>
          <button className="st-ghost" onClick={() => setCopy('next')}>Copia nella settimana dopo</button>
          <button className="st-ghost" onClick={() => void clearWeek()} disabled={!shifts?.length}>Svuota settimana</button>
        </div>
      </div>
      {err && <div className="st-alert" role="alert">{err}</div>}
      {!shifts && !err && <p className="st-hint">Caricamento…</p>}
      {shifts && (
        <>
          <div className="st-tablewrap">
            <table className="st-plan">
              <thead><tr>
                <th scope="col">Persona</th>
                {days.map((d, i) => <th key={d} scope="col" className={d === today ? 'today' : ''}>{DOW[i]} <span className="tnum">{parseDay(d).getDate()}</span>{!isOpen(d) && <small>chiuso</small>}</th>)}
                <th scope="col" className="r">Ore</th>
              </tr></thead>
              <tbody>
                {active.map(m => {
                  const mine = shifts.filter(s => s.member_id === m.id), t = totals(mine)
                  return (
                    <tr key={m.id}>
                      <th scope="row">{m.name}<small>{ROLE_LABEL[m.role]}</small></th>
                      {days.map(d => {
                        const es = cell.get(m.id + '|' + d) ?? []
                        const label = es.length ? es.map(s => s.kind === 'work' ? `${s.start}–${s.end}` : KIND_LABEL[s.kind]).join(', ') : 'vuoto'
                        return (
                          <td key={d} className={!isOpen(d) ? 'closed' : ''}>
                            <button className={`st-cell ${es.length ? '' : 'empty'}`} aria-label={`${m.name}, ${longDay(d)}: ${label}. Modifica`} onClick={() => setSheet({ m, day: d })}>
                              {es.length === 0 ? <span aria-hidden>+</span> : es.map(s => (
                                <span key={s.id} className={`st-chip-shift ${s.kind}`}>
                                  {s.kind === 'work' ? <span className="tnum">{s.start}–{s.end}</span> : KIND_LABEL[s.kind]}
                                  {s.kind === 'work' && s.adj_kind && <em className="tnum" title={ADJ_LABEL[s.adj_kind]}>{adjMin(s) > 0 ? '+' : '−'}{s.adj_min}′</em>}
                                </span>
                              ))}
                            </button>
                          </td>
                        )
                      })}
                      <td className="r tnum"><b>{fmtHM(t.worked)}</b>{m.weekly_hours ? <small> / {m.weekly_hours}h</small> : null}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot><tr>
                <th scope="row">In servizio</th>
                {days.map(d => { const n = new Set(shifts.filter(s => s.day === d && s.kind === 'work').map(s => s.member_id)).size; return <td key={d} className={`tnum ${gapDays.has(d) ? 'gap' : ''}`}>{isOpen(d) || n ? n : '—'}{gapDays.has(d) && <span title="C’è un buco di copertura"> ⚠</span>}</td> })}
                <td />
              </tr></tfoot>
            </table>
          </div>

          <section aria-label="Controlli">
            <h2 className="st-h3">Controlli della settimana {issues.length > 0 && <span className="st-pill unpaid">{issues.length}</span>}</h2>
            {issues.length === 0 ? <p className="st-hint">Nessun buco di copertura e nessuna anomalia. I minimi per ruolo si impostano in “Regole e modelli”.</p> : (
              <ul className="st-issues">
                {issues.map(i => <li key={i.id}><span className={`st-pill ${i.level === 'gap' ? 'unpaid' : ''}`}>{i.level === 'gap' ? 'Buco' : 'Controlla'}</span> {i.text}</li>)}
              </ul>
            )}
          </section>
        </>
      )}

      {sheet && shifts && <ShiftSheet key={sheet.m.id + sheet.day} m={sheet.m} day={sheet.day} days={days} weekShifts={shifts} config={config} onClose={() => setSheet(null)} onSaved={async () => { setSheet(null); await load() }} />}
      {copy && <CopyDialog dir={copy} monday={monday} members={members} onClose={() => setCopy(null)} onDone={async () => { setCopy(null); await load() }} />}
    </div>
  )
}

/* ---------- finestra: un giorno di una persona ---------- */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const close = useRef(onClose); close.current = onClose
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current()
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.() }
  }, [])
  return (
    <div className="st-modal" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="st-modal-panel" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="st-rowline" style={{ justifyContent: 'space-between' }}><h2 className="st-h3" style={{ margin: 0 }}>{title}</h2><button className="st-ghost" onClick={onClose} aria-label="Chiudi">✕</button></div>
        {children}
      </div>
    </div>
  )
}

function ShiftSheet({ m, day, days, weekShifts, config, onClose, onSaved }: { m: StaffMember; day: string; days: string[]; weekShifts: Shift[]; config: StaffConfig; onClose: () => void; onSaved: () => Promise<void> }) {
  const existing = weekShifts.filter(s => s.member_id === m.id && s.day === day)
  const [draft, setDraft] = useState<Shift[]>(() => existing.map(s => ({ ...s })))
  const [also, setAlso] = useState<Set<string>>(new Set())
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const blank = (kind: ShiftKind): Shift => ({ id: uid(), member_id: m.id, day, kind, start: null, end: null, break_min: 0, adj_kind: null, adj_min: 0, note: null })
  const upd = (id: string, p: Partial<Shift>) => setDraft(d => d.map(s => (s.id === id ? { ...s, ...p } : s)))
  const work = draft.filter(s => s.kind === 'work')
  const addWork = (s: Shift) => setDraft(d => [...d.filter(x => x.kind === 'work'), s])
  const setAbsence = (k: ShiftKind) => setDraft([blank(k)])

  const save = async () => {
    for (const s of work) {
      if (!s.start || !s.end || toMin(s.start) >= toMin(s.end)) return setErr('In ogni turno l’inizio deve essere prima della fine.')
      if (s.break_min < 0 || s.break_min >= toMin(s.end) - toMin(s.start)) return setErr('La pausa è più lunga del turno.')
      if (s.adj_kind && s.adj_kind !== 'overtime' && s.adj_min > plannedMin(s)) return setErr('La riduzione è più lunga del turno.')
    }
    const sorted = [...work].sort((a, b) => toMin(a.start!) - toMin(b.start!))
    for (let i = 1; i < sorted.length; i++) if (toMin(sorted[i].start!) < toMin(sorted[i - 1].end!)) return setErr('Due turni si sovrappongono.')
    setBusy(true)
    try {
      const keep = new Set(draft.map(s => s.id))
      const remove = existing.filter(s => !keep.has(s.id)).map(s => s.id)
      const upserts: Shift[] = draft.map(s => ({ ...s, adj_min: s.adj_kind ? s.adj_min : 0, note: s.note?.trim() || null }))
      for (const d of also) {   // stessa giornata copiata sugli altri giorni scelti (sostituisce quel che c'è, senza correzioni)
        remove.push(...weekShifts.filter(s => s.member_id === m.id && s.day === d).map(s => s.id))
        upserts.push(...draft.map(s => ({ ...s, id: uid(), day: d, adj_kind: null as AdjKind | null, adj_min: 0, note: null })))
      }
      if (remove.length) await api.deleteShifts(remove)
      if (upserts.length) await api.saveShifts(upserts)
      await onSaved()
    } catch (e) { setErr((e as Error).message); setBusy(false) }
  }

  return (
    <Modal title={`${m.name} · ${longDay(day)}`} onClose={onClose}>
      <div className="st-chips" aria-label="Modelli di turno">
        {config.templates.map(t => <button key={t.id} type="button" onClick={() => addWork(fromTemplate(t, m.id, day))}>{t.label} <small className="tnum">{t.start}–{t.end}</small></button>)}
        <button type="button" onClick={() => addWork({ ...blank('work'), start: '11:00', end: '19:00' })}>Orario libero</button>
      </div>
      <div className="st-chips" aria-label="Assenze">
        {ABSENCES.map(k => <button key={k} type="button" aria-pressed={draft.length === 1 && draft[0].kind === k} onClick={() => setAbsence(k)}>{KIND_LABEL[k]}</button>)}
      </div>

      {draft.length === 0 && <p className="st-hint">Nessun turno: scegli un modello, un orario libero o un’assenza.</p>}
      {draft.map(s => s.kind === 'work' ? (
        <div key={s.id} className="st-sheet st-shiftedit">
          <div className="st-form">
            <Field label="Dalle" id={`sh-s-${s.id}`}><input id={`sh-s-${s.id}`} type="time" value={s.start ?? ''} onChange={e => upd(s.id, { start: e.target.value })} /></Field>
            <Field label="Alle" id={`sh-e-${s.id}`}><input id={`sh-e-${s.id}`} type="time" value={s.end ?? ''} onChange={e => upd(s.id, { end: e.target.value })} /></Field>
            <Field label="Pausa (min)" id={`sh-b-${s.id}`}><input id={`sh-b-${s.id}`} inputMode="numeric" value={s.break_min} onChange={e => upd(s.id, { break_min: Math.max(0, parseInt(e.target.value.replace(/\D/g, '') || '0', 10)) })} /></Field>
          </div>
          <fieldset className="st-adj">
            <legend>Correzione sulle ore</legend>
            <div className="st-chips">
              <button type="button" aria-pressed={!s.adj_kind} onClick={() => upd(s.id, { adj_kind: null, adj_min: 0 })}>Nessuna</button>
              {(['overtime', 'early', 'late'] as AdjKind[]).map(k => <button key={k} type="button" aria-pressed={s.adj_kind === k} onClick={() => upd(s.id, { adj_kind: k, adj_min: s.adj_min || 30 })}>{ADJ_LABEL[k]}</button>)}
            </div>
            {s.adj_kind && (
              <div className="st-form">
                <Field label={s.adj_kind === 'overtime' ? 'Minuti in più' : 'Minuti in meno'} id={`sh-a-${s.id}`}>
                  <input id={`sh-a-${s.id}`} inputMode="numeric" value={s.adj_min} onChange={e => upd(s.id, { adj_min: Math.min(720, parseInt(e.target.value.replace(/\D/g, '') || '0', 10)) })} />
                </Field>
                <div className="st-chips">{[15, 30, 60, 120].map(n => <button key={n} type="button" onClick={() => upd(s.id, { adj_min: n })}>{n}′</button>)}</div>
                <Field label="Motivo (facoltativo)" id={`sh-n-${s.id}`}><input id={`sh-n-${s.id}`} value={s.note ?? ''} maxLength={200} onChange={e => upd(s.id, { note: e.target.value })} /></Field>
              </div>
            )}
          </fieldset>
          <p className="st-hint tnum">Ore assegnate <b>{fmtHM(plannedMin(s))}</b>{s.adj_kind ? <> · effettive <b>{fmtHM(workedMin(s))}</b></> : null}</p>
          <button className="st-back" onClick={() => setDraft(d => d.filter(x => x.id !== s.id))}>Togli questo turno</button>
        </div>
      ) : (
        <div key={s.id} className="st-sheet">
          <b>{KIND_LABEL[s.kind]}</b> — giornata intera
          <Field label="Nota (facoltativa)" id={`sh-an-${s.id}`}><input id={`sh-an-${s.id}`} value={s.note ?? ''} maxLength={200} onChange={e => upd(s.id, { note: e.target.value })} /></Field>
        </div>
      ))}
      {work.length > 0 && <button className="st-ghost" onClick={() => addWork({ ...blank('work'), start: '17:00', end: '19:00' })}>Aggiungi un secondo turno (spezzato)</button>}

      <fieldset className="st-adj">
        <legend>Ripeti uguale anche su</legend>
        <div className="st-chips">
          {days.filter(d => d !== day).map(d => <button key={d} type="button" aria-pressed={also.has(d)} onClick={() => setAlso(o => { const n = new Set(o); n.has(d) ? n.delete(d) : n.add(d); return n })}>{DOW[days.indexOf(d)]} {parseDay(d).getDate()}</button>)}
        </div>
        {also.size > 0 && <p className="st-hint">Su quei giorni il contenuto attuale di {m.name} viene sostituito.</p>}
      </fieldset>

      {err && <div className="st-alert" role="alert">{err}</div>}
      <div className="st-rowline">
        <button className="st-act" disabled={busy} onClick={() => void save()}>{draft.length === 0 && existing.length > 0 ? 'Svuota il giorno' : 'Salva'}</button>
        <button className="st-ghost" onClick={onClose}>Annulla</button>
        {draft.length > 0 && <button className="st-back" onClick={() => setDraft([])}>Svuota</button>}
      </div>
    </Modal>
  )
}

/* ---------- copia di una settimana ---------- */
function CopyDialog({ dir, monday, members, onClose, onDone }: { dir: 'prev' | 'next'; monday: string; members: StaffMember[]; onClose: () => void; onDone: () => Promise<void> }) {
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [src, setSrc] = useState<Shift[] | null>(null)
  const [dst, setDst] = useState<Shift[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const fromMon = dir === 'prev' ? addDays(monday, -7) : monday, toMon = dir === 'prev' ? monday : addDays(monday, 7)
  useEffect(() => {
    let alive = true
    Promise.all([api.listShifts(fromMon, addDays(fromMon, 6)), api.listShifts(toMon, addDays(toMon, 6))]).then(([a, b]) => { if (alive) { setSrc(a); setDst(b) } }).catch(e => alive && setErr((e as Error).message))
    return () => { alive = false }
  }, [fromMon, toMon])
  const plan = useMemo(() => src && dst ? copyWeek(src, fromMon, toMon, dst, mode, new Set(members.filter(m => m.active).map(m => m.id))) : null, [src, dst, fromMon, toMon, mode, members])
  const go = async () => {
    if (!plan) return
    try { if (plan.removed.length) await api.deleteShifts(plan.removed); if (plan.created.length) await api.saveShifts(plan.created); await onDone() } catch (e) { setErr((e as Error).message) }
  }
  return (
    <Modal title={dir === 'prev' ? 'Copia dalla settimana prima' : 'Copia nella settimana dopo'} onClose={onClose}>
      <p className="st-hint">Dalla settimana del {parseDay(fromMon).getDate()}/{parseDay(fromMon).getMonth() + 1} a quella del {parseDay(toMon).getDate()}/{parseDay(toMon).getMonth() + 1}. Straordinari, uscite anticipate e note non vengono copiati.</p>
      <div className="st-chips" role="group" aria-label="Come copiare">
        <button type="button" aria-pressed={mode === 'merge'} onClick={() => setMode('merge')}>Aggiungi dove è vuoto</button>
        <button type="button" aria-pressed={mode === 'replace'} onClick={() => setMode('replace')}>Sostituisci tutta la settimana</button>
      </div>
      {err && <div className="st-alert" role="alert">{err}</div>}
      {!plan && !err && <p className="st-hint">Calcolo…</p>}
      {plan && <p className="st-hint">{plan.created.length === 0 ? 'Non c’è niente da copiare.' : <>Verranno aggiunte <b>{plan.created.length}</b> voci{plan.removed.length > 0 && <>, dopo aver tolto le <b>{plan.removed.length}</b> già presenti</>}.</>}</p>}
      <div className="st-rowline"><button className="st-act" disabled={!plan || (plan.created.length === 0 && plan.removed.length === 0)} onClick={() => void go()}>Copia</button><button className="st-ghost" onClick={onClose}>Annulla</button></div>
    </Modal>
  )
}
