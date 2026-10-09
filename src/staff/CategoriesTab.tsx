import { useState } from 'react'
import { api, type Catalog, type Category } from '../api'
import { catsOf } from '../catalog'
import { Field } from './shared'

type Save = (f: () => Promise<void>, ok?: string) => Promise<boolean>
const swap = <T,>(a: T[], i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= a.length) return a; const c = [...a];[c[i], c[j]] = [c[j], c[i]]; return c }
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'cat'

/** Le sezioni del menu: nomi (IT/EN), breve presentazione, ordine. Si possono aggiungere, rinominare, spostare ed eliminare (se vuote). */
export default function CategoriesTab({ catalog, save }: { catalog: Catalog; save: Save }) {
  const [cats, setCats] = useState<Category[]>(() => catsOf(catalog.content).map(c => ({ ...c })))
  const [dirty, setDirty] = useState(false)
  const [warn, setWarn] = useState<string | null>(null)
  const upd = (f: (o: Category[]) => Category[]) => { setCats(f); setDirty(true); setWarn(null) }
  const count = (id: string) => catalog.menu.filter(m => m.cat === id).length
  const set = (i: number, p: Partial<Category>) => upd(o => o.map((c, k) => (k === i ? { ...c, ...p } : c)))
  const add = () => upd(o => {
    let id = 'cat-' + (o.length + 1)
    const used = new Set(o.map(c => c.id))
    while (used.has(id)) id += 'x'
    return [...o, { id, it: '', en: '', introIt: '', introEn: '' }]
  })
  const del = (i: number) => {
    const c = cats[i], n = count(c.id)
    if (n > 0) { setWarn(`“${c.it || c.id}” contiene ${n} prodott${n === 1 ? 'o' : 'i'}: eliminali o spostali prima da “Menu e prezzi”.`); return }
    upd(o => o.filter((_, k) => k !== i))
  }
  const publish = async () => {
    const clean = cats.map(c => ({ ...c, it: c.it.trim(), en: c.en.trim() || c.it.trim(), introIt: c.introIt.trim(), introEn: c.introEn.trim() }))
    if (clean.some(c => !c.it)) { setWarn('Ogni categoria ha bisogno di un nome in italiano.'); return }
    // le categorie nuove prendono l'id dal nome (una sola volta, poi non cambia)
    const used = new Set(catalog.content.categories?.map(c => c.id) ?? catsOf(undefined).map(c => c.id))
    const seen = new Set<string>()
    const out = clean.map(c => {
      let id = c.id
      if (/^cat-\d+x*$/.test(id) && !used.has(id)) { id = slug(c.it); let b = id, n = 2; while (seen.has(id) || (used.has(id) && id !== c.id)) id = b + '-' + n++ }
      seen.add(id); return { ...c, id }
    })
    if (await save(() => api.saveContent({ ...catalog.content, categories: out }), 'Categorie salvate')) setDirty(false)
  }

  return (
    <div className="st-pane">
      <div className="st-rowline" style={{ justifyContent: 'space-between' }}>
        <p className="st-hint" style={{ margin: 0, flex: 1, minWidth: 220 }}>Le sezioni in cui si divide il menu (per esempio Tè, Dolci, Cocktail con alcol). Il testo di presentazione compare sotto il titolo nell’app dei clienti ed è facoltativo.</p>
        <button className="st-act" style={{ minHeight: 44, fontSize: 16 }} disabled={!dirty} onClick={publish}>{dirty ? 'Salva le categorie' : 'Nessuna modifica'}</button>
      </div>
      {warn && <div className="st-alert" role="alert">{warn}</div>}
      {cats.length === 0 && <p className="st-empty">Nessuna categoria: se salvi così tornano quelle di serie. Aggiungine almeno una.</p>}
      <ul className="st-rows">
        {cats.map((c, i) => (
          <li key={c.id} className="st-row" style={{ alignItems: 'stretch' }}>
            <div className="st-row-main" style={{ minWidth: 260 }}>
              <div className="st-form two">
                <Field label="Nome (italiano)" id={`ct-it-${i}`}><input id={`ct-it-${i}`} value={c.it} onChange={e => set(i, { it: e.target.value })} placeholder="Es. Cocktail con alcol" /></Field>
                <Field label="Nome (inglese)" id={`ct-en-${i}`}><input id={`ct-en-${i}`} value={c.en} onChange={e => set(i, { en: e.target.value })} placeholder="Es. Cocktails" /></Field>
              </div>
              <div className="st-form two">
                <Field label="Presentazione (italiano)" id={`ct-ii-${i}`}><textarea id={`ct-ii-${i}`} rows={2} value={c.introIt} onChange={e => set(i, { introIt: e.target.value })} /></Field>
                <Field label="Presentazione (inglese)" id={`ct-ie-${i}`}><textarea id={`ct-ie-${i}`} rows={2} value={c.introEn} onChange={e => set(i, { introEn: e.target.value })} /></Field>
              </div>
              <small className="st-hint">{count(c.id)} prodott{count(c.id) === 1 ? 'o' : 'i'}</small>
            </div>
            <div className="st-row-tools" style={{ flexDirection: 'column' }}>
              <button className="st-act" aria-label="Sposta su" disabled={i === 0} onClick={() => upd(o => swap(o, i, -1))}>▲</button>
              <button className="st-act" aria-label="Sposta giù" disabled={i === cats.length - 1} onClick={() => upd(o => swap(o, i, 1))}>▼</button>
              <button className="st-act danger" onClick={() => del(i)}>Elimina</button>
            </div>
          </li>
        ))}
      </ul>
      <button className="st-act" style={{ minHeight: 44, fontSize: 16, alignSelf: 'flex-start' }} onClick={add}>+ Aggiungi categoria</button>
    </div>
  )
}
