import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { api, PIN_LENGTH, type Role } from '../api'
import Kitchen from './Kitchen'
import Cashier from './Cashier'
import Waiter from './Waiter'
import Owner from './Owner'
import './staff.css'

/** Le quattro sezioni. `lock` = minuti di inattività dopo i quali si richiede di nuovo il PIN (0 = mai). */
const SECTIONS = [
  { id: 'cucina', role: 'kitchen', label: 'Cucina', desc: 'Ordini da preparare, scorte e ricettario', lock: 0 },
  { id: 'sala', role: 'waiter', label: 'Sala', desc: 'Tavoli e comande', lock: 0 },
  { id: 'cassa', role: 'cashier', label: 'Cassa', desc: 'Incassi, conti dei tavoli, giornata', lock: 10 },
  { id: 'proprieta', role: 'owner', label: 'Proprietà', desc: 'Menu, prezzi, costi, vendite', lock: 5 },
] as const satisfies readonly { id: string; role: Role; label: string; desc: string; lock: number }[]
type Section = (typeof SECTIONS)[number]
const LOCK_BY_ROLE: Record<Role, number> = { kitchen: 0, waiter: 0, cashier: 10, owner: 5 }

const ICONS: Record<Section['id'], ReactNode> = {
  cucina: <><path d="M5 11h14v6a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" /><path d="M3 11h18M9 7c0-2 3-2 3-4M15 7c0-2 3-2 3-4" /></>,
  sala: <><path d="M3 9h18M6 9v10M18 9v10M12 9v6" /><path d="M7 5h10" /></>,
  cassa: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  proprieta: <><circle cx="8" cy="15" r="4" /><path d="M11 12l8-8M16 7l3 3" /></>,
}
const Icon = ({ id }: { id: Section['id'] }) => <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICONS[id]}</svg>

const sectionFromHash = (): Section | null => {
  const m = location.hash.replace(/^#\/?/, '').split('/')[1]
  return SECTIONS.find(s => s.id === m) ?? null
}
const go = (s: Section | null) => { location.hash = s ? `staff/${s.id}` : 'staff' }
/** La proprietà può aprire tutte le sezioni; gli altri solo la propria. */
const canOpen = (role: Role, s: Section) => role === 'owner' || role === s.role

function useOnline() {
  const [on, setOn] = useState(() => navigator.onLine)
  useEffect(() => {
    const f = () => setOn(navigator.onLine)
    window.addEventListener('online', f); window.addEventListener('offline', f)
    return () => { window.removeEventListener('online', f); window.removeEventListener('offline', f) }
  }, [])
  return on
}
function useSection() {
  const [s, setS] = useState(sectionFromHash)
  useEffect(() => {
    const f = () => setS(sectionFromHash())
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return s
}
/** Dopo `minutes` senza tocchi o tasti chiama `onIdle`. 0 = mai. */
function useIdle(minutes: number, active: boolean, onIdle: () => void) {
  const cb = useRef(onIdle); cb.current = onIdle
  useEffect(() => {
    if (!active || !minutes) return
    let t = setTimeout(() => cb.current(), minutes * 60000)
    const reset = () => { clearTimeout(t); t = setTimeout(() => cb.current(), minutes * 60000) }
    const ev = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const
    ev.forEach(e => window.addEventListener(e, reset, { passive: true }))
    return () => { clearTimeout(t); ev.forEach(e => window.removeEventListener(e, reset)) }
  }, [minutes, active])
}

export default function Staff() {
  const online = useOnline()
  const section = useSection()
  const [role, setRole] = useState<Role | null>(null)
  const [ready, setReady] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  useEffect(() => { api.staffRole().then(r => { setRole(r); setReady(true) }).catch(() => setReady(true)) }, [])

  const out = useCallback(async (msg?: string) => { await api.staffLogout().catch(() => undefined); setRole(null); setNote(msg ?? null) }, [])
  useIdle(role && !(window as { __LB_DEMO?: unknown }).__LB_DEMO ? LOCK_BY_ROLE[role] : 0, !!role, () => void out('Bloccato per inattività: inserisci di nuovo il PIN.'))

  // chi non è la proprietà e sta su "#staff" va direttamente alla propria sezione
  useEffect(() => {
    if (role && role !== 'owner' && !section) go(SECTIONS.find(s => s.role === role)!)
  }, [role, section])

  if (!ready) return <div className="st-login"><p className="st-hint">Caricamento…</p></div>

  let body: ReactNode
  if (role && section && canOpen(role, section)) {
    const lo = () => void out()
    body = (
      <>
        {role === 'owner' && <OwnerBar current={section} />}
        {section.id === 'cucina' ? <Kitchen onLogout={lo} /> : section.id === 'cassa' ? <Cashier onLogout={lo} /> : section.id === 'sala' ? <Waiter onLogout={lo} /> : <Owner onLogout={lo} />}
      </>
    )
  } else if (role === 'owner' && !section) {
    body = <Hub owner onLogout={() => void out()} />
  } else if (section) {
    body = <PinScreen section={section} note={note} onDone={r => { setRole(r); setNote(null) }} />
  } else {
    body = <Hub />
  }
  return (
    <div className="staff">
      {!online && <div className="st-offline" role="status">Senza connessione: gli ordini non si aggiornano. Le azioni non vengono salvate finché non torna la rete.</div>}
      {api.mode === 'demo' && <div className="st-demo">Modalità demo: i dati restano in questo browser. PIN prova: cucina 111111, cassa 222222, sala 333333, proprietà 44444444.</div>}
      {body}
    </div>
  )
}

/** Il titolare passa da una sezione all'altra senza altri PIN. */
function OwnerBar({ current }: { current: Section }) {
  return (
    <nav className="st-secbar" aria-label="Sezioni">
      <span>Proprietà</span>
      {SECTIONS.map(s => <button key={s.id} aria-pressed={current.id === s.id} onClick={() => go(s)}>{s.label}</button>)}
    </nav>
  )
}

function Hub({ owner, onLogout }: { owner?: boolean; onLogout?: () => void }) {
  return (
    <div className="st-login">
      <div className="st-hub">
        <span className="st-mono big">LB</span>
        <h1 className="st-h1">{owner ? 'Dove vuoi andare?' : 'Lady Bedford’s · Personale'}</h1>
        {!owner && <p className="st-hint">Scegli la tua sezione: ti verrà chiesto il PIN.</p>}
        <div className="st-hub-grid">
          {SECTIONS.map(s => (
            <button key={s.id} className="st-hub-card" onClick={() => go(s)}>
              <Icon id={s.id} />
              <span className="st-hub-name">{s.label}</span>
              <span className="st-hub-desc">{s.desc}</span>
            </button>
          ))}
        </div>
        {owner && <button className="st-ghost" onClick={onLogout}>Esci</button>}
      </div>
    </div>
  )
}

function PinScreen({ section, note, onDone }: { section: Section; note: string | null; onDone: (r: Role) => void }) {
  const len = PIN_LENGTH[section.role]
  const [pin, setPin] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setPin(''); setErr(null) }, [section.id])

  const submit = async (p: string) => {
    setBusy(true); setErr(null)
    try { onDone(await api.staffLogin(section.role, p)) } catch (e) { setErr((e as Error).message); setPin('') } finally { setBusy(false) }
  }
  const press = (d: string) => {
    if (busy) return
    const n = (pin + d).slice(0, len); setPin(n)
    if (n.length === len) void submit(n)
  }
  return (
    <div className="st-login">
      <div className="st-login-card">
        <span className="st-pin-ico"><Icon id={section.id} /></span>
        <h1 className="st-h1">{section.label}</h1>
        <div className="st-pin" aria-label={`${pin.length} cifre inserite su ${len}`}>{Array.from({ length: len }, (_, i) => <i key={i} className={i < pin.length ? 'on' : ''} />)}</div>
        <div className="st-err" role="alert">{err || note || ' '}</div>
        <div className="st-pad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => <button key={d} onClick={() => press(d)}>{d}</button>)}
          <button className="muted" onClick={() => setPin('')} aria-label="Cancella tutto">C</button>
          <button onClick={() => press('0')}>0</button>
          <button className="muted" onClick={() => setPin(p => p.slice(0, -1))} aria-label="Cancella ultima cifra">⌫</button>
        </div>
        <button className="st-ghost" onClick={() => go(null)}>← Altre sezioni</button>
      </div>
    </div>
  )
}
