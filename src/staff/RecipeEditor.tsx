import { useState } from 'react'
import { api, type MenuItem, type Recipe, type Unit } from '../api'
import type { useBackoffice } from '../backoffice'
import { toNum, numStr } from '../backoffice'
import { overheadPerPortion, priceCalc, recipeCalc, pct } from '../costs'
import { Field, money } from './shared'

type BO = ReturnType<typeof useBackoffice>
interface Line { name: string; qty: string; unit: Unit }

/** Editor di una ricetta. Usato dalla cuoca (senza costi) e dalla proprietà (con costi). */
export default function RecipeEditor({ item, recipe, bo, showCosts, onDone }: { item: MenuItem; recipe?: Recipe; bo: BO; showCosts: boolean; onDone: () => void }) {
  const { data } = bo
  const byId = new Map(data.ingredients.map(i => [i.id, i]))
  const byName = new Map(data.ingredients.map(i => [i.name.trim().toLowerCase(), i]))
  const [name, setName] = useState(item.name.it)
  const [yld, setYld] = useState(numStr(recipe?.yield ?? 1))
  const [prep, setPrep] = useState(recipe?.prep_min ? String(recipe.prep_min) : '')
  const [lines, setLines] = useState<Line[]>((recipe?.lines || []).map(l => ({ name: byId.get(l.ingredient_id)?.name || '', qty: numStr(l.qty), unit: byId.get(l.ingredient_id)?.unit || 'g' })))
  const [method, setMethod] = useState(recipe?.method || '')
  const [notes, setNotes] = useState(recipe?.notes || '')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: number, patch: Partial<Line>) => setLines(ls => ls.map((l, i) => (i === k ? { ...l, ...patch } : l)))

  // anteprima costi (solo proprietà): considera solo gli ingredienti già esistenti
  const draft: Recipe = { item_id: item.id, yield: toNum(yld) || 0, lines: lines.map(l => ({ ing: byName.get(l.name.trim().toLowerCase()), qty: toNum(l.qty) })).filter(l => l.ing && l.qty > 0).map(l => ({ ingredient_id: l.ing!.id, qty: l.qty })) }
  const calc = showCosts ? recipeCalc(draft, data.ingredients) : null
  const pc = priceCalc(item, calc, data.costs)

  const save = async () => {
    const filled = lines.filter(l => l.name.trim() || l.qty.trim())
    if (!name.trim()) return setErr('Scrivi il nome della ricetta.')
    if (!(toNum(yld) > 0)) return setErr('Indica quante porzioni escono da questa ricetta.')
    if (!filled.length) return setErr('Aggiungi almeno un ingrediente.')
    if (filled.some(l => !l.name.trim() || !(toNum(l.qty) > 0))) return setErr('Ogni ingrediente ha bisogno di un nome e di una dose maggiore di zero.')
    try {
      setErr(null); setBusy(true)
      const out: Recipe['lines'] = []
      for (const l of filled) {
        let ing = byName.get(l.name.trim().toLowerCase())
        if (!ing) ing = await api.addIngredient(l.name.trim(), l.unit)   // ingrediente nuovo: il prezzo lo inserisce la proprietà
        const ex = out.find(o => o.ingredient_id === ing!.id)
        if (ex) ex.qty += toNum(l.qty); else out.push({ ingredient_id: ing.id, qty: toNum(l.qty) })
      }
      if (name.trim() !== item.name.it && item.visible === false) await api.saveMenuItem({ ...item, name: { it: name.trim(), en: name.trim() } }).catch(() => undefined)
      await api.saveRecipe({ item_id: item.id, yield: toNum(yld), lines: out, notes: notes.trim() || undefined, method: method.trim() || undefined, prep_min: toNum(prep) > 0 ? Math.round(toNum(prep)) : undefined })
      onDone()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const drop = async () => { try { await api.deleteRecipe(item.id); onDone() } catch (e) { setErr((e as Error).message) } }

  return (
    <section className="st-sheet" aria-label={`Ricetta ${item.name.it}`}>
      <h2 className="st-h3">{recipe ? 'Modifica ricetta' : 'Nuova ricetta'}</h2>
      <datalist id="ing-names">{data.ingredients.map(i => <option key={i.id} value={i.name} />)}</datalist>
      <div className="st-form">
        {!item.visible && <Field label="Nome della ricetta" id="r-name"><input id="r-name" value={name} onChange={e => setName(e.target.value)} maxLength={60} /></Field>}
        <Field label="Porzioni che escono da questa ricetta" id="r-yield" hint="Es. la teglia di scone ne fa 8; una tazza di tè, 1."><input id="r-yield" inputMode="decimal" value={yld} onChange={e => setYld(e.target.value)} /></Field>
        <Field label="Tempo di preparazione (minuti)" id="r-prep"><input id="r-prep" inputMode="numeric" value={prep} onChange={e => setPrep(e.target.value)} placeholder="facoltativo" /></Field>
      </div>

      <h3 className="st-h3" style={{ fontSize: 17 }}>Ingredienti e dosi (per l’intera ricetta)</h3>
      <ul className="st-rows">
        {lines.map((l, k) => {
          const known = byName.get(l.name.trim().toLowerCase())
          return (
            <li key={k} className="st-row" style={{ flexWrap: 'wrap', gap: 8 }}>
              <input aria-label="Ingrediente" list="ing-names" placeholder="Ingrediente (scegli o scrivi)" value={l.name} onChange={e => set(k, { name: e.target.value })} style={{ flex: '2 1 200px', minHeight: 48 }} />
              <input aria-label="Dose" inputMode="decimal" placeholder="Dose" value={l.qty} onChange={e => set(k, { qty: e.target.value })} style={{ flex: '1 1 80px', minWidth: 80, minHeight: 48 }} />
              {known ? <span className="st-hint" style={{ minWidth: 34 }}>{known.unit}</span> : l.name.trim() ? (
                <select aria-label="Unità di misura" value={l.unit} onChange={e => set(k, { unit: e.target.value as Unit })} style={{ minHeight: 48 }}><option value="g">g</option><option value="ml">ml</option><option value="pz">pz</option></select>
              ) : <span style={{ minWidth: 34 }} />}
              {!known && l.name.trim() && <span className="st-pill preparing">nuovo ingrediente</span>}
              <button className="st-icon" aria-label="Togli riga" onClick={() => setLines(ls => ls.filter((_, i) => i !== k))}>×</button>
            </li>
          )
        })}
      </ul>
      <div className="st-actions"><button className="st-ghost" onClick={() => setLines(ls => [...ls, { name: '', qty: '', unit: 'g' }])}>+ Aggiungi ingrediente</button></div>

      <Field label="Preparazione" id="r-method" hint="Un passaggio per riga."><textarea id="r-method" rows={8} value={method} onChange={e => setMethod(e.target.value)} maxLength={4000} placeholder={'Setacciare la farina…\nUnire il burro freddo a cubetti…'} /></Field>
      <Field label="Note, varianti, allergeni (facoltative)" id="r-notes"><textarea id="r-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} /></Field>

      {showCosts && calc && pc && (
        <div className="st-stats">
          <div className="st-stat"><span>Ingredienti per porzione</span><b className="tnum">{money(calc.cost)}</b><small>food cost {pct(pc.foodCostPct)} del prezzo netto{calc.incomplete.length ? ` · mancano i prezzi di: ${calc.incomplete.join(', ')}` : ''}</small></div>
          <div className="st-stat"><span>+ spese generali</span><b className="tnum">{money(overheadPerPortion(data.costs))}</b><small>costo pieno {money(pc.total)}</small></div>
          <div className="st-stat"><span>Prezzo consigliato</span><b className="tnum">{money(pc.suggestedGross)}</b><small>IVA {data.costs.vat}% inclusa, margine {data.costs.target_margin}%. Ora: {money(item.price)}</small></div>
        </div>
      )}
      {err && <div className="st-alert inline" role="alert">{err}</div>}
      <div className="st-actions"><button className="st-act" onClick={save} disabled={busy}>Salva ricetta</button><button className="st-act alt" onClick={onDone}>Annulla</button>{recipe && <button className="st-act alt" onClick={drop}>Elimina ricetta</button>}</div>
    </section>
  )
}
