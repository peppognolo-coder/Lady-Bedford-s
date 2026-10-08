import { useState } from 'react'
import { api, PIN_LENGTH, type Role } from '../api'
import { Field } from './shared'

const ROLES: [Role, string][] = [['kitchen', 'Cucina'], ['waiter', 'Sala'], ['cashier', 'Cassa'], ['owner', 'Proprietà']]

/** Controlli lato interfaccia; le stesse regole sono imposte dal database. */
export const pinProblem = (role: Role, pin: string): string | null => {
  const n = PIN_LENGTH[role]
  if (!new RegExp(`^\\d{${n}}$`).test(pin)) return `Il PIN deve essere di ${n} cifre.`
  if (/^(\d)\1+$/.test(pin)) return 'PIN troppo semplice (cifre tutte uguali).'
  if ('0123456789'.includes(pin) || '9876543210'.includes(pin)) return 'PIN troppo semplice (cifre in sequenza).'
  return null
}

export default function PinsTab() {
  const [role, setRole] = useState<Role>('kitchen')
  const [pin, setPin] = useState(''), [pin2, setPin2] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const n = PIN_LENGTH[role]
  const submit = async () => {
    const p = pinProblem(role, pin)
    if (p) return setMsg({ ok: false, t: p })
    if (pin !== pin2) return setMsg({ ok: false, t: 'I due PIN non coincidono.' })
    setBusy(true); setMsg(null)
    try { await api.setPin(role, pin); setMsg({ ok: true, t: `PIN di ${ROLES.find(r => r[0] === role)![1]} aggiornato. Vale dal prossimo accesso.` }); setPin(''); setPin2('') }
    catch (e) { setMsg({ ok: false, t: (e as Error).message }) } finally { setBusy(false) }
  }
  return (
    <div className="st-pane">
      <section className="st-sheet">
        <h2 className="st-h3">Cambia PIN</h2>
        <div className="st-chips" role="tablist">{ROLES.map(([id, l]) => <button key={id} role="tab" aria-selected={role === id} onClick={() => { setRole(id); setPin(''); setPin2(''); setMsg(null) }}>{l}</button>)}</div>
        <div className="st-form">
          <Field label={`Nuovo PIN (${n} cifre)`} id="pin-new"><input id="pin-new" type="password" inputMode="numeric" autoComplete="new-password" maxLength={n} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="Ripeti il nuovo PIN" id="pin-new2"><input id="pin-new2" type="password" inputMode="numeric" autoComplete="new-password" maxLength={n} value={pin2} onChange={e => setPin2(e.target.value.replace(/\D/g, ''))} /></Field>
        </div>
        {msg && <div className={msg.ok ? 'st-flash' : 'st-alert inline'} role={msg.ok ? 'status' : 'alert'} style={msg.ok ? { position: 'static' } : undefined}>{msg.t}</div>}
        <div className="st-actions"><button className="st-act" disabled={busy} onClick={() => void submit()}>{busy ? 'Salvo…' : 'Imposta PIN'}</button></div>
        <p className="st-hint">Il PIN non viene mai mostrato né salvato in chiaro: puoi solo sostituirlo. Cambiando il PIN di un altro ruolo, i dispositivi già collegati con il vecchio PIN vengono scollegati entro circa un’ora. Se un PIN è finito in mani sbagliate, cambialo subito.</p>
      </section>
    </div>
  )
}
