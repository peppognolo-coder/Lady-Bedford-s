import { useEffect, useState } from 'react'
import { api } from '../api'
import type { HaccpEquipment } from '../api/types'
import { isoDay } from '../booking'
import { KIND_LABEL, cleanDone, fmtHM, fmtTemp, loadOp, parseTemp, saveOp, slotStatus, useHaccp } from '../haccp'

/** HACCP in cucina: chi sei, temperature di frigo e congelatori, lista pulizie. */
export default function HaccpKitchen() {
  const { data, error, reload } = useHaccp()
  const [ops, setOps] = useState<{ id: string; name: string }[] | null>(null)
  const [op, setOp] = useState(loadOp())
  const [view, setView] = useState<'temp' | 'clean'>('temp')
  const [sheet, setSheet] = useState<HaccpEquipment | null>(null)
  const [val, setVal] = useState('')
  const [action, setAction] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { api.haccpOperators().then(setOps).catch(e => { setOps([]); setErr((e as Error).message) }) }, [])
  const pick = (n: string) => { setOp(n); saveOp(n) }

  const eq = sheet
  const n = parseTemp(val)
  const valid = val.trim() !== '' && Number.isFinite(n) && n > -60 && n < 60
  const out = !!eq && valid && (n < eq.temp_min || n > eq.temp_max)

  const submit = async () => {
    if (!eq) return
    if (!op) return setErr('Scegli prima chi sei.')
    if (!valid) return setErr('Scrivi la temperatura, per esempio 3,5.')
    if (out && !action.trim()) return setErr('Fuori soglia: scrivi cosa hai fatto.')
    setBusy(true)
    try { await api.logTemperature(eq.id, n, out ? action.trim() : null, op); setSheet(null); setVal(''); setAction(''); setErr(null); await reload() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const tick = async (id: string) => {
    if (!op) return setErr('Scegli prima chi sei.')
    try { setErr(null); await api.tickCleaning(id, op); await reload() } catch (e) { setErr((e as Error).message) }
  }

  if (error) return <div className="st-pane"><div className="st-alert" role="alert">{error}. Se è la prima volta, esegui lo script SQL supabase/sql/04_haccp.sql.</div></div>
  if (!data || !ops) return <div className="st-pane"><p className="st-hint">Caricamento…</p></div>
  const eqs = data.equipment.filter(e => e.active)
  const tasks = data.tasks.filter(t => t.active)
  const openNcs = data.ncs.filter(x => x.status === 'aperta')

  return (
    <div className="st-pane">
      {err && <div className="st-alert inline" role="alert">{err}</div>}
      <section className="st-sheet" aria-label="Chi sei">
        <div className="st-field"><label htmlFor="hop">Chi sta registrando?</label>
          <select id="hop" value={op} onChange={e => pick(e.target.value)}>
            <option value="">— scegli il tuo nome —</option>
            {ops.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
          </select>
          {ops.length === 0 && <small>Nessuna persona di cucina in elenco: la proprietà le aggiunge in Personale → Persone (ruolo Cucina).</small>}
        </div>
      </section>
      {openNcs.length > 0 && <div className="st-alert" role="alert"><b>Non conformità aperte:</b> {openNcs.map(x => x.description).join(' · ')}. La proprietà deve chiuderle.</div>}
      <div className="st-chips" role="tablist">
        <button role="tab" aria-selected={view === 'temp'} onClick={() => setView('temp')}>Temperature</button>
        <button role="tab" aria-selected={view === 'clean'} onClick={() => setView('clean')}>Pulizie</button>
      </div>

      {view === 'temp' && (
        <>
          {sheet && (
            <section className="st-sheet" aria-label="Nuova rilevazione">
              <h2 className="st-h3">{sheet.name}</h2>
              <div className="st-form">
                <div className="st-field"><label htmlFor="tv">Temperatura letta (°C)</label>
                  <input id="tv" inputMode="decimal" autoFocus value={val} onChange={e => setVal(e.target.value)} placeholder="es. 3,5" />
                  <small>Limite: da {fmtTemp(sheet.temp_min)} a {fmtTemp(sheet.temp_max)}</small></div>
                {out && <div className="st-alert inline" role="alert"><b>Fuori soglia.</b> Scrivi cosa hai fatto (es. controllata la porta, spostato il cibo, chiamato il tecnico). Si aprirà una non conformità.</div>}
                {out && <div className="st-field"><label htmlFor="ta">Azione correttiva</label><input id="ta" value={action} maxLength={300} onChange={e => setAction(e.target.value)} /></div>}
              </div>
              <div className="st-actions"><button className="st-act" disabled={busy} onClick={submit}>Registra</button><button className="st-act alt" onClick={() => { setSheet(null); setErr(null) }}>Annulla</button></div>
            </section>
          )}
          {eqs.length === 0 ? <div className="st-empty big">Nessun frigo o congelatore inserito.<br /><small style={{ fontSize: 14 }}>La proprietà li aggiunge in Proprietà → HACCP.</small></div> : (
            <ul className="st-rows">
              {eqs.map(e => {
                const st = slotStatus(e, data.today)
                const mine = data.today.filter(r => r.equipment_id === e.id)
                return (
                  <li key={e.id} className="st-row">
                    <div className="st-row-main">
                      <div className="st-row-title">{e.name}<small>{KIND_LABEL[e.kind]} · {fmtTemp(e.temp_min)} / {fmtTemp(e.temp_max)}{e.slots.length ? ` · orari ${e.slots.join(', ')}` : ''}</small></div>
                      <div className="st-row-tags">
                        {st.missing > 0 && <span className="st-pill unpaid">Da registrare ({st.missing})</span>}
                        {mine.map(r => <span key={r.id} className={`st-pill ${r.in_range ? '' : 'unpaid'}`}>{fmtHM(r.at)} · {fmtTemp(r.value)}{r.in_range ? '' : ' ⚠'}</span>)}
                        {mine.length === 0 && st.missing === 0 && <span className="st-pill">Nessuna oggi</span>}
                      </div>
                    </div>
                    <div className="st-row-tools"><button className="st-ghost" onClick={() => { setSheet(e); setVal(''); setAction(''); setErr(null) }}>Registra</button></div>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="st-hint">Le rilevazioni non si cancellano. Se hai sbagliato, registra la temperatura giusta: resta traccia di entrambe.</p>
        </>
      )}

      {view === 'clean' && (
        tasks.length === 0 ? <div className="st-empty big">Nessun compito di pulizia inserito.<br /><small style={{ fontSize: 14 }}>La proprietà li aggiunge in Proprietà → HACCP.</small></div> : (
          <ul className="st-rows">
            {tasks.map(t => {
              const done = cleanDone(t, data.cleaning)
              return (
                <li key={t.id} className="st-row">
                  <div className="st-row-main">
                    <div className="st-row-title">{t.name}<small>{t.area} · {t.frequency}</small></div>
                    <div className="st-row-tags">{done ? <span className="st-pill">Fatto {done.day === isoDay(new Date()) ? fmtHM(done.at) : done.day.slice(8) + '/' + done.day.slice(5, 7)} · {done.operator}</span> : <span className="st-pill unpaid">Da fare</span>}</div>
                  </div>
                  {!done && <div className="st-row-tools"><button className="st-ghost" onClick={() => tick(t.id)}>Fatto</button></div>}
                </li>
              )
            })}
          </ul>
        )
      )}
    </div>
  )
}
