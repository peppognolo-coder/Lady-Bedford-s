import { useState } from 'react'
import { AlertsButton, useAlerts, useLowStock } from './alerts'
import { api, type L, type MenuItem, type Service, type Settings } from '../api'
import { useCatalog, sortMenu } from '../catalog'
import { CATS } from '../data'
import { Field, Switch, money } from './shared'
import { SettingsTab, SalesTab } from './OwnerMore'
import StockTab from './Stock'
import RecipesTab from './Recipes'
import CostsTab from './CostsTab'
import ContentTab from './ContentTab'
import SeasonTab from './SeasonTab'
import PinsTab from './PinsTab'
import BackupTab from './BackupTab'
import ClosuresTab from './ClosuresTab'
import BookingsTab, { useBookings } from './BookingsTab'
import BookingConfigTab from './BookingConfigTab'
import { AllergenChips } from './AllergenPicker'
import { fromRecipe, sortAllergens } from '../allergens'
import { ImagePicker } from './ImagePicker'

type Tab = 'menu' | 'recipes' | 'season' | 'stock' | 'costs' | 'services' | 'content' | 'pins' | 'backup' | 'bookings' | 'bookingrules' | 'closures' | 'settings' | 'sales'

export default function Owner({ onLogout }: { onLogout: () => void }) {
  const { catalog, reload } = useCatalog()
  const alerts = useAlerts()
  const bookings = useBookings(f => alerts.play('booking', f.map(b => `${b.name} · ${b.party} pers.`).join(', ')))
  const lowStock = useLowStock(alerts)
  const [tab, setTab] = useState<Tab>('menu')
  const [flash, setFlash] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  /** Esegue un salvataggio, ricarica il catalogo e mostra l'esito. */
  const save = async (f: () => Promise<void>, ok = 'Salvato') => {
    try { setErr(null); await f(); await reload(); setFlash(ok); setTimeout(() => setFlash(null), 2200); return true } catch (e) { setErr((e as Error).message); return false }
  }
  const tabs: [Tab, string][] = [['menu', 'Menu e prezzi'], ['season', 'Menu stagionale'], ['recipes', 'Ricettario'], ['stock', 'Scorte e spesa'], ['costs', 'Costi e prezzi'], ['services', 'Servizi'], ['content', 'Contenuti app'], ['pins', 'PIN di accesso'], ['bookings', 'Prenotazioni'], ['bookingrules', 'Regole prenotazione'], ['closures', 'Chiusure cassa'], ['backup', 'Dati e backup'], ['settings', 'Orari e impostazioni'], ['sales', 'Vendite']]
  return (
    <div className="st-shell">
      <header className="st-bar">
        <div className="st-brand"><span className="st-mono">LB</span><div><div className="st-kicker">Proprietà</div><div className="st-title">Gestione del locale</div></div></div>
        <nav className="st-tabs" aria-label="Sezioni">{tabs.map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}{id === 'bookings' && bookings.pending > 0 && <i className="st-dot">{bookings.pending}</i>}{id === 'stock' && lowStock.length > 0 && <i className="st-dot" aria-label={`${lowStock.length} sotto scorta`}>{lowStock.length}</i>}</button>)}</nav>
        <div className="st-tools"><AlertsButton alerts={alerts} /><button className="st-ghost" onClick={onLogout}>Esci</button></div>
      </header>
      {err && <div className="st-alert" role="alert">{err}</div>}
      {flash && <div className="st-flash" role="status">{flash}</div>}
      <main className="st-main">
        {tab === 'menu' && <MenuTab menu={catalog.menu} settings={catalog.settings} save={save} />}
        {tab === 'season' && <SeasonTab catalog={catalog} save={save} />}
        {tab === 'recipes' && <RecipesTab />}
        {tab === 'stock' && <StockTab />}
        {tab === 'costs' && <CostsTab onPriceSaved={() => void reload()} />}
        {tab === 'services' && <ServicesTab services={catalog.services} save={save} />}
        {tab === 'content' && <ContentTab key={JSON.stringify(catalog.content).length} catalog={catalog} save={save} />}
        {tab === 'bookings' && <BookingsTab bookings={bookings} />}
        {tab === 'bookingrules' && <BookingConfigTab catalog={catalog} save={save} />}
        {tab === 'closures' && <ClosuresTab />}
        {tab === 'backup' && <BackupTab />}
        {tab === 'pins' && <PinsTab />}
        {tab === 'settings' && <SettingsTab catalog={catalog} save={save} />}
        {tab === 'sales' && <SalesTab />}
      </main>
    </div>
  )
}

type Save = (f: () => Promise<void>, ok?: string) => Promise<boolean>
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'prodotto'
const toNum = (t: string) => parseFloat(t.replace(',', '.'))

/* ---------- menu ---------- */
function MenuTab({ menu, settings, save }: { menu: MenuItem[]; settings: Settings; save: Save }) {
  const [cat, setCat] = useState('tea')
  const [edit, setEdit] = useState<MenuItem | null>(null)
  const [isNew, setIsNew] = useState(false)
  const list = sortMenu(menu).filter(m => m.cat === cat)

  const move = (i: number, d: -1 | 1) => {
    const a = list[i], b = list[i + d]; if (!a || !b) return
    void save(async () => { await api.saveMenuItem({ ...a, sort: b.sort }); await api.saveMenuItem({ ...b, sort: a.sort }) }, 'Ordine aggiornato')
  }
  const blank = (): MenuItem => ({ id: '', cat, price: 0, vg: false, available: true, visible: true, sort: Math.max(-1, ...menu.map(m => m.sort)) + 1, name: { it: '', en: '' }, desc: { it: '', en: '' } })

  return (
    <div className="st-pane">
      <div className="st-rowline" style={{ justifyContent: 'space-between' }}>
        <div className="st-chips" role="tablist">{CATS.map(c => <button key={c.id} role="tab" aria-selected={cat === c.id} onClick={() => { setCat(c.id); setEdit(null) }}>{c.it}</button>)}</div>
        <button className="st-act" style={{ minHeight: 44, fontSize: 16 }} onClick={() => { setEdit(blank()); setIsNew(true) }}>Nuovo prodotto</button>
      </div>
      <div className="st-rowline">
        <Switch on={!!settings.show_product_photos} onChange={v => void save(() => api.saveSettings({ ...settings, show_product_photos: v }), v ? 'Foto prodotti attivate' : 'Foto prodotti disattivate')} label="Mostra le foto dei prodotti nell’app dei clienti" />
      </div>
      {edit && <MenuForm key={edit.id || 'new'} item={edit} isNew={isNew} onCancel={() => setEdit(null)} onSave={async m => { if (await save(() => api.saveMenuItem(m))) setEdit(null) }} />}
      <ul className="st-rows">
        {list.length === 0 && <li className="st-empty">Nessun prodotto in questa categoria.</li>}
        {list.map((m, i) => (
          <li key={m.id} className={`st-row ${m.visible ? '' : 'hidden'}`}>
            <div className="st-row-main">
              <div className="st-row-title">{m.name.it}<small>{m.name.en}</small></div>
              <div className="st-row-tags">
                <span className="st-pill">{m.vg ? 'Vegano' : 'Vegetariano'}</span>
                {!m.available && <span className="st-pill unpaid">Esaurito</span>}
                {!m.visible && <span className="st-pill">Nascosto</span>}
              </div>
            </div>
            <b className="tnum st-row-price">{money(m.price)}</b>
            <div className="st-row-tools">
              <button className="st-icon" aria-label={`Sposta su ${m.name.it}`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button className="st-icon" aria-label={`Sposta giù ${m.name.it}`} disabled={i === list.length - 1} onClick={() => move(i, 1)}>↓</button>
              <button className="st-ghost" onClick={() => { setEdit(m); setIsNew(false) }}>Modifica</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MenuForm({ item, isNew, onSave, onCancel }: { item: MenuItem; isNew: boolean; onSave: (m: MenuItem) => void; onCancel: () => void }) {
  const [m, setM] = useState(item)
  const [price, setPrice] = useState(item.price ? String(item.price).replace('.', ',') : '')
  const [err, setErr] = useState<string | null>(null)
  const setL = (k: 'name' | 'desc', lang: keyof L, v: string) => setM(o => ({ ...o, [k]: { ...o[k], [lang]: v } }))
  const submit = () => {
    const p = toNum(price)
    if (!m.name.it.trim()) return setErr('Inserisci il nome in italiano.')
    if (!Number.isFinite(p) || p < 0 || p > 999) return setErr('Il prezzo non è valido (es. 6,50).')
    setErr(null)
    onSave({ ...m, price: Math.round(p * 100) / 100, name: { it: m.name.it.trim(), en: m.name.en.trim() || m.name.it.trim() }, desc: { it: m.desc.it.trim(), en: m.desc.en.trim() || m.desc.it.trim() }, id: m.id || `${slug(m.name.it)}-${Math.random().toString(36).slice(2, 5)}` })
  }
  return (
    <section className="st-sheet" aria-label={isNew ? 'Nuovo prodotto' : `Modifica ${item.name.it}`}>
      <h2 className="st-h3">{isNew ? 'Nuovo prodotto' : 'Modifica prodotto'}</h2>
      <div className="st-form">
        <Field label="Nome (italiano)" id="m-nit"><input id="m-nit" value={m.name.it} onChange={e => setL('name', 'it', e.target.value)} maxLength={60} /></Field>
        <Field label="Nome (inglese)" id="m-nen"><input id="m-nen" value={m.name.en} onChange={e => setL('name', 'en', e.target.value)} maxLength={60} /></Field>
        <Field label="Descrizione (italiano)" id="m-dit"><textarea id="m-dit" rows={2} value={m.desc.it} onChange={e => setL('desc', 'it', e.target.value)} maxLength={200} /></Field>
        <Field label="Descrizione (inglese)" id="m-den"><textarea id="m-den" rows={2} value={m.desc.en} onChange={e => setL('desc', 'en', e.target.value)} maxLength={200} /></Field>
        <Field label="Prezzo (€)" id="m-price"><input id="m-price" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder="6,50" /></Field>
        <Field label="Categoria" id="m-cat">
          <select id="m-cat" value={m.cat} onChange={e => setM({ ...m, cat: e.target.value })}>{CATS.map(c => <option key={c.id} value={c.id}>{c.it}</option>)}</select>
        </Field>
        <Field label="Foto del prodotto" id="m-photo" hint="Si vede nell’app solo se l’interruttore “Mostra le foto dei prodotti” è acceso."><ImagePicker value={m.photo} folder="products" max={800} label="Foto prodotto" ratio="1 / 1" onChange={u => setM(o => ({ ...o, photo: u }))} /></Field>
        <Field label="Allergeni" id="m-all" hint="Obbligatori per legge. Finché non li dichiari, l’app mostra “chiedi al personale”.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Switch on={m.allergens != null} onChange={v => setM(o => ({ ...o, allergens: v ? [] : null }))} label="Allergeni verificati e dichiarati" />
            {m.allergens != null && <>
              <AllergenChips value={m.allergens} onChange={v => setM(o => ({ ...o, allergens: sortAllergens(v) }))} />
              <div><button type="button" className="st-ghost" onClick={async () => { const bo = await api.getBackoffice(); const r = bo.recipes.find(x => x.item_id === m.id); if (!r) return setErr('Questo prodotto non ha ancora una ricetta.'); setErr(null); setM(o => ({ ...o, allergens: fromRecipe(r, bo.ingredients) })) }}>Calcola dagli ingredienti della ricetta</button></div>
              {m.allergens.length === 0 && <small>Nessun allergene: l’app scriverà “Non contiene allergeni dichiarati”.</small>}
            </>}
          </div>
        </Field>
        <div className="st-switches">
          <Switch on={m.vg} onChange={v => setM({ ...m, vg: v })} label="Vegano" />
          <Switch on={m.available} onChange={v => setM({ ...m, available: v })} label="Disponibile" />
          <Switch on={m.visible} onChange={v => setM({ ...m, visible: v })} label="Visibile nel menu" />
        </div>
      </div>
      {err && <div className="st-alert inline" role="alert">{err}</div>}
      <div className="st-actions"><button className="st-act" onClick={submit}>Salva</button><button className="st-act alt" onClick={onCancel}>Annulla</button></div>
      <p className="st-hint">I prodotti non si cancellano: “Visibile nel menu” spento li toglie dall’app e dalla sala, ma restano negli ordini passati. Le modifiche arrivano subito a tutti i dispositivi.</p>
    </section>
  )
}

/* ---------- servizi ---------- */
function ServicesTab({ services, save }: { services: Service[]; save: Save }) {
  const list = [...services].sort((a, b) => a.sort - b.sort)
  const [edit, setEdit] = useState<Service | null>(null)
  const [isNew, setIsNew] = useState(false)
  const blank = (): Service => ({ id: '', active: true, sort: Math.max(-1, ...services.map(s => s.sort)) + 1, kicker: { it: '', en: '' }, title: { it: '', en: '' }, body: { it: '', en: '' }, price: { it: '', en: '' }, cta: { it: 'Richiedi', en: 'Enquire' } })
  const move = (i: number, d: -1 | 1) => {
    const a = list[i], b = list[i + d]; if (!a || !b) return
    void save(async () => { await api.saveService({ ...a, sort: b.sort }); await api.saveService({ ...b, sort: a.sort }) }, 'Ordine aggiornato')
  }
  return (
    <div className="st-pane">
      <div className="st-rowline" style={{ justifyContent: 'space-between' }}>
        <p className="st-hint" style={{ margin: 0 }}>Servizi mostrati nella scheda “Servizi” dell’app.</p>
        <button className="st-act" style={{ minHeight: 44, fontSize: 16 }} onClick={() => { setEdit(blank()); setIsNew(true) }}>Nuovo servizio</button>
      </div>
      {edit && <ServiceForm key={edit.id || 'new'} svc={edit} isNew={isNew} onCancel={() => setEdit(null)} onSave={async s => { if (await save(() => api.saveService(s))) setEdit(null) }} />}
      <ul className="st-rows">
        {list.map((s, i) => (
          <li key={s.id} className={`st-row ${s.active ? '' : 'hidden'}`}>
            <div className="st-row-main">
              <div className="st-row-title">{s.title.it}<small>{s.kicker.it}</small></div>
              <div className="st-row-tags">{!s.active && <span className="st-pill">Nascosto</span>}</div>
            </div>
            <span className="st-row-price tnum">{s.price.it}</span>
            <div className="st-row-tools">
              <button className="st-icon" aria-label={`Sposta su ${s.title.it}`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button className="st-icon" aria-label={`Sposta giù ${s.title.it}`} disabled={i === list.length - 1} onClick={() => move(i, 1)}>↓</button>
              <button className="st-ghost" onClick={() => { setEdit(s); setIsNew(false) }}>Modifica</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ServiceForm({ svc, isNew, onSave, onCancel }: { svc: Service; isNew: boolean; onSave: (s: Service) => void; onCancel: () => void }) {
  const [s, setS] = useState(svc)
  const [err, setErr] = useState<string | null>(null)
  const setL = (k: 'kicker' | 'title' | 'body' | 'price' | 'cta', lang: keyof L, v: string) => setS(o => ({ ...o, [k]: { ...o[k], [lang]: v } }))
  const submit = () => {
    if (!s.title.it.trim()) return setErr('Inserisci il titolo in italiano.')
    setErr(null)
    const fill = (l: L): L => ({ it: l.it.trim(), en: l.en.trim() || l.it.trim() })
    onSave({ ...s, kicker: fill(s.kicker), title: fill(s.title), body: fill(s.body), price: fill(s.price), cta: fill(s.cta), id: s.id || `${slug(s.title.it)}-${Math.random().toString(36).slice(2, 5)}` })
  }
  const two = (k: 'kicker' | 'title' | 'price' | 'cta', label: string, rows = 0) => (
    <>
      <Field label={`${label} (italiano)`} id={`s-${k}-it`}>{rows ? <textarea id={`s-${k}-it`} rows={rows} value={s[k].it} onChange={e => setL(k, 'it', e.target.value)} /> : <input id={`s-${k}-it`} value={s[k].it} onChange={e => setL(k, 'it', e.target.value)} />}</Field>
      <Field label={`${label} (inglese)`} id={`s-${k}-en`}>{rows ? <textarea id={`s-${k}-en`} rows={rows} value={s[k].en} onChange={e => setL(k, 'en', e.target.value)} /> : <input id={`s-${k}-en`} value={s[k].en} onChange={e => setL(k, 'en', e.target.value)} />}</Field>
    </>
  )
  return (
    <section className="st-sheet" aria-label={isNew ? 'Nuovo servizio' : `Modifica ${svc.title.it}`}>
      <h2 className="st-h3">{isNew ? 'Nuovo servizio' : 'Modifica servizio'}</h2>
      <div className="st-form">
        {two('title', 'Titolo')}
        {two('kicker', 'Sopratitolo', 0)}
        <Field label="Descrizione (italiano)" id="s-body-it"><textarea id="s-body-it" rows={3} value={s.body.it} onChange={e => setL('body', 'it', e.target.value)} /></Field>
        <Field label="Descrizione (inglese)" id="s-body-en"><textarea id="s-body-en" rows={3} value={s.body.en} onChange={e => setL('body', 'en', e.target.value)} /></Field>
        {two('price', 'Prezzo (testo libero, es. “€ 28 a persona”)')}
        {two('cta', 'Testo del pulsante')}
        <div className="st-switches"><Switch on={s.active} onChange={v => setS({ ...s, active: v })} label="Visibile nell’app" /></div>
      </div>
      {err && <div className="st-alert inline" role="alert">{err}</div>}
      <div className="st-actions"><button className="st-act" onClick={submit}>Salva</button><button className="st-act alt" onClick={onCancel}>Annulla</button></div>
      <p className="st-hint">Le richieste dei clienti per ora arrivano come conferma a schermo: l’invio a una email o a un calendario si può aggiungere dopo.</p>
    </section>
  )
}
