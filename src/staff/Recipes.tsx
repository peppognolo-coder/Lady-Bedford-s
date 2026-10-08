import { AllergenChips } from './AllergenPicker'
import { useState } from 'react'
import { api, type Ingredient, type MenuItem, type Recipe, type Unit } from '../api'
import { useCatalog, sortMenu } from '../catalog'
import { useBackoffice, toNum, numStr, idOf } from '../backoffice'
import { CATS } from '../data'
import { fmtQty, overheadPerPortion, pct, priceCalc, recipeCalc, unitCost } from '../costs'
import { Field, money } from './shared'
import RecipeEditor from './RecipeEditor'

type Sub = 'recipes' | 'ings'

export default function RecipesTab() {
  const [sub, setSub] = useState<Sub>('recipes')
  const bo = useBackoffice()
  return (
    <div className="st-pane">
      <div className="st-chips" role="tablist">
        <button role="tab" aria-selected={sub === 'recipes'} onClick={() => setSub('recipes')}>Ricette</button>
        <button role="tab" aria-selected={sub === 'ings'} onClick={() => setSub('ings')}>Ingredienti e prezzi di acquisto ({bo.data.ingredients.length})</button>
      </div>
      {bo.error && <div className="st-alert inline" role="alert">{bo.error}</div>}
      {sub === 'ings' ? <Ingredients bo={bo} /> : <Recipes bo={bo} />}
    </div>
  )
}
type BO = ReturnType<typeof useBackoffice>

/* ---------- ingredienti ---------- */
function Ingredients({ bo }: { bo: BO }) {
  const { data, reload } = bo
  const [edit, setEdit] = useState<Ingredient | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [paste, setPaste] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const used = new Set(data.recipes.flatMap(r => r.lines.map(l => l.ingredient_id)))

  const doSave = async (i: Ingredient) => { try { setErr(null); await api.saveIngredient(i); setEdit(null); await reload() } catch (e) { setErr((e as Error).message) } }
  const remove = async (i: Ingredient) => {
    if (used.has(i.id)) return setErr(`“${i.name}” è usato in almeno una ricetta: toglilo prima dalle ricette.`)
    try { setErr(null); await api.deleteIngredient(i.id); setEdit(null); await reload() } catch (e) { setErr((e as Error).message) }
  }
  const importRows = async () => {
    const rows = (paste || '').split(/\r?\n/).map(r => r.trim()).filter(Boolean)
    let n = 0
    try {
      setErr(null)
      for (const r of rows) {
        const c = r.split(/[;\t]/).map(x => x.trim())
        if (c.length < 4) throw new Error(`Riga incompleta: “${r}” (servono: nome; unità; quantità confezione; prezzo)`)
        const unit = c[1].toLowerCase() as Unit
        if (!['g', 'ml', 'pz'].includes(unit)) throw new Error(`Unità non valida in “${r}”: usa g, ml o pz.`)
        const [pq, pp, st, mn] = [toNum(c[2]), toNum(c[3]), toNum(c[4] || '0'), toNum(c[5] || '0')]
        if (!(pq > 0) || !(pp >= 0)) throw new Error(`Numeri non validi in “${r}”.`)
        const existing = data.ingredients.find(x => x.name.toLowerCase() === c[0].toLowerCase())
        await api.saveIngredient({ id: existing?.id || idOf(c[0]), name: c[0], unit, pack_qty: pq, pack_price: pp, stock: existing ? existing.stock : (st || 0), min_stock: mn || existing?.min_stock || 0 })
        n++
      }
      setPaste(null); await reload()
    } catch (e) { setErr(`${(e as Error).message}${n ? ` (importate ${n} righe prima dell’errore)` : ''}`) }
  }

  return (
    <>
      <div className="st-rowline" style={{ justifyContent: 'space-between' }}>
        <p className="st-hint" style={{ margin: 0, flex: 1, minWidth: 220 }}>Qui vive la “lista della spesa”: cosa compri, in che confezioni e a che prezzo (IVA esclusa). Il costo al grammo si calcola da solo.</p>
        <button className="st-ghost" onClick={() => setPaste('')}>Incolla elenco</button>
        <button className="st-act" style={{ minHeight: 44, fontSize: 16 }} onClick={() => { setEdit({ id: '', name: '', unit: 'g', pack_qty: 1000, pack_price: 0, stock: 0, min_stock: 0 }); setIsNew(true) }}>Nuovo ingrediente</button>
      </div>
      {err && <div className="st-alert inline" role="alert">{err}</div>}
      {paste !== null && (
        <section className="st-sheet" aria-label="Incolla elenco ingredienti">
          <h2 className="st-h3">Incolla un elenco</h2>
          <p className="st-hint">Una riga per ingrediente, separata da punto e virgola (o tabulazione, da Excel): <b>nome; unità; quantità confezione; prezzo confezione; giacenza; soglia</b>. Giacenza e soglia sono facoltative. Esempio: <i>Farina 00; g; 1000; 0,90; 8000; 3000</i>. Se il nome esiste già, i dati si aggiornano (la giacenza no).</p>
          <textarea aria-label="Elenco ingredienti" rows={8} value={paste} onChange={e => setPaste(e.target.value)} style={{ width: '100%', font: 'inherit', fontSize: 14 }} />
          <div className="st-actions"><button className="st-act" onClick={importRows} disabled={!paste.trim()}>Importa</button><button className="st-act alt" onClick={() => setPaste(null)}>Annulla</button></div>
        </section>
      )}
      {edit && <IngredientForm key={edit.id || 'new'} ing={edit} isNew={isNew} onSave={doSave} onCancel={() => setEdit(null)} onDelete={isNew ? undefined : () => remove(edit)} />}
      <ul className="st-rows">
        {data.ingredients.length === 0 && <li className="st-empty">Nessun ingrediente. Aggiungili uno a uno o incolla l’elenco della spesa.</li>}
        {data.ingredients.map(i => (
          <li key={i.id} className="st-row">
            <div className="st-row-main"><div className="st-row-title">{i.name}<small>confezione {fmtQty(i.pack_qty, i.unit)} a {money(i.pack_price)}{i.supplier ? ` · ${i.supplier}` : ''}</small></div>{!(i.pack_price > 0) && <div className="st-row-tags"><span className="st-pill unpaid">Prezzo da inserire</span></div>}</div>
            <span className="st-hint tnum" style={{ minWidth: 110, textAlign: 'right' }}>{money(unitCost(i) * (i.unit === 'pz' ? 1 : 1000))} / {i.unit === 'g' ? 'kg' : i.unit === 'ml' ? 'l' : 'pz'}</span>
            <div className="st-row-tools"><button className="st-ghost" onClick={() => { setEdit(i); setIsNew(false) }}>Modifica</button></div>
          </li>
        ))}
      </ul>
    </>
  )
}

function IngredientForm({ ing, isNew, onSave, onCancel, onDelete }: { ing: Ingredient; isNew: boolean; onSave: (i: Ingredient) => void; onCancel: () => void; onDelete?: () => void }) {
  const [i, setI] = useState(ing)
  const [pq, setPq] = useState(numStr(ing.pack_qty)), [pp, setPp] = useState(numStr(ing.pack_price)), [st, setSt] = useState(numStr(ing.stock)), [mn, setMn] = useState(numStr(ing.min_stock))
  const [err, setErr] = useState<string | null>(null)
  const submit = () => {
    const [a, b, c, d] = [toNum(pq), toNum(pp || '0'), toNum(st || '0'), toNum(mn || '0')]
    if (!i.name.trim()) return setErr('Inserisci il nome.')
    if (!(a > 0)) return setErr('La quantità della confezione deve essere maggiore di zero.')
    if (!(b >= 0) || !Number.isFinite(c) || !(d >= 0)) return setErr('Controlla prezzo, giacenza e soglia.')
    onSave({ ...i, name: i.name.trim(), pack_qty: a, pack_price: b, stock: c, min_stock: d, id: i.id || idOf(i.name) })
  }
  return (
    <section className="st-sheet" aria-label={isNew ? 'Nuovo ingrediente' : `Modifica ${ing.name}`}>
      <h2 className="st-h3">{isNew ? 'Nuovo ingrediente' : 'Modifica ingrediente'}</h2>
      <div className="st-form">
        <Field label="Nome" id="i-name"><input id="i-name" value={i.name} onChange={e => setI({ ...i, name: e.target.value })} maxLength={60} /></Field>
        <Field label="Si misura in" id="i-unit"><select id="i-unit" value={i.unit} onChange={e => setI({ ...i, unit: e.target.value as Unit })}><option value="g">grammi (g)</option><option value="ml">millilitri (ml)</option><option value="pz">pezzi (pz)</option></select></Field>
        <Field label={`Quantità per confezione (${i.unit})`} id="i-pq" hint="Es. un sacco da 1 kg = 1000 g"><input id="i-pq" inputMode="decimal" value={pq} onChange={e => setPq(e.target.value)} /></Field>
        <Field label="Prezzo della confezione (€, IVA esclusa)" id="i-pp"><input id="i-pp" inputMode="decimal" value={pp} onChange={e => setPp(e.target.value)} /></Field>
        <Field label={`Giacenza attuale (${i.unit})`} id="i-st" hint={isNew ? 'Quanto ne hai in dispensa all’apertura.' : 'Per correggerla usa “Conta” in Scorte, così resta traccia.'}><input id="i-st" inputMode="decimal" value={st} onChange={e => setSt(e.target.value)} disabled={!isNew} /></Field>
        <Field label={`Soglia di riordino (${i.unit})`} id="i-mn" hint="Sotto questa quantità finisce nella lista della spesa."><input id="i-mn" inputMode="decimal" value={mn} onChange={e => setMn(e.target.value)} /></Field>
        <Field label="Allergeni contenuti" id="i-all" hint="Servono per calcolare in automatico gli allergeni dei piatti."><AllergenChips value={i.allergens ?? []} onChange={v => setI({ ...i, allergens: v })} /></Field>
        <Field label="Fornitore (facoltativo)" id="i-sup"><input id="i-sup" value={i.supplier || ''} onChange={e => setI({ ...i, supplier: e.target.value })} maxLength={60} /></Field>
      </div>
      {err && <div className="st-alert inline" role="alert">{err}</div>}
      <div className="st-actions"><button className="st-act" onClick={submit}>Salva</button><button className="st-act alt" onClick={onCancel}>Annulla</button>{onDelete && <button className="st-act alt" onClick={onDelete}>Elimina</button>}</div>
    </section>
  )
}

/* ---------- ricette ---------- */
function Recipes({ bo }: { bo: BO }) {
  const { data, reload } = bo
  const { catalog } = useCatalog()
  const [cat, setCat] = useState('tea')
  const [sel, setSel] = useState<MenuItem | null>(null)
  const recipeOf = new Map(data.recipes.map(r => [r.item_id, r]))
  const list = sortMenu(catalog.menu).filter(m => m.cat === cat)
  return (
    <>
      <div className="st-chips" role="tablist">{CATS.map(c => <button key={c.id} role="tab" aria-selected={cat === c.id} onClick={() => { setCat(c.id); setSel(null) }}>{c.it}</button>)}</div>
      {sel && <RecipeEditor key={sel.id} item={sel} recipe={recipeOf.get(sel.id)} bo={bo} showCosts onDone={async () => { setSel(null); await reload() }} />}
      <ul className="st-rows">
        {list.map(m => {
          const calc = recipeCalc(recipeOf.get(m.id), data.ingredients)
          const pc = priceCalc(m, calc, data.costs)
          return (
            <li key={m.id} className="st-row">
              <div className="st-row-main"><div className="st-row-title">{m.name.it}<small>prezzo {money(m.price)}</small></div>
                <div className="st-row-tags">{!calc ? <span className="st-pill unpaid">Ricetta mancante</span> : <><span className="st-pill">Ingredienti {money(calc.cost)}</span>{pc && <span className={`st-pill ${pc.marginNow < data.costs.target_margin / 100 - 0.05 ? 'unpaid' : 'paid'}`}>Margine {pct(pc.marginNow)}</span>}{calc.missing.length > 0 && <span className="st-pill unpaid">Ingrediente eliminato</span>}{calc.incomplete.length > 0 && <span className="st-pill unpaid">Prezzo da inserire: {calc.incomplete.slice(0, 2).join(', ')}{calc.incomplete.length > 2 ? '…' : ''}</span>}</>}</div></div>
              <div className="st-row-tools"><button className="st-ghost" onClick={() => setSel(m)}>{calc ? 'Modifica' : 'Scrivi ricetta'}</button></div>
            </li>
          )
        })}
      </ul>
      <p className="st-hint">Per ogni prodotto scrivi la ricetta come la prepara la cuoca (quantità totali) e quante porzioni ne escono: costo e scarico delle scorte si calcolano da sole.</p>
    </>
  )
}
