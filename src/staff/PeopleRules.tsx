import { useState } from 'react'
import { api } from '../api'
import type { StaffConfig, StaffMember, StaffRole } from '../api/types'
import { ROLES, ROLE_LABEL, uid } from '../shifts'
import { Field } from './shared'

const num = (s: string) => { const n = parseFloat(s.replace(',', '.')); return Number.isFinite(n) ? n : NaN }

export function PeopleSection({ members, reload }: { members: StaffMember[]; reload: () => Promise<void> }) {
  const [edit, setEdit] = useState<StaffMember | null>(null)
  const [hours, setHours] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const run = async (f: () => Promise<void>) => { try { setErr(null); await f(); await reload() } catch (e) { setErr((e as Error).message) } }
  const start = (m?: StaffMember) => { const x = m ?? { id: uid(), name: '', role: 'sala' as StaffRole, weekly_hours: null, active: true, sort: Math.max(-1, ...members.map(y => y.sort)) + 1 }; setEdit(x); setHours(x.weekly_hours === null ? '' : String(x.weekly_hours).replace('.', ',')) }
  const save = () => {
    if (!edit) return
    if (!edit.name.trim()) return setErr('Scrivi il nome.')
    const h = hours.trim() === '' ? null : num(hours)
    if (h !== null && (!(h >= 0) || h > 80)) return setErr('Le ore settimanali devono essere tra 0 e 80.')
    void run(async () => { await api.saveStaff({ ...edit, name: edit.name.trim(), weekly_hours: h }); setEdit(null) })
  }
  const list = [...members].sort((a, b) => Number(b.active) - Number(a.active) || a.sort - b.sort)
  return (
    <section className="st-sheet flat">
      <div className="st-rowline" style={{ justifyContent: 'space-between' }}>
        <h2 className="st-h3">Persone</h2>
        <button className="st-act" style={{ minHeight: 44, fontSize: 16 }} onClick={() => start()}>Aggiungi persona</button>
      </div>
      <p className="st-hint">Solo la proprietà vede questa sezione. Le ore settimanali da contratto sono facoltative: servono per il saldo e per avvisarti se superi il monte ore.</p>
      {err && <div className="st-alert" role="alert">{err}</div>}
      {edit && (
        <div className="st-sheet" aria-label="Scheda persona">
          <div className="st-form">
            <Field label="Nome" id="pp-n"><input id="pp-n" value={edit.name} maxLength={60} onChange={e => setEdit({ ...edit, name: e.target.value })} autoFocus /></Field>
            <Field label="Ruolo" id="pp-r"><select id="pp-r" value={edit.role} onChange={e => setEdit({ ...edit, role: e.target.value as StaffRole })}>{ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
            <Field label="Ore a settimana da contratto" id="pp-h" hint="Lascia vuoto se non serve."><input id="pp-h" inputMode="decimal" value={hours} onChange={e => setHours(e.target.value)} /></Field>
          </div>
          <div className="st-rowline"><button className="st-act" onClick={save}>Salva</button><button className="st-ghost" onClick={() => setEdit(null)}>Annulla</button></div>
        </div>
      )}
      {list.length === 0 && <div className="st-empty">Ancora nessuna persona.</div>}
      <ul className="st-rows">
        {list.map(m => (
          <li key={m.id} className="st-row">
            <div className="st-row-main"><b>{m.name}</b><span className="st-sub">{ROLE_LABEL[m.role]}{m.weekly_hours ? ` · ${m.weekly_hours} ore a settimana` : ''}</span>
              {!m.active && <div className="st-row-tags"><span className="st-pill">Archiviata: non compare nei turni nuovi</span></div>}
            </div>
            <div className="st-rowline">
              <button className="st-ghost" onClick={() => start(m)}>Modifica</button>
              <button className="st-ghost" onClick={() => void run(() => api.saveStaff({ ...m, active: !m.active }))}>{m.active ? 'Archivia' : 'Riattiva'}</button>
              <button className="st-back" onClick={() => { if (confirm(`Eliminare ${m.name} e tutti i suoi turni? Non si può annullare. Se vuoi solo non farla più comparire, usa “Archivia”.`)) void run(() => api.deleteStaff(m.id)) }}>Elimina</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function RulesSection({ config, reload }: { config: StaffConfig; reload: () => Promise<void> }) {
  const [c, setC] = useState<StaffConfig>(config)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const setT = (i: number, p: Partial<StaffConfig['templates'][number]>) => setC(o => ({ ...o, templates: o.templates.map((t, k) => (k === i ? { ...t, ...p } : t)) }))
  const save = async () => {
    for (const t of c.templates) {
      if (!t.label.trim()) return setErr('Ogni modello ha bisogno di un nome.')
      if (!(t.start < t.end)) return setErr(`Nel modello “${t.label}” l’inizio deve essere prima della fine.`)
    }
    try { setErr(null); await api.saveStaffConfig({ ...c, templates: c.templates.map(t => ({ ...t, label: t.label.trim() })) }); await reload(); setOk(true); setTimeout(() => setOk(false), 2200) } catch (e) { setErr((e as Error).message) }
  }
  return (
    <div className="st-pane">
      <section className="st-sheet flat">
        <h2 className="st-h3">Persone minime in apertura</h2>
        <p className="st-hint">Durante gli orari di apertura (li imposti in “Orari e impostazioni”) il planner ti segnala le ore in cui manca qualcuno. Metti 0 per non controllare un ruolo.</p>
        <div className="st-form">
          {ROLES.map(r => <Field key={r} label={ROLE_LABEL[r]} id={`rl-${r}`}><input id={`rl-${r}`} inputMode="numeric" value={c.min[r]} onChange={e => setC({ ...c, min: { ...c.min, [r]: Math.max(0, Math.min(20, parseInt(e.target.value.replace(/\D/g, '') || '0', 10))) } })} /></Field>)}
        </div>
      </section>
      <section className="st-sheet flat">
        <div className="st-rowline" style={{ justifyContent: 'space-between' }}>
          <h2 className="st-h3">Modelli di turno</h2>
          <button className="st-ghost" onClick={() => setC({ ...c, templates: [...c.templates, { id: uid(), label: '', start: '09:00', end: '17:00', break_min: 0 }] })}>Nuovo modello</button>
        </div>
        <p className="st-hint">Turni pronti da assegnare con un tocco. La pausa viene tolta dalle ore.</p>
        {c.templates.map((t, i) => (
          <div key={t.id} className="st-form st-tpl">
            <Field label="Nome" id={`tp-l-${i}`}><input id={`tp-l-${i}`} value={t.label} maxLength={30} onChange={e => setT(i, { label: e.target.value })} /></Field>
            <Field label="Dalle" id={`tp-s-${i}`}><input id={`tp-s-${i}`} type="time" value={t.start} onChange={e => setT(i, { start: e.target.value })} /></Field>
            <Field label="Alle" id={`tp-e-${i}`}><input id={`tp-e-${i}`} type="time" value={t.end} onChange={e => setT(i, { end: e.target.value })} /></Field>
            <Field label="Pausa (minuti)" id={`tp-b-${i}`}><input id={`tp-b-${i}`} inputMode="numeric" value={t.break_min} onChange={e => setT(i, { break_min: Math.max(0, Math.min(240, parseInt(e.target.value.replace(/\D/g, '') || '0', 10))) })} /></Field>
            <button className="st-back" onClick={() => setC({ ...c, templates: c.templates.filter((_, k) => k !== i) })}>Togli</button>
          </div>
        ))}
      </section>
      {err && <div className="st-alert" role="alert">{err}</div>}
      <div className="st-rowline"><button className="st-act" onClick={() => void save()}>Salva regole e modelli</button>{ok && <span className="st-flash-inline" role="status">Salvato</span>}</div>
    </div>
  )
}
