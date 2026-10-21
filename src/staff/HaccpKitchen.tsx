import { useEffect, useState } from 'react'
import { api } from '../api'
import type { HaccpEquipment } from '../api/types'
import type { BlastMode, HaccpDocument, HaccpReading } from '../api/types'
import { DOC_CAT, fmtSize, openDoc } from '../haccp'
import { isoDay } from '../booking'
import { KIND_LABEL, cleanDone, fmtHM, fmtTemp, loadOp, parseTemp, saveOp, slotStatus, useHaccp } from '../haccp'

/** HACCP in cucina: chi sei, temperature di frigo e congelatori, lista pulizie. */
export default function HaccpKitchen() {
  const { data, error, reload } = useHaccp()
  const [ops, setOps] = useState<{ id: string; name: string }[] | null>(null)
  const [op, setOp] = useState(loadOp())
  const [view, setView] = useState<'temp' | 'clean' | 'docs'>('temp')
  const [sheet, setSheet] = useState<HaccpEquipment | null>(null)
  const [corr, setCorr] = useState<HaccpReading | null>(null)
  const [blast, setBlast] = useState<HaccpEquipment | null>(null)
  const [bf, setBf] = useState({ mode: 'positivo' as BlastMode, product: '', start: '', end: '', min: '', action: '' })
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
    try { await api.logTemperature(eq.id, n, out ? action.trim() : null, op, corr?.id ?? null); setSheet(null); setCorr(null); setVal(''); setAction(''); setErr(null); await reload() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const bEnd = parseTemp(bf.end), bStart = parseTemp(bf.start), bMin = Number(bf.min.replace(',', '.'))
  const bValid = bf.product.trim() !== '' && bf.start.trim() !== '' && bf.end.trim() !== '' && Number.isFinite(bStart) && Number.isFinite(bEnd) && Number.isInteger(bMin) && bMin >= 1 && bMin <= 1440
  const bOut = bValid && (bEnd > (bf.mode === 'positivo' ? 10 : -18) || bMin > (bf.mode === 'positivo' ? 90 : 240))
  const submitBlast = async () => {
    if (!blast) return
    if (!op) return setErr('Scegli prima chi sei.')
    if (!bValid) return setErr('Compila prodotto, temperature e minuti (numero intero).')
    if (bOut && !bf.action.trim()) return setErr('Fuori limite: scrivi cosa hai fatto.')
    setBusy(true)
    try { await api.logBlast(blast.id, bf.mode, bf.product.trim(), bStart, bEnd, bMin, bOut ? bf.action.trim() : null, op); setBlast(null); setBf({ mode: 'positivo', product: '', start: '', end: '', min: '', action: '' }); setErr(null); await reload() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
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
        <button role="tab" aria-selected={view === 'docs'} onClick={() => setView('docs')}>Documenti</button>
      </div>

      {view === 'temp' && (
        <>
          {sheet && (
            <section className="st-sheet" aria-label="Nuova rilevazione">
              <h2 className="st-h3">{corr ? 'Correzione' : 'Nuova rilevazione'}: {sheet.name}</h2>
              {corr && <p className="st-hint">Sostituisce la lettura delle {fmtHM(corr.at)} ({fmtTemp(corr.value)}). Quella vecchia resta nel registro, segnata come corretta.</p>}
              <div className="st-form">
                <div className="st-field"><label htmlFor="tv">Temperatura letta (°C)</label>
                  <input id="tv" inputMode="decimal" autoFocus value={val} onChange={e => setVal(e.target.value)} placeholder="es. 3,5" />
                  <small>Limite: da {fmtTemp(sheet.temp_min)} a {fmtTemp(sheet.temp_max)}</small></div>
                {out && <div className="st-alert inline" role="alert"><b>Fuori soglia.</b> Scrivi cosa hai fatto (es. controllata la porta, spostato il cibo, chiamato il tecnico). Si aprirà una non conformità.</div>}
                {out && <div className="st-field"><label htmlFor="ta">Azione correttiva</label><input id="ta" value={action} maxLength={300} onChange={e => setAction(e.target.value)} /></div>}
              </div>
              <div className="st-actions"><button className="st-act" disabled={busy} onClick={submit}>Registra</button><button className="st-act alt" onClick={() => { setSheet(null); setCorr(null); setErr(null) }}>Annulla</button></div>
            </section>
          )}
          {blast && (
            <section className="st-sheet" aria-label="Ciclo abbattitore">
              <h2 className="st-h3">Ciclo: {blast.name}</h2>
              <div className="st-form">
                <div className="st-field"><label htmlFor="bm">Tipo di ciclo</label><select id="bm" value={bf.mode} onChange={e => setBf({ ...bf, mode: e.target.value as BlastMode })}><option value="positivo">Raffreddamento (fino a +10 °C in 90 min)</option><option value="negativo">Surgelazione (fino a −18 °C in 240 min)</option></select></div>
                <div className="st-field"><label htmlFor="bp">Prodotto</label><input id="bp" value={bf.product} maxLength={80} onChange={e => setBf({ ...bf, product: e.target.value })} placeholder="es. crema pasticcera" /></div>
                <div className="st-field"><label htmlFor="bs">Temperatura all’inizio (°C)</label><input id="bs" inputMode="decimal" value={bf.start} onChange={e => setBf({ ...bf, start: e.target.value })} /></div>
                <div className="st-field"><label htmlFor="be">Temperatura alla fine (°C)</label><input id="be" inputMode="decimal" value={bf.end} onChange={e => setBf({ ...bf, end: e.target.value })} /></div>
                <div className="st-field"><label htmlFor="bt">Minuti impiegati</label><input id="bt" inputMode="numeric" value={bf.min} onChange={e => setBf({ ...bf, min: e.target.value })} /></div>
                {bOut && <div className="st-alert inline" role="alert"><b>Fuori limite.</b> Scrivi cosa hai fatto (es. ripetuto il ciclo, scartato il prodotto). Si aprirà una non conformità.</div>}
                {bOut && <div className="st-field"><label htmlFor="ba">Azione correttiva</label><input id="ba" value={bf.action} maxLength={300} onChange={e => setBf({ ...bf, action: e.target.value })} /></div>}
              </div>
              <div className="st-actions"><button className="st-act" disabled={busy} onClick={submitBlast}>Registra ciclo</button><button className="st-act alt" onClick={() => { setBlast(null); setErr(null) }}>Annulla</button></div>
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
                        {mine.map(r => <span key={r.id} className={`st-pill ${r.in_range ? '' : 'unpaid'}`} style={mine.some(x => x.corrects_id === r.id) ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}>{fmtHM(r.at)} · {fmtTemp(r.value)}{r.in_range ? '' : ' ⚠'}</span>)}
                        {e.kind === 'abbattitore' && data.blasts.filter(b => b.equipment_id === e.id).map(b => <span key={b.id} className={`st-pill ${b.in_range ? '' : 'unpaid'}`}>{fmtHM(b.at)} · {b.product} · {fmtTemp(b.end_temp)} in {b.minutes} min{b.in_range ? '' : ' ⚠'}</span>)}
                        {mine.length === 0 && st.missing === 0 && !(e.kind === 'abbattitore' && data.blasts.some(b => b.equipment_id === e.id)) && <span className="st-pill">Nessuna oggi</span>}
                      </div>
                    </div>
                    <div className="st-row-tools">
                      {e.kind === 'abbattitore'
                        ? <button className="st-ghost" onClick={() => { setBlast(e); setErr(null) }}>Ciclo</button>
                        : <><button className="st-ghost" onClick={() => { setSheet(e); setCorr(null); setVal(''); setAction(''); setErr(null) }}>Registra</button>
                          {mine.some(r => !mine.some(x => x.corrects_id === r.id)) && <button className="st-ghost" onClick={() => { const last = mine.find(r => !mine.some(x => x.corrects_id === r.id))!; setSheet(e); setCorr(last); setVal(''); setAction(''); setErr(null) }}>Correggi</button>}</>}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="st-hint">Le rilevazioni non si cancellano. Se hai sbagliato, tocca “Correggi”: resta traccia di entrambe.</p>
        </>
      )}

      {view === 'docs' && <KitchenDocs onError={setErr} />}

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

function KitchenDocs({ onError }: { onError: (m: string | null) => void }) {
  const [docs, setDocs] = useState<HaccpDocument[] | null>(null)
  useEffect(() => {
    const load = () => api.listHaccpDocuments().then(d => setDocs(d.filter(x => x.active))).catch(e => { setDocs([]); onError((e as Error).message) })
    void load(); return api.subscribe(() => { void load() })
  }, [onError])
  if (!docs) return <p className="st-hint">Caricamento…</p>
  if (!docs.length) return <div className="st-empty big">Nessun documento ancora.<br /><small style={{ fontSize: 14 }}>La proprietà carica qui il piano di autocontrollo e le procedure.</small></div>
  return (
    <ul className="st-rows">
      {docs.map(d => (
        <li key={d.id} className="st-row"><div className="st-row-main"><div className="st-row-title">{d.title}<small>{DOC_CAT[d.category]}{d.revision ? ` · rev. ${d.revision}` : ''} · {fmtSize(d.size)}</small></div></div>
          <div className="st-row-tools"><button className="st-ghost" onClick={async () => { try { onError(null); await openDoc(d) } catch (e) { onError((e as Error).message) } }}>Apri</button></div></li>
      ))}
    </ul>
  )
}
