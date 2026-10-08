import type { Backoffice, Costs, Ingredient, MenuItem, Recipe } from './api/types'

export const DEFAULT_COSTS: Costs = { fixed: [], portions_month: 1500, target_margin: 60, vat: 10 }
export const EMPTY_BACKOFFICE: Backoffice = { ingredients: [], recipes: [], costs: DEFAULT_COSTS, moves: [] }

/** Costo di una unità (1 g, 1 ml, 1 pz) di ingrediente. */
export const unitCost = (i: Ingredient) => (i.pack_qty > 0 ? i.pack_price / i.pack_qty : 0)

export interface RecipeCalc {
  cost: number          // costo ingredienti per porzione
  missing: string[]     // righe con ingrediente non più presente
  incomplete: string[]  // ingredienti senza prezzo di acquisto: il costo è sottostimato
  perPortion: { ingredient: Ingredient; qty: number; cost: number }[]
}
export function recipeCalc(r: Recipe | undefined, ings: Ingredient[]): RecipeCalc | null {
  if (!r || !r.lines.length || r.yield <= 0) return null
  const by = new Map(ings.map(i => [i.id, i]))
  const out: RecipeCalc = { cost: 0, missing: [], incomplete: [], perPortion: [] }
  for (const l of r.lines) {
    const ing = by.get(l.ingredient_id)
    if (!ing) { out.missing.push(l.ingredient_id); continue }
    if (!(ing.pack_price > 0)) out.incomplete.push(ing.name)
    const qty = l.qty / r.yield
    const cost = qty * unitCost(ing)
    out.cost += cost
    out.perPortion.push({ ingredient: ing, qty, cost })
  }
  return out
}

/** Spese generali ripartite su ogni porzione venduta. */
export const overheadPerPortion = (c: Costs) =>
  c.portions_month > 0 ? c.fixed.reduce((a, f) => a + (f.monthly || 0), 0) / c.portions_month : 0

export interface PriceCalc {
  ingredients: number; overhead: number; total: number
  suggestedNet: number; suggestedGross: number   // prezzo consigliato (IVA esclusa / inclusa)
  netNow: number; marginNow: number              // sul prezzo attuale: margine € e %
  foodCostPct: number                            // ingredienti / prezzo netto attuale
}
export function priceCalc(item: MenuItem, calc: RecipeCalc | null, costs: Costs): PriceCalc | null {
  if (!calc) return null
  const ingredients = calc.cost
  const overhead = overheadPerPortion(costs)
  const total = ingredients + overhead
  const m = Math.min(Math.max(costs.target_margin, 0), 90) / 100
  const suggestedNet = total / (1 - m)
  const vatF = 1 + costs.vat / 100
  const netNow = item.price / vatF
  return {
    ingredients, overhead, total, suggestedNet, suggestedGross: suggestedNet * vatF, netNow,
    marginNow: netNow > 0 ? (netNow - total) / netNow : 0,
    foodCostPct: netNow > 0 ? ingredients / netNow : 0,
  }
}

/** Quante porzioni si possono ancora preparare con le scorte. null = ricetta mancante. */
export function portionsLeft(r: Recipe | undefined, ings: Ingredient[]): number | null {
  if (!r || !r.lines.length || r.yield <= 0) return null
  const by = new Map(ings.map(i => [i.id, i]))
  let min = Infinity
  for (const l of r.lines) {
    const ing = by.get(l.ingredient_id); if (!ing || l.qty <= 0) continue
    min = Math.min(min, Math.floor(ing.stock / (l.qty / r.yield)))
  }
  return Number.isFinite(min) ? Math.max(0, min) : null
}

/** Consumo delle righe di un ordine, per ingrediente. */
export function consumption(items: { item_id: string; qty: number }[], recipes: Recipe[]) {
  const by = new Map(recipes.map(r => [r.item_id, r]))
  const used = new Map<string, number>()
  for (const it of items) {
    const r = by.get(it.item_id); if (!r || r.yield <= 0) continue
    for (const l of r.lines) used.set(l.ingredient_id, (used.get(l.ingredient_id) || 0) + (l.qty / r.yield) * it.qty)
  }
  return used
}

export const fmtQty = (n: number, unit: string) => {
  if (unit === 'g' && Math.abs(n) >= 1000) return `${(n / 1000).toLocaleString('it-IT', { maximumFractionDigits: 2 })} kg`
  if (unit === 'ml' && Math.abs(n) >= 1000) return `${(n / 1000).toLocaleString('it-IT', { maximumFractionDigits: 2 })} l`
  return `${n.toLocaleString('it-IT', { maximumFractionDigits: unit === 'pz' ? 1 : 0 })} ${unit}`
}
export const pct = (x: number) => `${(x * 100).toLocaleString('it-IT', { maximumFractionDigits: 0 })}%`
