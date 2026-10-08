import { useState } from 'react'
import { api, type Costs, type FixedCost } from '../api'
import { useCatalog, sortMenu } from '../catalog'
import { useBackoffice, toNum, numStr, idOf } from '../backoffice'
import { CATS } from '../data'
import { overheadPerPortion, pct, priceCalc, recipeCalc } from '../costs'
import { Field, money } from './shared'

const roundPrice = (x: number) => Math.ceil(x * 10 - 1e-9) / 10 // al decimo di euro verso l'alto

export default function CostsTab({ onPriceSaved }: { onPriceSaved: () => void }) {
  const { data, reload } = useBackoffice()
  const { catalog } = useCatalog()
  const [form, setForm] = useState<{ fixed: { id: string; label: string; monthly: string }[]; pm: string; margin: string; vat: string } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const c = data.costs
  const total = c.fixed.reduce((a, f) => a + f.monthly, 0)

  const open = () => setForm({ fixed: c.fixed.map(f => ({ ...f, monthly: numStr(f.monthly) })), pm: numStr(c.portions_month), margin: numStr(c.target_margin), vat: numStr(c.vat) })
  const saveCosts = async () => {
    if (!form) return
    const next: Costs = {
      fixed: form.fixed.filter(f => f.label.trim()).map((f): FixedCost => ({ id: f.id || idOf(f.label), label: f.label.trim(), monthly: Math.max(0, toNum(f.monthly) || 0) })),
      portions_month: toNum(form.pm), target_margin: toNum(form.margin), vat: toNum(form.vat),
    }
    if (!(next.portions_month > 0)) return setErr('Indica quante porzioni vendi in un mese medio (anche una stima prudente).')
    if (!(next.target_margin >= 0 && next.target_margin < 90)) return setErr('Il margine deve essere tra 0 e 90.')
    if (!(next.vat >= 0 && next.vat <= 30)) return setErr('Controlla l’aliquota IVA.')
    try { setErr(null); await api.saveCosts(next); setForm(null); await reload() } catch (e) { setErr((e as Error).message) }
  }
  const apply = async (id: string, price: number) => {
    const m = catalog.menu.find(x => x.id === id); if (!m) return
    try { setErr(null); await api.saveMenuItem({ ...m, price }); onPriceSaved(); setFlash(`${m.name.it}: nuovo prezzo ${money(price)}`); setTimeout(() => setFlash(null), 2500) } catch (e) { setErr((e as Error).message) }
  }

  const byCat = CATS.map(cat => ({ cat, rows: sortMenu(catalog.menu).filter(m => m.cat === cat.id).map(m => {
    const calc = recipeCalc(data.recipes.find(r => r.item_id === m.id), data.ingredients)
    return { m, calc, pc: priceCalc(m, calc, c) }
  }) })).filter(g => g.rows.length)

  return (
    <div className="st-pane wide">
      {err && <div className="st-alert inline" role="alert">{err}</div>}
      {flash && <div className="st-flash" role="status">{flash}</div>}
      <section className="st-sheet" aria-label="Spese generali">
        <div className="st-rowline" style={{ justifyContent: 'space-between' }}>
          <h2 className="st-h3">Spese generali e obiettivi</h2>
          {!form && <button className="st-ghost" onClick={open}>Modifica</button>}
        </div>
        {!form ? (
          <div className="st-stats">
            <div className="st-stat"><span>Spese fisse al mese</span><b className="tnum">{money(total)}</b><small>{c.fixed.length ? c.fixed.map(f => f.label).join(', ') : 'Nessuna voce inserita'}</small></div>
            <div className="st-stat"><span>Porzioni al mese (stima)</span><b className="tnum">{c.portions_month.toLocaleString('it-IT')}</b><small>le spese si ripartiscono su queste</small></div>
            <div className="st-stat"><span>Spese per porzione</span><b className="tnum">{money(overheadPerPortion(c))}</b><small>si aggiungono al costo degli ingredienti</small></div>
            <div className="st-stat"><span>Margine desiderato</span><b className="tnum">{c.target_margin}%</b><small>sul prezzo netto · IVA {c.vat}%</small></div>
          </div>
        ) : (
          <>
            <ul className="st-rows">
              {form.fixed.map((f, k) => (
                <li key={k} className="st-row" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <input aria-label="Voce di spesa" placeholder="Voce (es. Affitto)" value={f.label} onChange={e => setForm({ ...form, fixed: form.fixed.map((x, i) => (i === k ? { ...x, label: e.target.value } : x)) })} style={{ flex: '2 1 200px', minHeight: 44 }} />
                  <input aria-label="Importo mensile" inputMode="decimal" placeholder="€ al mese" value={f.monthly} onChange={e => setForm({ ...form, fixed: form.fixed.map((x, i) => (i === k ? { ...x, monthly: e.target.value } : x)) })} style={{ flex: '1 1 110px', minHeight: 44 }} />
                  <button className="st-icon" aria-label="Togli voce" onClick={() => setForm({ ...form, fixed: form.fixed.filter((_, i) => i !== k) })}>×</button>
                </li>
              ))}
            </ul>
            <div className="st-actions"><button className="st-ghost" onClick={() => setForm({ ...form, fixed: [...form.fixed, { id: '', label: '', monthly: '' }] })}>+ Aggiungi voce di spesa</button></div>
            <div className="st-form">
              <Field label="Porzioni vendute in un mese medio" id="c-pm" hint="Prodotti serviti, non scontrini. Parti da una stima prudente e correggila coi dati reali."><input id="c-pm" inputMode="decimal" value={form.pm} onChange={e => setForm({ ...form, pm: e.target.value })} /></Field>
              <Field label="Margine desiderato (% del prezzo netto)" id="c-mg"><input id="c-mg" inputMode="decimal" value={form.margin} onChange={e => setForm({ ...form, margin: e.target.value })} /></Field>
              <Field label="IVA sulle vendite (%)" id="c-vat" hint="Ristorazione e bar: di norma 10%."><input id="c-vat" inputMode="decimal" value={form.vat} onChange={e => setForm({ ...form, vat: e.target.value })} /></Field>
            </div>
            <div className="st-actions"><button className="st-act" onClick={saveCosts}>Salva</button><button className="st-act alt" onClick={() => { setForm(null); setErr(null) }}>Annulla</button></div>
          </>
        )}
      </section>

      {byCat.map(({ cat, rows }) => (
        <section key={cat.id}>
          <h3 className="st-h3" style={{ margin: '4px 0 8px' }}>{cat.it}</h3>
          <div className="st-tablewrap">
            <table className="st-table">
              <thead><tr><th>Prodotto</th><th className="r">Ingredienti</th><th className="r">Costo pieno</th><th className="r">Prezzo ora</th><th className="r">Margine ora</th><th className="r">Consigliato</th><th /></tr></thead>
              <tbody>
                {rows.map(({ m, calc, pc }) => {
                  const sug = pc ? roundPrice(pc.suggestedGross) : null
                  const off = pc && pc.marginNow < c.target_margin / 100 - 0.05
                  return (
                    <tr key={m.id}>
                      <td>{m.name.it}{!calc && <small style={{ display: 'block', color: 'var(--color-accent-800)' }}>ricetta mancante</small>}</td>
                      <td className="r tnum">{pc ? money(pc.ingredients) : '—'}</td>
                      <td className="r tnum">{pc ? money(pc.total) : '—'}</td>
                      <td className="r tnum">{money(m.price)}</td>
                      <td className="r tnum" style={off ? { color: 'var(--color-accent-800)', fontWeight: 600 } : undefined}>{pc ? pct(pc.marginNow) : '—'}</td>
                      <td className="r tnum">{sug !== null ? money(sug) : '—'}</td>
                      <td className="r">{sug !== null && Math.abs(sug - m.price) >= 0.05 && <button className="st-ghost" onClick={() => apply(m.id, sug)}>Applica</button>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <p className="st-hint">Costo pieno = ingredienti + quota di spese generali. Prezzo consigliato = costo pieno ÷ (1 − margine), più IVA, arrotondato ai 10 centesimi. “Applica” cambia subito il prezzo nel menu. È un aiuto al ragionamento: la decisione sul prezzo resta tua (confronto con la zona, valore percepito).</p>
    </div>
  )
}
