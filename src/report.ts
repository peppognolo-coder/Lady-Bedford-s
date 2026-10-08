import type { Costs, Ingredient, MenuItem, Order, Recipe, StockMove } from './api/types'
import { overheadPerPortion, recipeCalc, unitCost } from './costs'

export interface Range { from: Date; to: Date }   // `to` escluso
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Gli ultimi `days` giorni (oggi compreso) e i `days` giorni precedenti, per il confronto. */
export function periods(days: number, now = new Date()): { cur: Range; prev: Range } {
  const to = addDays(startOfDay(now), 1)
  const from = addDays(to, -days)
  return { cur: { from, to }, prev: { from: addDays(from, -days), to: from } }
}
export const inRange = (iso: string, r: Range) => { const t = new Date(iso).getTime(); return t >= r.from.getTime() && t < r.to.getTime() }
export const sold = (orders: Order[]) => orders.filter(o => o.status !== 'cancelled')
/** Variazione percentuale rispetto al periodo precedente; null se non confrontabile. */
export const delta = (cur: number, prev: number) => (prev > 0 ? (cur - prev) / prev : null)

export interface Summary { rev: number; n: number; avg: number; units: number; bySource: Record<string, number>; byPay: { cash: number; card: number; unpaid: number } }
export function summarize(orders: Order[]): Summary {
  const v = sold(orders)
  const s: Summary = { rev: 0, n: v.length, avg: 0, units: 0, bySource: { app: 0, floor: 0, counter: 0 }, byPay: { cash: 0, card: 0, unpaid: 0 } }
  for (const o of v) {
    s.rev += o.total; s.bySource[o.source] = (s.bySource[o.source] ?? 0) + 1
    s.units += o.items.reduce((a, i) => a + i.qty, 0)
    if (o.payment_status !== 'paid') s.byPay.unpaid += o.total; else if (o.payment_method === 'card') s.byPay.card += o.total; else s.byPay.cash += o.total
  }
  s.avg = s.n ? s.rev / s.n : 0
  return s
}

/** Ricavi e ordini per giorno, dal primo all'ultimo giorno dell'intervallo. */
export function dailySeries(orders: Order[], r: Range) {
  const out: { d: Date; key: string; rev: number; n: number }[] = []
  for (let d = new Date(r.from); d < r.to; d = addDays(d, 1)) out.push({ d, key: dayKey(d), rev: 0, n: 0 })
  const idx = new Map(out.map((x, i) => [x.key, i]))
  for (const o of sold(orders)) { const i = idx.get(dayKey(new Date(o.created_at))); if (i !== undefined) { out[i].rev += o.total; out[i].n++ } }
  return out
}

/** Ordini per giorno della settimana (lunedì = 0 … domenica = 6) e ora. */
export function heat(orders: Order[]) {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
  for (const o of sold(orders)) { const d = new Date(o.created_at); grid[(d.getDay() + 6) % 7][d.getHours()]++ }
  let best = { day: 0, hour: 0, n: 0 }
  grid.forEach((row, day) => row.forEach((n, hour) => { if (n > best.n) best = { day, hour, n } }))
  return { grid, max: Math.max(0, ...grid.flat()), best }
}

/** Ultime `weeks` settimane (lunedì–domenica), la più recente per ultima. */
export function weekly(orders: Order[], weeks = 8, now = new Date()) {
  const dow = (now.getDay() + 6) % 7
  const thisMon = addDays(startOfDay(now), -dow)
  const rows = Array.from({ length: weeks }, (_, i) => {
    const from = addDays(thisMon, -7 * (weeks - 1 - i)), to = addDays(from, 7)
    const s = summarize(orders.filter(o => inRange(o.created_at, { from, to })))
    return { from, to, rev: s.rev, n: s.n, avg: s.avg, current: i === weeks - 1 }
  })
  return rows
}

export type Quad = 'star' | 'reprice' | 'push' | 'watch'
export const QUAD_LABEL: Record<Quad, { label: string; hint: string }> = {
  star: { label: 'Punto forte', hint: 'Si vende molto e rende bene: proteggilo.' },
  reprice: { label: 'Rivedi il prezzo', hint: 'Si vende molto ma il margine è basso: valuta ricetta o prezzo.' },
  push: { label: 'Da valorizzare', hint: 'Rende bene ma si vende poco: proponilo di più.' },
  watch: { label: 'Da valutare', hint: 'Si vende poco e rende poco: forse da togliere o rilanciare.' },
}
export interface ProductRow {
  id: string; name: string; cat: string; qty: number; rev: number; net: number
  cost: number | null          // costo ingredienti (+ spese generali se richiesto) per tutte le porzioni vendute
  margin: number | null; marginPct: number | null
  incomplete: boolean          // ingredienti senza prezzo: il costo è sottostimato
  quad: Quad | null
}
export function products(orders: Order[], menu: MenuItem[], recipes: Recipe[], ings: Ingredient[], costs: Costs, withOverhead: boolean): ProductRow[] {
  const byRecipe = new Map(recipes.map(r => [r.item_id, r]))
  const info = new Map(menu.map(m => [m.id, m]))
  const acc = new Map<string, { name: string; qty: number; rev: number }>()
  for (const o of sold(orders)) for (const it of o.items) {
    const e = acc.get(it.item_id) ?? { name: it.name, qty: 0, rev: 0 }
    e.qty += it.qty; e.rev += it.qty * it.unit_price; acc.set(it.item_id, e)
  }
  const vatF = 1 + (costs.vat || 0) / 100, over = withOverhead ? overheadPerPortion(costs) : 0
  const rows: ProductRow[] = [...acc.entries()].map(([id, e]) => {
    const calc = recipeCalc(byRecipe.get(id), ings)
    const net = e.rev / vatF
    const cost = calc ? (calc.cost + over) * e.qty : null
    return { id, name: info.get(id)?.name.it ?? e.name, cat: info.get(id)?.cat ?? '', qty: e.qty, rev: e.rev, net, cost, margin: cost === null ? null : net - cost, marginPct: cost === null || net <= 0 ? null : (net - cost) / net, incomplete: !!calc && calc.incomplete.length > 0, quad: null }
  })
  const withM = rows.filter(r => r.marginPct !== null)
  if (withM.length >= 4) {
    const q = [...withM].map(r => r.qty).sort((a, b) => a - b), med = q[Math.floor(q.length / 2)]
    const target = Math.min(Math.max(costs.target_margin, 0), 90) / 100
    for (const r of withM) { const pop = r.qty >= med, good = (r.marginPct as number) >= target; r.quad = pop ? (good ? 'star' : 'reprice') : (good ? 'push' : 'watch') }
  }
  return rows.sort((a, b) => b.rev - a.rev)
}

/** Sprechi registrati nel periodo, valorizzati al costo di acquisto. */
export function waste(moves: StockMove[], ings: Ingredient[], r: Range) {
  const by = new Map(ings.map(i => [i.id, i]))
  const acc = new Map<string, { ing: Ingredient; qty: number; value: number; times: number }>()
  for (const m of moves) {
    if (m.reason !== 'spreco' || !inRange(m.at, r)) continue
    const ing = by.get(m.ingredient_id); if (!ing) continue
    const qty = Math.abs(m.delta), e = acc.get(ing.id) ?? { ing, qty: 0, value: 0, times: 0 }
    e.qty += qty; e.value += qty * unitCost(ing); e.times++; acc.set(ing.id, e)
  }
  const rows = [...acc.values()].sort((a, b) => b.value - a.value)
  return { rows, total: rows.reduce((a, x) => a + x.value, 0), times: rows.reduce((a, x) => a + x.times, 0) }
}
