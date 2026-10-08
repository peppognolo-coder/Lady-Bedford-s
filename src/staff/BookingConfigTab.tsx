import { useEffect, useState } from 'react'
import { api } from '../api'
import type { BookingConfig, BookingMode, BookingRule, Catalog } from '../api/types'
import { MODE_LABEL, isoDay, modeFor, toMin } from '../booking'
import { Field, Switch } from './shared'

type Save = (f: () => Promise<void>, ok?: string) => Promise<boolean>
const MODES: BookingMode[] = ['required', 'recommended', 'free']
const HELP: Record<BookingMode, string> = {
  required: 'I clienti devono prenotare: l’app propone solo orari con posti liberi.',
  recommended: 'Si può prenotare, ma si può venire anche senza.',
  free: 'Accesso libero: l’app dice di venire senza prenotare e non accetta prenotazioni in quei giorni.',
}
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const uid = () => Math.random().toString(36).slice(2, 8)
const num = (v: string, d: number) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d }

export default function BookingConfigTab({ catalog, save }: { catalog: Catalog; save: Save }) {
  const [c, setC] = useState<BookingConfig>(catalog.booking)
  const [dirty, setDirty] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [gen, setGen] = useState({ from: '11:00', to: '17:30', step: '30' })
  const key = JSON.stringify(catalog.booking)
  useEffect(() => { if (!dirty) setC(catalog.booking) }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const upd = (p: Partial<BookingConfig>) => { setC(o => ({ ...o, ...p })); setDirty(true) }
  const setRule = (id: string, p: Partial<BookingRule>) => upd({ rules: c.rules.map(r => (r.id === id ? { ...r, ...p } : r)) })

  const submit = async () => {
    if (c.rules.some(r => !r.from || !r.to || (!r.yearly && r.to < r.from))) return setErr('Controlla le date dei periodi: la fine non può precedere l’inizio.')
    if (!c.slots.length) return setErr('Serve almeno un orario prenotabile.')
    if (c.capacity < 1 || c.duration_min < 15 || c.max_party < 1) return setErr('Controlla capienza, durata e massimo di persone.')
    setErr(null)
    if (await save(() => api.saveBookingConfig({ ...c, slots: [...new Set(c.slots)].sort() }), 'Regole di prenotazione salvate')) setDirty(false)
  }
  const preview = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); const iso = isoDay(d); return { iso, d, open: catalog.settings.open_days.includes(d.getDay()), m: modeFor(c, iso) } })

  return (
    <div className="st-pane">
      <div className="st-rowline" style={{ justifyContent: 'space-between' }}>
        <h2 className="st-h2">Regole di prenotazione</h2>
        <button className="st-act" style={{ minHeight: 44, fontSize: 16 }} disabled={!dirty} onClick={() => void submit()}>{dirty ? 'Salva le regole' : 'Nessuna modifica'}</button>
      </div>
      {err && <div className="st-alert inline" role="alert">{err}</div>}

      <section className="st-sheet">
        <div className="st-switches">
          <Switch on={c.enabled} onChange={v => upd({ enabled: v })} label="Prenotazioni online attive" />
          <Switch on={c.auto_confirm} onChange={v => upd({ auto_confirm: v })} label="Conferma automatica (altrimenti confermate voi)" />
        </div>
        <h3 className="st-h3">Come funziona di solito</h3>
        <div className="st-chips" role="radiogroup" aria-label="Modalità predefinita">
          {MODES.map(m => <button key={m} role="radio" aria-checked={c.default_mode === m} onClick={() => upd({ default_mode: m })}>{MODE_LABEL[m].it}</button>)}
        </div>
        <p className="st-hint">{HELP[c.default_mode]}</p>
      </section>

      <section className="st-sheet">
        <h3 className="st-h3">Periodi particolari</h3>
        <p className="st-hint">Per esempio “Natale: prenotazione necessaria” o “Estate: accesso libero”. Se due periodi si sovrappongono vale il primo della lista. Con “ogni anno” il periodo si ripete e si ignora l’anno.</p>
        {c.rules.map(r => (
          <fieldset key={r.id} className="st-form" style={{ border: '1px solid var(--color-divider)', padding: 12 }}>
            <Field label="Nome" id={`r-l-${r.id}`}><input id={`r-l-${r.id}`} value={r.label} maxLength={40} onChange={e => setRule(r.id, { label: e.target.value })} /></Field>
            <Field label="Dal" id={`r-f-${r.id}`}><input id={`r-f-${r.id}`} type="date" value={r.from} onChange={e => setRule(r.id, { from: e.target.value })} /></Field>
            <Field label="Al" id={`r-t-${r.id}`}><input id={`r-t-${r.id}`} type="date" value={r.to} onChange={e => setRule(r.id, { to: e.target.value })} /></Field>
            <Field label="Modalità" id={`r-m-${r.id}`}><select id={`r-m-${r.id}`} value={r.mode} onChange={e => setRule(r.id, { mode: e.target.value as BookingMode })}>{MODES.map(m => <option key={m} value={m}>{MODE_LABEL[m].it}</option>)}</select></Field>
            <div className="st-switches"><Switch on={r.yearly} onChange={v => setRule(r.id, { yearly: v })} label="Ogni anno" /></div>
            <div className="st-actions">
              <button className="st-ghost" onClick={() => { if (confirm('Eliminare questo periodo?')) upd({ rules: c.rules.filter(x => x.id !== r.id) }) }}>Elimina periodo</button>
            </div>
          </fieldset>
        ))}
        <div className="st-actions"><button className="st-act alt" onClick={() => { const t = isoDay(new Date()); upd({ rules: [...c.rules, { id: uid(), label: 'Nuovo periodo', from: t, to: t, yearly: false, mode: 'required' }] }) }}>Aggiungi periodo</button></div>
      </section>

      <section className="st-sheet">
        <h3 className="st-h3">Orari e capienza</h3>
        <div className="st-chips" aria-label="Orari prenotabili">
          {c.slots.map(s => <button key={s} onClick={() => upd({ slots: c.slots.filter(x => x !== s) })} title="Tocca per togliere">{s} ✕</button>)}
        </div>
        <div className="st-form two">
          <Field label="Primo orario" id="g-f"><input id="g-f" type="time" value={gen.from} onChange={e => setGen({ ...gen, from: e.target.value })} /></Field>
          <Field label="Ultimo orario" id="g-t"><input id="g-t" type="time" value={gen.to} onChange={e => setGen({ ...gen, to: e.target.value })} /></Field>
          <Field label="Ogni (minuti)" id="g-s"><select id="g-s" value={gen.step} onChange={e => setGen({ ...gen, step: e.target.value })}><option>15</option><option>30</option><option>60</option></select></Field>
        </div>
        <div className="st-actions"><button className="st-act alt" onClick={() => { const a = toMin(gen.from), b = toMin(gen.to), st = num(gen.step, 30); const l: string[] = []; for (let m = a; m <= b; m += st) l.push(hhmm(m)); if (l.length) upd({ slots: l }) }}>Genera gli orari</button></div>
        <div className="st-form">
          <Field label="Coperti contemporanei" id="b-cap" hint="Quante persone possono stare sedute insieme."><input id="b-cap" inputMode="numeric" value={c.capacity} onChange={e => upd({ capacity: num(e.target.value, 0) })} /></Field>
          <Field label="Durata di un tavolo (minuti)" id="b-dur" hint="Per quanto tempo un tavolo resta occupato."><input id="b-dur" inputMode="numeric" value={c.duration_min} onChange={e => upd({ duration_min: num(e.target.value, 0) })} /></Field>
          <Field label="Massimo persone per prenotazione" id="b-max"><input id="b-max" inputMode="numeric" value={c.max_party} onChange={e => upd({ max_party: num(e.target.value, 0) })} /></Field>
          <Field label="Si prenota fino a (giorni prima)" id="b-adv"><input id="b-adv" inputMode="numeric" value={c.advance_days} onChange={e => upd({ advance_days: num(e.target.value, 0) })} /></Field>
          <Field label="Anticipo minimo (ore)" id="b-not"><input id="b-not" inputMode="numeric" value={c.min_notice_h} onChange={e => upd({ min_notice_h: num(e.target.value, 0) })} /></Field>
        </div>
      </section>

      <section className="st-sheet">
        <h3 className="st-h3">Anteprima: prossimi 14 giorni</h3>
        <div className="st-tablewrap"><table className="st-table"><tbody>
          {preview.map(p => (
            <tr key={p.iso}><td>{p.d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}</td><td>{p.open ? MODE_LABEL[p.m.mode].it : 'Chiuso'}{p.open && p.m.label ? ` · ${p.m.label}` : ''}</td></tr>
          ))}
        </tbody></table></div>
      </section>
    </div>
  )
}
