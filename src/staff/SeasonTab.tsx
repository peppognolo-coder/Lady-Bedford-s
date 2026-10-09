import { useMemo, useState } from 'react'
import { api, type Catalog } from '../api'
import type { Schedule } from '../api/types'
import { DAY_NAMES, catsOf } from '../catalog'
import { catKey, describeSchedule, isEmptySchedule, offerOf } from '../schedule'
import { Field, Switch } from './shared'

type Save = (f: () => Promise<void>, ok?: string) => Promise<boolean>
const ORDER = [1, 2, 3, 4, 5, 6, 0]
const year = new Date().getFullYear()
const PRESETS: { label: string; s: Schedule }[] = [
  { label: 'Menu di Natale', s: { from: `${year}-12-01`, to: `${year + 1}-01-06`, yearly: true } },
  { label: 'Primavera', s: { from: `${year}-03-20`, to: `${year}-06-20`, yearly: true } },
  { label: 'Estate', s: { from: `${year}-06-21`, to: `${year}-09-22`, yearly: true } },
  { label: 'Autunno', s: { from: `${year}-09-23`, to: `${year}-12-20`, yearly: true } },
  { label: 'Inverno', s: { from: `${year}-12-21`, to: `${year}-03-19`, yearly: true } },
  { label: 'Solo pomeriggio', s: { start: '15:00', end: '19:00' } },
  { label: 'Solo mattina', s: { start: '09:00', end: '12:00' } },
  { label: 'Solo weekend', s: { days: [6, 0] } },
  { label: 'Solo giorni feriali', s: { days: [1, 2, 3, 4, 5] } },
]
const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }

/** Menu stagionale: periodo dell'anno, giorni e fascia oraria per ogni prodotto o sezione. */
export default function SeasonTab({ catalog, save }: { catalog: Catalog; save: Save }) {
  const { menu, settings } = catalog
  const CATS = catsOf(catalog.content)
  const [edit, setEdit] = useState<string | null>(null)   // chiave: id prodotto o 'cat:<id>'
  const [draft, setDraft] = useState<Schedule>({})
  const [cat, setCat] = useState(catsOf(catalog.content)[0].id)
  const [err, setErr] = useState<string | null>(null)
  const [when, setWhen] = useState(nowLocal)
  const sch = settings.schedules ?? {}

  const open = (key: string) => { setEdit(key); setDraft({ ...(sch[key] ?? {}) }); setErr(null) }
  const nameOf = (key: string) => key.startsWith('cat:') ? 'Sezione ' + (CATS.find(c => c.id === key.slice(4))?.it ?? key) : menu.find(m => m.id === key)?.name.it ?? key
  const upd = (p: Partial<Schedule>) => setDraft(o => ({ ...o, ...p }))
  const toggleDay = (d: number) => upd({ days: draft.days?.includes(d) ? draft.days.filter(x => x !== d) : [...(draft.days ?? []), d] })

  const commit = async (next: Schedule | null) => {
    if (!edit) return
    if (next && !next.yearly && next.from && next.to && next.from > next.to) return setErr('La data di inizio deve venire prima di quella di fine.')
    if (next && next.start && next.end && next.start === next.end) return setErr('L’orario di inizio e di fine coincidono.')
    setErr(null)
    const schedules = { ...sch }
    if (!next || isEmptySchedule(next)) delete schedules[edit]
    else {
      const clean: Schedule = { ...next }
      if (!clean.days?.length || clean.days.length === 7) delete clean.days
      if (!clean.yearly) delete clean.yearly
      if (!clean.teaser) delete clean.teaser
      ;(['from', 'to', 'start', 'end'] as const).forEach(k => { if (!clean[k]) delete clean[k] })
      schedules[edit] = clean
    }
    if (await save(() => api.saveSettings({ ...settings, schedules }), next && !isEmptySchedule(next) ? 'Programmazione salvata' : 'Programmazione rimossa')) setEdit(null)
  }

  const at = useMemo(() => new Date(when || Date.now()), [when])
  const preview = useMemo(() => {
    const vis = menu.filter(m => m.visible), res = { on: 0, hide: [] as string[], teaser: [] as string[] }
    vis.forEach(m => { const o = offerOf(settings, m, at); if (o.state === 'on') res.on++; else if (o.state === 'hide') res.hide.push(m.name.it); else res.teaser.push(m.name.it) })
    return res
  }, [menu, settings, at])

  const scheduledCount = Object.values(sch).filter(s => !isEmptySchedule(s)).length
  const row = (key: string, title: string, sub?: string) => {
    const s = sch[key], on = !isEmptySchedule(s)
    return (
      <li key={key} className="st-row">
        <div className="st-row-main"><b>{title}</b>{sub && <span className="st-sub">{sub}</span>}
          <div className="st-row-tags"><span className={`st-pill ${on ? 'unpaid' : ''}`}>{describeSchedule(s)}</span>{on && s?.teaser && <span className="st-pill">Visibile come “in arrivo”</span>}</div>
        </div>
        <button className="st-ghost" onClick={() => open(key)}>{on ? 'Modifica' : 'Programma'}</button>
      </li>
    )
  }

  return (
    <div className="st-pane">
      <p className="st-hint">Decidi quando un prodotto o un’intera sezione compare nell’app e alla cassa: in certi periodi dell’anno (anche ogni anno), in certi giorni o solo in una fascia oraria. Senza programmazione resta sempre in menu. {scheduledCount > 0 && <b>{scheduledCount} programmazioni attive.</b>}</p>

      <section className="st-sheet">
        <h2 className="st-h3">Anteprima: cosa vede il cliente</h2>
        <div className="st-form"><Field label="Giorno e ora" id="se-when"><input id="se-when" type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} /></Field></div>
        <p className="st-hint"><b>{preview.on}</b> prodotti in menu{preview.teaser.length > 0 && <> · <b>{preview.teaser.length}</b> “in arrivo”: {preview.teaser.slice(0, 6).join(', ')}{preview.teaser.length > 6 ? '…' : ''}</>}{preview.hide.length > 0 && <> · <b>{preview.hide.length}</b> nascosti: {preview.hide.slice(0, 6).join(', ')}{preview.hide.length > 6 ? '…' : ''}</>}</p>
      </section>

      {edit && (
        <section className="st-sheet" aria-label="Programmazione">
          <h2 className="st-h3">{nameOf(edit)}</h2>
          <div className="st-chips" aria-label="Modelli pronti">
            {PRESETS.map(p => <button key={p.label} type="button" onClick={() => setDraft(o => ({ ...o, ...p.s, days: p.s.days ?? o.days }))}>{p.label}</button>)}
          </div>
          <div className="st-form">
            <Field label="Dal" id="se-from"><input id="se-from" type="date" value={draft.from ?? ''} onChange={e => upd({ from: e.target.value })} /></Field>
            <Field label="Al" id="se-to"><input id="se-to" type="date" value={draft.to ?? ''} onChange={e => upd({ to: e.target.value })} /></Field>
          </div>
          <div className="st-switches"><Switch on={!!draft.yearly} onChange={v => upd({ yearly: v })} label="Ripeti ogni anno (l’anno viene ignorato)" /></div>
          <div className="st-chips" role="group" aria-label="Giorni della settimana">
            {ORDER.map(d => <button key={d} type="button" aria-pressed={!!draft.days?.includes(d)} onClick={() => toggleDay(d)}>{DAY_NAMES.it[d]}</button>)}
          </div>
          <p className="st-hint">Nessun giorno selezionato = tutti i giorni.</p>
          <div className="st-form">
            <Field label="Dalle ore" id="se-start"><input id="se-start" type="time" value={draft.start ?? ''} onChange={e => upd({ start: e.target.value })} /></Field>
            <Field label="Alle ore" id="se-end"><input id="se-end" type="time" value={draft.end ?? ''} onChange={e => upd({ end: e.target.value })} /></Field>
          </div>
          <div className="st-switches"><Switch on={!!draft.teaser} onChange={v => upd({ teaser: v })} label="Fuori periodo mostralo come “in arrivo” (non ordinabile)" /></div>
          <p className="st-hint">Così com’è: <b>{describeSchedule(draft)}</b></p>
          {err && <div className="st-alert" role="alert">{err}</div>}
          <div className="st-rowline">
            <button className="st-act" onClick={() => void commit(draft)}>Salva</button>
            <button className="st-ghost" onClick={() => setEdit(null)}>Annulla</button>
            {!isEmptySchedule(sch[edit]) && <button className="st-back" onClick={() => void commit(null)}>Rimuovi programmazione</button>}
          </div>
        </section>
      )}

      <section className="st-sheet">
        <h2 className="st-h3">Sezioni</h2>
        <ul className="st-rows">{CATS.map(c => row(catKey(c.id), c.it))}</ul>
      </section>

      <section className="st-sheet">
        <h2 className="st-h3">Prodotti</h2>
        <div className="st-chips" role="tablist">{CATS.map(c => <button key={c.id} role="tab" aria-selected={cat === c.id} onClick={() => setCat(c.id)}>{c.it}</button>)}</div>
        <ul className="st-rows">{menu.filter(m => m.cat === cat).sort((a, b) => a.sort - b.sort).map(m => row(m.id, m.name.it, m.visible ? undefined : 'Nascosto dal menu'))}</ul>
      </section>
    </div>
  )
}
