import { useState } from 'react'
import { api, type MenuItem } from '../api'
import { useCatalog, sortMenu } from '../catalog'
import { useBackoffice, numStr } from '../backoffice'
import { CATS } from '../data'
import { fmtQty } from '../costs'
import RecipeEditor from './RecipeEditor'

/** Ricettario della cuoca: scrive, legge e scala le ricette. Nessun prezzo o costo. */
export default function CookRecipes() {
  const bo = useBackoffice()
  const { catalog, reload: reloadCatalog } = useCatalog()
  const { data, reload } = bo
  const [q, setQ] = useState('')
  const [view, setView] = useState<string | null>(null)       // ricetta aperta in lettura
  const [edit, setEdit] = useState<MenuItem | null>(null)      // ricetta in modifica
  const [fresh, setFresh] = useState<{ name: string; cat: string } | null>(null)
  const [servings, setServings] = useState(1)
  const [err, setErr] = useState<string | null>(null)
  const recipeOf = new Map(data.recipes.map(r => [r.item_id, r]))
  const ing = new Map(data.ingredients.map(i => [i.id, i]))
  const items = sortMenu(catalog.menu).filter(m => !q.trim() || m.name.it.toLowerCase().includes(q.trim().toLowerCase()))

  const createDraft = async () => {
    if (!fresh || !fresh.name.trim()) return setErr('Scrivi il nome della ricetta.')
    try { setErr(null); const m = await api.createDraftItem(fresh.name, fresh.cat); await reloadCatalog(); setFresh(null); setEdit(m) } catch (e) { setErr((e as Error).message) }
  }
  const opened = view ? catalog.menu.find(m => m.id === view) : null
  const rec = view ? recipeOf.get(view) : undefined

  if (edit) return <div className="st-pane"><RecipeEditor key={edit.id} item={edit} recipe={recipeOf.get(edit.id)} bo={bo} showCosts={false} onDone={async () => { const id = edit.id; setEdit(null); await reload(); await reloadCatalog(); setView(id) }} /></div>

  if (opened) {
    const factor = rec ? servings / rec.yield : 1
    return (
      <div className="st-pane">
        <div className="st-rowline" style={{ justifyContent: 'space-between' }}>
          <button className="st-ghost" onClick={() => setView(null)}>← Tutte le ricette</button>
          <button className="st-act" style={{ minHeight: 44, fontSize: 16 }} onClick={() => setEdit(opened)}>{rec ? 'Modifica' : 'Scrivi ricetta'}</button>
        </div>
        <h2 className="st-h2">{opened.name.it}</h2>
        {!rec ? <div className="st-empty">Questa ricetta non è ancora stata scritta.</div> : (
          <>
            <div className="st-rowline">
              <span className="st-hint">Preparo per</span>
              <div className="st-step" role="group" aria-label="Porzioni da preparare">
                <button aria-label="Meno porzioni" onClick={() => setServings(s => Math.max(1, s - 1))}>−</button><b className="tnum">{servings}</b><button aria-label="Più porzioni" onClick={() => setServings(s => s + 1)}>+</button>
              </div>
              <span className="st-hint">porzioni (la ricetta base ne fa {numStr(rec.yield)}){rec.prep_min ? ` · circa ${rec.prep_min} minuti` : ''}</span>
              {servings !== rec.yield && <button className="st-ghost" onClick={() => setServings(rec.yield)}>Ricetta base</button>}
            </div>
            <section className="st-sheet"><h3 className="st-h3">Ingredienti</h3>
              <ul className="st-lines">
                {rec.lines.map(l => { const i = ing.get(l.ingredient_id); return <li key={l.ingredient_id}><b className="st-qty tnum" style={{ minWidth: '7ch' }}>{i ? fmtQty(l.qty * factor, i.unit) : '?'}</b><span>{i?.name || '(ingrediente eliminato)'}</span></li> })}
              </ul>
            </section>
            {rec.method && <section className="st-sheet"><h3 className="st-h3">Preparazione</h3>
              <ol style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 8, fontSize: 17, lineHeight: 1.45 }}>{rec.method.split(/\r?\n/).filter(x => x.trim()).map((x, k) => <li key={k}>{x.replace(/^\s*\d+[.)]\s*/, '')}</li>)}</ol>
            </section>}
            {rec.notes && <div className="st-note"><b>Note</b> {rec.notes}</div>}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="st-pane">
      <div className="st-rowline" style={{ justifyContent: 'space-between' }}>
        <input aria-label="Cerca ricetta" type="search" placeholder="Cerca ricetta…" value={q} onChange={e => setQ(e.target.value)} style={{ flex: '1 1 220px', minHeight: 48, padding: '0 12px', font: 'inherit', fontSize: 16, border: '1px solid var(--color-divider)', borderRadius: 4, background: 'var(--color-bg)' }} />
        <button className="st-act" style={{ minHeight: 48, fontSize: 16 }} onClick={() => setFresh({ name: '', cat: 'pastry' })}>Nuova ricetta</button>
      </div>
      {err && <div className="st-alert inline" role="alert">{err}</div>}
      {fresh && (
        <section className="st-sheet" aria-label="Nuova ricetta">
          <h2 className="st-h3">Nuova ricetta</h2>
          <div className="st-form">
            <div className="st-field"><label htmlFor="nr-name">Nome</label><input id="nr-name" autoFocus value={fresh.name} onChange={e => setFresh({ ...fresh, name: e.target.value })} maxLength={60} placeholder="es. Torta di carote" /></div>
            <div className="st-field"><label htmlFor="nr-cat">Categoria</label><select id="nr-cat" value={fresh.cat} onChange={e => setFresh({ ...fresh, cat: e.target.value })}>{CATS.map(c => <option key={c.id} value={c.id}>{c.it}</option>)}</select></div>
          </div>
          <p className="st-hint">La ricetta resta una bozza: arriva nel menu solo quando la proprietà decide il prezzo e la pubblica.</p>
          <div className="st-actions"><button className="st-act" onClick={createDraft}>Continua</button><button className="st-act alt" onClick={() => { setFresh(null); setErr(null) }}>Annulla</button></div>
        </section>
      )}
      {CATS.map(c => {
        const rows = items.filter(m => m.cat === c.id)
        if (!rows.length) return null
        return (
          <section key={c.id}>
            <h3 className="st-h3" style={{ margin: '4px 0 6px' }}>{c.it}</h3>
            <ul className="st-rows">
              {rows.map(m => {
                const r = recipeOf.get(m.id)
                return (
                  <li key={m.id} className="st-row">
                    <div className="st-row-main"><div className="st-row-title">{m.name.it}</div>
                      <div className="st-row-tags">{!r ? <span className="st-pill unpaid">Da scrivere</span> : <span className="st-pill paid">{r.lines.length} ingredienti · {numStr(r.yield)} porz.</span>}{!m.visible && <span className="st-pill">Bozza</span>}</div></div>
                    <div className="st-row-tools"><button className="st-ghost" onClick={() => { setView(m.id); setServings(r?.yield || 1) }}>{r ? 'Apri' : 'Scrivi'}</button></div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
