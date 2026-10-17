import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import type { DocCategory, HaccpDocument, CleanFreq, EquipKind, HaccpCleanLog, HaccpEquipment, HaccpNc, HaccpReading, HaccpTask, StaffCert, StaffMember } from '../api/types'
import { isoDay } from '../booking'
import { downloadCsv } from '../backup'
import { DOC_CAT, fmtSize, openDoc, CERT_LABEL, FREQ_LABEL, KIND_LABEL, certState, cleanDone, fmtDay, fmtHM, fmtTemp, parseTemp, slotStatus, useHaccp } from '../haccp'

type Sec = 'oggi' | 'nc' | 'apparecchi' | 'pulizie' | 'attestati' | 'documenti' | 'registro'
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2))
const SLOT_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** HACCP per la proprietà: cruscotto, non conformità, configurazione, attestati, registro. */
export default function HaccpOwner() {
  const { data, error, reload } = useHaccp()
  const [sec, setSec] = useState<Sec>('oggi')
  const [err, setErr] = useState<string | null>(null)
  const run = async (f: () => Promise<void>) => { try { setErr(null); await f(); await reload() } catch (e) { setErr((e as Error).message) } }
  if (error) return <div className="st-pane"><div className="st-alert" role="alert">{error}. Se è la prima volta, esegui lo script SQL supabase/sql/04_haccp.sql.</div></div>
  if (!data) return <div className="st-pane"><p className="st-hint">Caricamento…</p></div>
  const open = data.ncs.filter(n => n.status === 'aperta').length
  const secs: [Sec, string][] = [['oggi', 'Oggi'], ['nc', `Non conformità${open ? ` (${open})` : ''}`], ['apparecchi', 'Frigo e soglie'], ['pulizie', 'Pulizie'], ['attestati', 'Attestati'], ['documenti', 'Documenti'], ['registro', 'Registro']]
  return (
    <div className="st-pane wide">
      <div className="st-chips" role="tablist">{secs.map(([id, l]) => <button key={id} role="tab" aria-selected={sec === id} onClick={() => setSec(id)}>{l}</button>)}</div>
      {err && <div className="st-alert inline" role="alert">{err}</div>}
      {sec === 'oggi' && <Today data={data} go={setSec} />}
      {sec === 'nc' && <NcList ncs={data.ncs} run={run} />}
      {sec === 'apparecchi' && <Equipment list={data.equipment} run={run} />}
      {sec === 'pulizie' && <Tasks list={data.tasks} run={run} />}
      {sec === 'attestati' && <Certs />}
      {sec === 'documenti' && <Documents />}
      {sec === 'registro' && <Register />}
    </div>
  )
}

function Today({ data, go }: { data: ReturnType<typeof useHaccp>['data'] & object; go: (s: Sec) => void }) {
  const eqs = data.equipment.filter(e => e.active), tasks = data.tasks.filter(t => t.active)
  const daily = tasks.filter(t => t.frequency === 'giornaliera')
  const missing = eqs.map(e => ({ e, st: slotStatus(e, data.today) })).filter(x => x.st.missing > 0)
  const outs = data.today.filter(r => !r.in_range)
  const open = data.ncs.filter(n => n.status === 'aperta')
  const todo = tasks.filter(t => !cleanDone(t, data.cleaning))
  const dailyDone = daily.filter(t => cleanDone(t, data.cleaning)).length
  const ok = !missing.length && !open.length && !todo.length
  if (!eqs.length && !tasks.length) return <div className="st-empty big">HACCP non ancora configurato.<br /><small style={{ fontSize: 14 }}>Inserisci frigo e congelatori in “Frigo e soglie”, poi i compiti in “Pulizie”.</small></div>
  return (
    <>
      <div className={`st-alert${ok ? '' : ''}`} role="status" style={ok ? { background: '#e8f3ea', color: '#245b30' } : undefined}>{ok ? 'Tutto in regola per ora.' : 'Ci sono cose da controllare.'}</div>
      <section className="st-sheet"><h2 className="st-h3">Temperature di oggi</h2>
        <ul className="st-rows">
          {eqs.map(e => { const st = slotStatus(e, data.today), rs = data.today.filter(r => r.equipment_id === e.id); return (
            <li key={e.id} className="st-row"><div className="st-row-main"><div className="st-row-title">{e.name}<small>{fmtTemp(e.temp_min)} / {fmtTemp(e.temp_max)}</small></div>
              <div className="st-row-tags">{st.missing > 0 && <span className="st-pill unpaid">Mancano {st.missing}</span>}{rs.map(r => <span key={r.id} className={`st-pill ${r.in_range ? '' : 'unpaid'}`}>{fmtHM(r.at)} · {fmtTemp(r.value)} · {r.operator}</span>)}</div></div></li>) })}
          {!eqs.length && <li className="st-empty">Nessun apparecchio.</li>}
        </ul>
        {outs.length > 0 && <p className="st-hint">Fuori soglia oggi: {outs.length}.</p>}
      </section>
      <section className="st-sheet"><h2 className="st-h3">Pulizie</h2>
        <p className="st-hint">Giornaliere fatte: {dailyDone} su {daily.length}. Da fare in questo periodo: {todo.length}.</p>
        {todo.length > 0 && <ul className="st-rows">{todo.map(t => <li key={t.id} className="st-row"><div className="st-row-main"><div className="st-row-title">{t.name}<small>{t.area} · {t.frequency}</small></div></div></li>)}</ul>}
      </section>
      <section className="st-sheet"><h2 className="st-h3">Non conformità aperte: {open.length}</h2>
        {open.length > 0 && <button className="st-ghost" onClick={() => go('nc')}>Vai a chiuderle</button>}
      </section>
    </>
  )
}

function NcList({ ncs, run }: { ncs: HaccpNc[]; run: (f: () => Promise<void>) => Promise<void> }) {
  const [sel, setSel] = useState<string | null>(null)
  const [cause, setCause] = useState(''), [res, setRes] = useState('')
  const close = (id: string) => run(async () => { await api.closeHaccpNc(id, cause, res); setSel(null); setCause(''); setRes('') })
  if (!ncs.length) return <div className="st-empty big">Nessuna non conformità.<br /><small style={{ fontSize: 14 }}>Se una temperatura esce dai limiti se ne apre una da sola.</small></div>
  return (
    <ul className="st-rows">
      {ncs.map(n => (
        <li key={n.id} className="st-row" style={{ flexWrap: 'wrap' }}>
          <div className="st-row-main"><div className="st-row-title">{n.description}<small>aperta il {fmtDay(n.opened_at.slice(0, 10))} {fmtHM(n.opened_at)}</small></div>
            <div className="st-row-tags"><span className={`st-pill ${n.status === 'aperta' ? 'unpaid' : ''}`}>{n.status === 'aperta' ? 'Aperta' : 'Chiusa'}</span>{n.cause && <span className="st-pill">Causa: {n.cause}</span>}{n.resolution && <span className="st-pill">Soluzione: {n.resolution}</span>}</div></div>
          {n.status === 'aperta' && sel !== n.id && <div className="st-row-tools"><button className="st-ghost" onClick={() => { setSel(n.id); setCause(''); setRes('') }}>Chiudi</button></div>}
          {sel === n.id && (
            <div className="st-form" style={{ width: '100%' }}>
              <div className="st-field"><label htmlFor="nc-c">Causa</label><input id="nc-c" maxLength={300} value={cause} onChange={e => setCause(e.target.value)} placeholder="es. porta lasciata aperta" /></div>
              <div className="st-field"><label htmlFor="nc-r">Soluzione</label><input id="nc-r" maxLength={300} value={res} onChange={e => setRes(e.target.value)} placeholder="es. temperatura rientrata dopo 1 ora" /></div>
              <div className="st-actions"><button className="st-act" disabled={!cause.trim() || !res.trim()} onClick={() => close(n.id)}>Chiudi non conformità</button><button className="st-act alt" onClick={() => setSel(null)}>Annulla</button></div>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

const blankEq = (sort: number): HaccpEquipment => ({ id: newId(), name: '', kind: 'frigo', temp_min: 0, temp_max: 4, slots: ['09:00', '17:00'], active: true, sort })
function Equipment({ list, run }: { list: HaccpEquipment[]; run: (f: () => Promise<void>) => Promise<void> }) {
  const [f, setF] = useState<HaccpEquipment | null>(null)
  const [mn, setMn] = useState(''), [mx, setMx] = useState(''), [sl, setSl] = useState('')
  const [e, setE] = useState<string | null>(null)
  const edit = (x: HaccpEquipment) => { setF(x); setMn(String(x.temp_min).replace('.', ',')); setMx(String(x.temp_max).replace('.', ',')); setSl(x.slots.join(', ')); setE(null) }
  const submit = () => {
    if (!f) return
    const a = parseTemp(mn), b = parseTemp(mx), slots = sl.split(/[ ,;]+/).filter(Boolean)
    if (!f.name.trim()) return setE('Scrivi il nome.')
    if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b) return setE('Soglie non valide: il minimo deve essere sotto il massimo.')
    if (slots.some(s => !SLOT_RE.test(s))) return setE('Orari nel formato 09:00, 17:00.')
    void run(async () => { await api.saveHaccpEquipment({ ...f, temp_min: a, temp_max: b, slots }); setF(null) })
  }
  return (
    <>
      <div className="st-rowline"><button className="st-act" onClick={() => edit(blankEq(list.length + 1))}>Aggiungi frigo o congelatore</button></div>
      {f && (
        <section className="st-sheet"><h2 className="st-h3">{list.some(x => x.id === f.id) ? 'Modifica' : 'Nuovo'}</h2>
          {e && <div className="st-alert inline" role="alert">{e}</div>}
          <div className="st-form">
            <div className="st-field"><label htmlFor="en">Nome</label><input id="en" value={f.name} maxLength={60} onChange={x => setF({ ...f, name: x.target.value })} placeholder="es. Frigo dolci" /></div>
            <div className="st-field"><label htmlFor="ek">Tipo</label><select id="ek" value={f.kind} onChange={x => setF({ ...f, kind: x.target.value as EquipKind })}>{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <div className="st-field"><label htmlFor="emn">Minimo (°C)</label><input id="emn" inputMode="decimal" value={mn} onChange={x => setMn(x.target.value)} /></div>
            <div className="st-field"><label htmlFor="emx">Massimo (°C)</label><input id="emx" inputMode="decimal" value={mx} onChange={x => setMx(x.target.value)} /><small>Frigo di solito 0 / 4, congelatore −24 / −18.</small></div>
            <div className="st-field"><label htmlFor="es">Orari delle rilevazioni</label><input id="es" value={sl} onChange={x => setSl(x.target.value)} placeholder="09:00, 17:00" /></div>
          </div>
          <div className="st-actions"><button className="st-act" onClick={submit}>Salva</button><button className="st-act alt" onClick={() => setF(null)}>Annulla</button></div>
        </section>
      )}
      <ul className="st-rows">
        {list.length === 0 && <li className="st-empty">Nessun apparecchio ancora.</li>}
        {list.map(x => (
          <li key={x.id} className="st-row"><div className="st-row-main"><div className="st-row-title">{x.name}<small>{KIND_LABEL[x.kind]} · {fmtTemp(x.temp_min)} / {fmtTemp(x.temp_max)} · {x.slots.join(', ') || 'senza orari'}</small></div>{!x.active && <div className="st-row-tags"><span className="st-pill">Disattivato</span></div>}</div>
            <div className="st-row-tools"><button className="st-ghost" onClick={() => edit(x)}>Modifica</button><button className="st-ghost" onClick={() => run(() => api.saveHaccpEquipment({ ...x, active: !x.active }))}>{x.active ? 'Disattiva' : 'Riattiva'}</button></div></li>
        ))}
      </ul>
      <p className="st-hint">Le rilevazioni passate non cambiano se modifichi le soglie, e un apparecchio non si cancella: si disattiva.</p>
    </>
  )
}

function Tasks({ list, run }: { list: HaccpTask[]; run: (f: () => Promise<void>) => Promise<void> }) {
  const [f, setF] = useState<HaccpTask | null>(null)
  const [e, setE] = useState<string | null>(null)
  const submit = () => {
    if (!f) return
    if (!f.name.trim() || !f.area.trim()) return setE('Scrivi zona e compito.')
    void run(async () => { await api.saveHaccpTask(f); setF(null) })
  }
  return (
    <>
      <div className="st-rowline"><button className="st-act" onClick={() => { setF({ id: newId(), area: 'Cucina', name: '', frequency: 'giornaliera', sort: list.length + 1, active: true }); setE(null) }}>Aggiungi compito</button></div>
      {f && (
        <section className="st-sheet"><h2 className="st-h3">{list.some(x => x.id === f.id) ? 'Modifica compito' : 'Nuovo compito'}</h2>
          {e && <div className="st-alert inline" role="alert">{e}</div>}
          <div className="st-form">
            <div className="st-field"><label htmlFor="ta">Zona</label><input id="ta" value={f.area} maxLength={40} onChange={x => setF({ ...f, area: x.target.value })} placeholder="Cucina, Sala, Bagno…" /></div>
            <div className="st-field"><label htmlFor="tn">Compito</label><input id="tn" value={f.name} maxLength={100} onChange={x => setF({ ...f, name: x.target.value })} placeholder="es. Sanificare piani di lavoro" /></div>
            <div className="st-field"><label htmlFor="tf">Frequenza</label><select id="tf" value={f.frequency} onChange={x => setF({ ...f, frequency: x.target.value as CleanFreq })}>{Object.entries(FREQ_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          </div>
          <div className="st-actions"><button className="st-act" onClick={submit}>Salva</button><button className="st-act alt" onClick={() => setF(null)}>Annulla</button></div>
        </section>
      )}
      <ul className="st-rows">
        {list.length === 0 && <li className="st-empty">Nessun compito ancora.</li>}
        {list.map(t => (
          <li key={t.id} className="st-row"><div className="st-row-main"><div className="st-row-title">{t.name}<small>{t.area} · {FREQ_LABEL[t.frequency]}</small></div>{!t.active && <div className="st-row-tags"><span className="st-pill">Disattivato</span></div>}</div>
            <div className="st-row-tools"><button className="st-ghost" onClick={() => { setF(t); setE(null) }}>Modifica</button><button className="st-ghost" onClick={() => run(() => api.saveHaccpTask({ ...t, active: !t.active }))}>{t.active ? 'Disattiva' : 'Riattiva'}</button></div></li>
        ))}
      </ul>
    </>
  )
}

function Certs() {
  const [certs, setCerts] = useState<StaffCert[] | null>(null)
  const [members, setMembers] = useState<StaffMember[]>([])
  const [f, setF] = useState<StaffCert | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const load = useCallback(async () => { try { const [c, m] = await Promise.all([api.listCertificates(), api.listStaff()]); setCerts(c); setMembers(m); setErr(null) } catch (e) { setErr((e as Error).message) } }, [])
  useEffect(() => { void load() }, [load])
  const name = (id: string) => members.find(m => m.id === id)?.name ?? '—'
  const save = async () => {
    if (!f) return
    if (!f.member_id || !f.kind.trim() || !f.expires_on) return setErr('Scegli la persona, il tipo di attestato e la scadenza.')
    try { await api.saveCertificate(f); setF(null); await load() } catch (e) { setErr((e as Error).message) }
  }
  const del = async (id: string) => { try { await api.deleteCertificate(id); await load() } catch (e) { setErr((e as Error).message) } }
  const active = members.filter(m => m.active)
  return (
    <>
      {err && <div className="st-alert inline" role="alert">{err}</div>}
      <div className="st-rowline"><button className="st-act" disabled={!active.length} onClick={() => { setF({ id: newId(), member_id: active[0]?.id ?? '', kind: 'HACCP', issued_on: null, expires_on: '', note: null }); setErr(null) }}>Aggiungi attestato</button></div>
      {!active.length && <p className="st-hint">Prima aggiungi le persone in Personale e turni.</p>}
      {f && (
        <section className="st-sheet"><h2 className="st-h3">Attestato</h2>
          <div className="st-form">
            <div className="st-field"><label htmlFor="cm">Persona</label><select id="cm" value={f.member_id} onChange={x => setF({ ...f, member_id: x.target.value })}>{active.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
            <div className="st-field"><label htmlFor="ck">Tipo</label><input id="ck" value={f.kind} maxLength={60} onChange={x => setF({ ...f, kind: x.target.value })} placeholder="HACCP, Antincendio, Primo soccorso…" /></div>
            <div className="st-field"><label htmlFor="ci">Rilasciato il (facoltativo)</label><input id="ci" type="date" value={f.issued_on ?? ''} onChange={x => setF({ ...f, issued_on: x.target.value || null })} /></div>
            <div className="st-field"><label htmlFor="ce">Scade il</label><input id="ce" type="date" value={f.expires_on} onChange={x => setF({ ...f, expires_on: x.target.value })} /></div>
            <div className="st-field"><label htmlFor="cn">Nota (facoltativa)</label><input id="cn" value={f.note ?? ''} maxLength={200} onChange={x => setF({ ...f, note: x.target.value || null })} /></div>
          </div>
          <div className="st-actions"><button className="st-act" onClick={save}>Salva</button><button className="st-act alt" onClick={() => setF(null)}>Annulla</button></div>
        </section>
      )}
      {certs === null ? <p className="st-hint">Carico…</p> : (
        <ul className="st-rows">
          {certs.length === 0 && <li className="st-empty">Nessun attestato registrato.</li>}
          {certs.map(c => { const s = certState(c.expires_on); return (
            <li key={c.id} className="st-row"><div className="st-row-main"><div className="st-row-title">{name(c.member_id)} · {c.kind}<small>scade il {fmtDay(c.expires_on)}{c.note ? ` · ${c.note}` : ''}</small></div>
              <div className="st-row-tags"><span className={`st-pill ${s === 'valido' ? '' : s === 'scaduto' ? 'unpaid' : 'preparing'}`}>{CERT_LABEL[s]}</span></div></div>
              <div className="st-row-tools"><button className="st-ghost" onClick={() => setF(c)}>Modifica</button><button className="st-ghost" onClick={() => del(c.id)}>Elimina</button></div></li>) })}
        </ul>
      )}
    </>
  )
}

function Register() {
  const [days, setDays] = useState(30)
  const [reads, setReads] = useState<HaccpReading[] | null>(null)
  const [cl, setCl] = useState<HaccpCleanLog[]>([])
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    const to = new Date(), from = new Date(); from.setDate(from.getDate() - days)
    Promise.all([api.listHaccpReadings(isoDay(from), isoDay(to)), api.listHaccpCleaning(isoDay(from), isoDay(to))]).then(([r, c]) => { setReads(r); setCl(c) }).catch(e => setErr((e as Error).message))
  }, [days])
  return (
    <>
      <div className="st-rowline" style={{ justifyContent: 'space-between' }}>
        <div className="st-chips">{[7, 30, 90].map(d => <button key={d} role="tab" aria-selected={days === d} onClick={() => setDays(d)}>{d} giorni</button>)}</div>
        <div className="st-rowline">
          <button className="st-act alt" disabled={!reads?.length} onClick={() => downloadCsv('haccp-temperature.csv', ['Giorno', 'Ora', 'Apparecchio', 'Temperatura °C', 'Minimo', 'Massimo', 'In soglia', 'Azione correttiva', 'Operatore'], reads!.map(r => [r.day, fmtHM(r.at), r.equipment_name, r.value, r.limit_min, r.limit_max, r.in_range ? 'sì' : 'NO', r.corrective_action, r.operator]))}>Temperature (CSV)</button>
          <button className="st-act alt" disabled={!cl.length} onClick={() => downloadCsv('haccp-pulizie.csv', ['Giorno', 'Ora', 'Zona', 'Compito', 'Operatore', 'Nota'], cl.map(c => [c.day, fmtHM(c.at), c.area, c.task_name, c.operator, c.note]))}>Pulizie (CSV)</button>
        </div>
      </div>
      {err && <div className="st-alert inline" role="alert">{err}</div>}
      {reads === null && !err ? <p className="st-hint">Carico…</p> : (
        <div className="st-tablewrap"><table className="st-table">
          <thead><tr><th>Giorno</th><th>Apparecchio</th><th className="r">°C</th><th>Esito</th><th>Chi</th></tr></thead>
          <tbody>
            {reads?.length === 0 && <tr><td colSpan={5}>Nessuna rilevazione in questo periodo.</td></tr>}
            {reads?.map(r => <tr key={r.id}><td>{fmtDay(r.day)} {fmtHM(r.at)}</td><td>{r.equipment_name}</td><td className="r tnum">{fmtTemp(r.value)}</td><td style={r.in_range ? undefined : { color: '#a33', fontWeight: 600 }}>{r.in_range ? 'ok' : `fuori soglia${r.corrective_action ? `: ${r.corrective_action}` : ''}`}</td><td>{r.operator}</td></tr>)}
          </tbody>
        </table></div>
      )}
    </>
  )
}

function Documents() {
  const [docs, setDocs] = useState<HaccpDocument[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [showOld, setShowOld] = useState(false)
  const [form, setForm] = useState(false)
  const [title, setTitle] = useState(''), [cat, setCat] = useState<DocCategory>('piano'), [rev, setRev] = useState(''), [date, setDate] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => { try { setDocs(await api.listHaccpDocuments()); setErr(null) } catch (e) { setErr((e as Error).message) } }, [])
  useEffect(() => { void load(); return api.subscribe(() => { void load() }) }, [load])
  const reset = () => { setForm(false); setTitle(''); setRev(''); setDate(''); setFile(null); setCat('piano') }
  const save = async () => {
    if (!title.trim()) return setErr('Scrivi il titolo.')
    if (!file) return setErr('Scegli il file (PDF o foto).')
    setBusy(true)
    try { await api.addHaccpDocument({ title, category: cat, revision: rev || null, doc_date: date || null }, file); reset(); setErr(null); await load() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const open = async (d: HaccpDocument) => { try { setErr(null); await openDoc(d) } catch (e) { setErr((e as Error).message) } }
  const toggle = async (d: HaccpDocument) => { try { await api.setHaccpDocumentActive(d.id, !d.active); await load() } catch (e) { setErr((e as Error).message) } }
  if (docs === null && !err) return <p className="st-hint">Carico…</p>
  const list = (docs ?? []).filter(d => showOld || d.active)
  return (
    <>
      {err && <div className="st-alert inline" role="alert">{err}</div>}
      <div className="st-rowline"><button className="st-act" onClick={() => { setForm(true); setErr(null) }}>Carica documento</button>
        <button className="st-act alt" onClick={() => setShowOld(v => !v)}>{showOld ? 'Nascondi archiviati' : 'Mostra archiviati'}</button></div>
      {form && (
        <section className="st-sheet"><h2 className="st-h3">Nuovo documento</h2>
          <div className="st-form">
            <div className="st-field"><label htmlFor="dt">Titolo</label><input id="dt" value={title} maxLength={120} onChange={e => setTitle(e.target.value)} placeholder="es. Piano di autocontrollo" /></div>
            <div className="st-field"><label htmlFor="dc">Tipo</label><select id="dc" value={cat} onChange={e => setCat(e.target.value as DocCategory)}>{Object.entries(DOC_CAT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <div className="st-field"><label htmlFor="dr">Revisione (facoltativa)</label><input id="dr" value={rev} maxLength={20} onChange={e => setRev(e.target.value)} placeholder="es. 0, 1, 2" /></div>
            <div className="st-field"><label htmlFor="dd">Data del documento (facoltativa)</label><input id="dd" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div className="st-field"><label htmlFor="df">File (PDF o foto, fino a 10 MB)</label><input id="df" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)} /></div>
          </div>
          <div className="st-actions"><button className="st-act" disabled={busy} onClick={save}>{busy ? 'Carico…' : 'Salva'}</button><button className="st-act alt" onClick={reset}>Annulla</button></div>
        </section>
      )}
      <ul className="st-rows">
        {list.length === 0 && <li className="st-empty">Nessun documento ancora. Carica il piano di autocontrollo firmato e le procedure.</li>}
        {list.map(d => (
          <li key={d.id} className="st-row"><div className="st-row-main"><div className="st-row-title">{d.title}<small>{DOC_CAT[d.category]}{d.revision ? ` · rev. ${d.revision}` : ''}{d.doc_date ? ` · ${fmtDay(d.doc_date)}` : ''} · {fmtSize(d.size)}</small></div>{!d.active && <div className="st-row-tags"><span className="st-pill">Archiviato</span></div>}</div>
            <div className="st-row-tools"><button className="st-ghost" onClick={() => open(d)}>Apri</button><button className="st-ghost" onClick={() => toggle(d)}>{d.active ? 'Archivia' : 'Ripristina'}</button></div></li>
        ))}
      </ul>
      <p className="st-hint">I documenti sono visibili alla cucina e alla proprietà. Un documento superato si archivia: non si cancella, così resta la storia delle revisioni.</p>
    </>
  )
}
