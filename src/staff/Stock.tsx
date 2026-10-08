import { useState } from 'react'
import { api, type Ingredient } from '../api'
import { useCatalog, sortMenu } from '../catalog'
import { useBackoffice, toNum } from '../backoffice'
import { fmtQty, portionsLeft } from '../costs'
import { money } from './shared'

const REASON: Record<string, string> = { carico: 'Carico', inventario: 'Inventario', spreco: 'Spreco', vendita: 'Vendita' }
type Sheet = { ing: Ingredient; kind: 'carico' | 'spreco' | 'inventario' } | null

/** Giacenze, lista della spesa e movimenti. Cucina e proprietà. */
export default function StockTab() {
  const { data, loaded, error, reload } = useBackoffice()
  const { catalog, reload: reloadCatalog } = useCatalog()
  const [filter, setFilter] = useState<'all' | 'low'>('all')
  const [sheet, setSheet] = useState<Sheet>(null)
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [view, setView] = useState<'stock' | 'shop' | 'moves'>('stock')

  const ings = data.ingredients
  const low = (i: Ingredient) => i.stock <= i.min_stock
  const list = ings.filter(i => filter === 'all' || low(i))
  const byName = new Map(ings.map(i => [i.id, i]))
  const recipeOf = new Map(data.recipes.map(r => [r.item_id, r]))

  const risk = sortMenu(catalog.menu.filter(m => m.visible))
    .map(m => ({ m, left: portionsLeft(recipeOf.get(m.id), ings) }))
    .filter(x => x.left !== null && x.left <= 3)

  // lista della spesa: riportare ogni ingrediente sotto soglia a 2× la soglia, a confezioni intere
  const shop = ings.filter(low).map(i => {
    const need = Math.max(0, i.min_stock * 2 - i.stock)
    const packs = Math.max(1, Math.ceil(need / i.pack_qty))
    return { i, packs, cost: packs * i.pack_price }
  })

  const submit = async () => {
    if (!sheet) return
    const n = toNum(qty)
    if (!Number.isFinite(n) || n < 0 || (sheet.kind !== 'inventario' && n === 0)) return setErr('Inserisci una quantità valida.')
    try {
      setErr(null)
      if (sheet.kind === 'inventario') await api.setStock(sheet.ing.id, n, note || undefined)
      else await api.moveStock(sheet.ing.id, sheet.kind === 'carico' ? n : -n, sheet.kind, note || undefined)
      setSheet(null); setQty(''); setNote(''); await reload()
    } catch (e) { setErr((e as Error).message) }
  }
  const markOut = async (id: string) => { try { await api.setAvailability(id, false); await reloadCatalog() } catch (e) { setErr((e as Error).message) } }

  if (loaded && !ings.length) {
    return <div className="st-pane"><div className="st-empty big">Nessun ingrediente ancora.<br /><small style={{ fontSize: 14 }}>La proprietà li inserisce da “Ricettario”; poi qui si segnano carichi e inventari.</small></div></div>
  }
  return (
    <div className="st-pane">
      {(error || err) && <div className="st-alert inline" role="alert">{err || error}</div>}
      <div className="st-chips" role="tablist">
        {([['stock', 'Giacenze'], ['shop', `Lista della spesa${shop.length ? ` (${shop.length})` : ''}`], ['moves', 'Movimenti']] as const).map(([id, l]) =>
          <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)}>{l}</button>)}
      </div>

      {view === 'stock' && (
        <>
          {risk.length > 0 && (
            <section className="st-sheet" aria-label="Prodotti a rischio">
              <h2 className="st-h3">Stanno per finire</h2>
              <ul className="st-rows">
                {risk.map(({ m, left }) => (
                  <li key={m.id} className="st-row">
                    <div className="st-row-main"><div className="st-row-title">{m.name.it}</div>
                      <div className="st-row-tags"><span className={`st-pill ${left === 0 ? 'unpaid' : 'preparing'}`}>{left === 0 ? 'Ingredienti finiti' : `Ancora ${left} porzioni`}</span>{!m.available && <span className="st-pill">Già segnato esaurito</span>}</div></div>
                    {m.available && left === 0 && <button className="st-ghost" onClick={() => markOut(m.id)}>Segna esaurito</button>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="st-chips">
            <button aria-selected={filter === 'all'} role="tab" onClick={() => setFilter('all')}>Tutti ({ings.length})</button>
            <button aria-selected={filter === 'low'} role="tab" onClick={() => setFilter('low')}>Sotto scorta ({ings.filter(low).length})</button>
          </div>
          {sheet && (
            <section className="st-sheet" aria-label="Movimento di magazzino">
              <h2 className="st-h3">{sheet.kind === 'carico' ? 'Carico' : sheet.kind === 'spreco' ? 'Spreco o scarto' : 'Conteggio inventario'}: {sheet.ing.name}</h2>
              <div className="st-form">
                <div className="st-field"><label htmlFor="sq">{sheet.kind === 'inventario' ? `Quantità contata (${sheet.ing.unit})` : `Quantità (${sheet.ing.unit})`}</label>
                  <input id="sq" inputMode="decimal" autoFocus value={qty} onChange={e => setQty(e.target.value)} placeholder={sheet.kind === 'carico' ? String(sheet.ing.pack_qty) : ''} />
                  <small>Ora in magazzino: {fmtQty(sheet.ing.stock, sheet.ing.unit)}</small></div>
                <div className="st-field"><label htmlFor="sn">Nota (facoltativa)</label><input id="sn" value={note} onChange={e => setNote(e.target.value)} maxLength={120} placeholder="es. fattura 123, caduto, scaduto" /></div>
              </div>
              <div className="st-actions"><button className="st-act" onClick={submit}>Conferma</button><button className="st-act alt" onClick={() => { setSheet(null); setErr(null) }}>Annulla</button></div>
            </section>
          )}
          <ul className="st-rows">
            {list.length === 0 && <li className="st-empty">Niente sotto scorta.</li>}
            {list.map(i => (
              <li key={i.id} className="st-row">
                <div className="st-row-main">
                  <div className="st-row-title">{i.name}<small>soglia {fmtQty(i.min_stock, i.unit)}{i.supplier ? ` · ${i.supplier}` : ''}</small></div>
                  <div className="st-row-tags">{i.stock < 0 ? <span className="st-pill unpaid">Negativa: da ricontare</span> : low(i) ? <span className="st-pill unpaid">Sotto scorta</span> : null}</div>
                </div>
                <b className={`tnum st-row-price ${i.stock <= 0 ? 'st-neg' : ''}`}>{fmtQty(i.stock, i.unit)}</b>
                <div className="st-row-tools">
                  <button className="st-ghost" onClick={() => { setSheet({ ing: i, kind: 'carico' }); setQty(''); setNote('') }}>Carico</button>
                  <button className="st-ghost" onClick={() => { setSheet({ ing: i, kind: 'spreco' }); setQty(''); setNote('') }}>Spreco</button>
                  <button className="st-ghost" onClick={() => { setSheet({ ing: i, kind: 'inventario' }); setQty(''); setNote('') }}>Conta</button>
                </div>
              </li>
            ))}
          </ul>
          <p className="st-hint">Le scorte scendono da sole quando la cucina preme “Inizia” su un ordine, secondo le ricette. Carichi, sprechi e conteggi si segnano qui.</p>
        </>
      )}

      {view === 'shop' && (
        <>
          <p className="st-hint">Ogni ingrediente sotto soglia viene riportato a due volte la soglia, a confezioni intere.</p>
          <ul className="st-rows">
            {shop.length === 0 && <li className="st-empty">Niente da comprare: tutto sopra la soglia.</li>}
            {shop.map(({ i, packs, cost }) => (
              <li key={i.id} className="st-row">
                <div className="st-row-main"><div className="st-row-title">{i.name}<small>ora {fmtQty(i.stock, i.unit)} · confezione {fmtQty(i.pack_qty, i.unit)}{i.supplier ? ` · ${i.supplier}` : ''}</small></div></div>
                <b className="tnum st-row-price">{packs} × {fmtQty(i.pack_qty, i.unit)}</b>
                <span className="tnum st-hint" style={{ minWidth: 70, textAlign: 'right' }}>{money(cost)}</span>
              </li>
            ))}
          </ul>
          {shop.length > 0 && <div className="st-sum"><span>Spesa stimata (IVA esclusa)</span><b className="tnum">{money(shop.reduce((a, s) => a + s.cost, 0))}</b></div>}
        </>
      )}

      {view === 'moves' && (
        <ul className="st-rows">
          {data.moves.length === 0 && <li className="st-empty">Nessun movimento ancora.</li>}
          {[...data.moves].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 80).map(mv => {
            const ing = byName.get(mv.ingredient_id)
            return (
              <li key={mv.id} className="st-row">
                <div className="st-row-main"><div className="st-row-title">{ing?.name || mv.ingredient_id}<small>{REASON[mv.reason]}{mv.note ? ` · ${mv.note}` : ''} · {new Date(mv.at).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></div></div>
                <b className="tnum st-row-price">{mv.delta > 0 ? '+' : ''}{fmtQty(mv.delta, ing?.unit || 'g')}</b>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
