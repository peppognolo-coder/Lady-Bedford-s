import { DEFAULT_CATALOG } from '../defaults'
import { EMPTY_BACKOFFICE, consumption } from '../costs'
import { demoBackoffice } from '../demoBackoffice'
import { EMPTY_CONTENT } from '../content'
import { toDataUrl } from '../image'
import { availability, checkBooking, DEFAULT_BOOKING } from '../booking'
import { demoStaff } from '../demoStaff'
import { withConfigDefaults } from '../shifts'
import type { Shift, StaffConfig, StaffMember, Booking, BookingPublic, BookingStatus, Closure, Api, Backoffice, Catalog, MenuItem, MoveReason, NewOrder, Order, Role, Status } from './types'

// Modalità demo: tutto nel browser (localStorage), condiviso tra le schede dello stesso browser.
const KEY = 'lb:demo:v2'
const PINS: Record<Role, string> = { kitchen: '111111', cashier: '222222', waiter: '333333', owner: '44444444' }
type DB = { staff?: { members: StaffMember[]; shifts: Shift[]; config?: StaffConfig }; bookings?: Booking[]; closures?: Closure[]; pins?: Partial<Record<Role, string>>; orders: Order[]; seq: Record<string, number>; catalog: Catalog; back?: Backoffice }

let mem: DB = { orders: [], seq: {}, catalog: DEFAULT_CATALOG, back: EMPTY_BACKOFFICE }
const read = (): DB => {
  let found = false
  try { const raw = localStorage.getItem(KEY); if (raw) { mem = JSON.parse(raw); found = true; if (!mem.catalog.content) mem.catalog = { ...mem.catalog, content: EMPTY_CONTENT }; if (!mem.catalog.booking) mem.catalog = { ...mem.catalog, booking: DEFAULT_BOOKING } } } catch { /* usa memoria */ }
  if (!found && window.__LB_DEMO?.seed) { mem = { ...mem, ...demoOrders(mem.catalog), back: demoBackoffice(), bookings: demoBookings() }; try { localStorage.setItem(KEY, JSON.stringify(mem)) } catch { /* ignore */ } }
  return mem
}
const demoBookings = (): Booking[] => {
  const d = (n: number) => { const x = new Date(); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }
  const mk = (n: number, kind: string, day: string, time: string | null, party: number, name: string, status: Booking['status'], phone: string | null, note: string | null = null, table: string | null = null): Booking =>
    ({ id: 'bk' + n, ref: 'DM' + String(n).padStart(3, '0'), created_at: new Date().toISOString(), kind, day, time, party, name, phone, note, status, table_label: table, source: 'app' })
  return [
    mk(1, 'tea', d(0), '16:00', 4, 'Famiglia Rossi', 'confirmed', '333 1112233', 'Compleanno: una candelina sulla torta', 'Tavolo 3'),
    mk(2, 'table', d(0), '17:00', 2, 'Marta B.', 'pending', '347 5556677'),
    mk(3, 'table', d(1), '12:30', 6, 'Studio Verdi', 'confirmed', '02 3344556', 'Una persona vegana'),
    mk(4, 'party', d(9), null, 18, 'Chiara L.', 'pending', '339 8899001', 'Baby shower, sabato pomeriggio'),
  ]
}
declare global { interface Window { __LB_DEMO?: { role?: Role; seed?: boolean } } }
let memRole: Role | null = null
const getRole = (): Role | null => {
  try { const r = sessionStorage.getItem('lb:demo:role') as Role | null; if (r) return r } catch { /* ignore */ }
  return memRole ?? window.__LB_DEMO?.role ?? null
}
const demoOrders = (cat: Catalog): { orders: Order[]; seq: Record<string, number> } => {
  const price = (id: string) => cat.menu.find(m => m.id === id)!
  const mk = (n: number, daysAgo: number, minAgo: number, src: Order['source'], who: string, table: string | null, slot: string | null,
    lines: [string, number][], status: Status, pay: 'cash' | 'card' | null, note: string | null = null): Order => {
    const items = lines.map(([id, qty]) => { const m = price(id); return { item_id: m.id, name: m.name.it, cat: m.cat, qty, unit_price: m.price } })
    const d = new Date(Date.now() - minAgo * 60000); d.setDate(d.getDate() - daysAgo)
    return { id: uid(), number: n, source: src, customer_name: who, table_label: table, pickup_slot: slot, note, status,
      payment_method: pay, payment_status: pay ? 'paid' : 'unpaid', total: items.reduce((a, i) => a + i.unit_price * i.qty, 0),
      created_at: d.toISOString(), items }
  }
  const orders: Order[] = [
    mk(1, 0, 95, 'app', 'Giulia R.', null, '12:30', [['scone', 2], ['darj', 2]], 'completed', 'card'),
    mk(2, 0, 70, 'floor', '', 'Tavolo 3', null, [['cucu', 2], ['earl', 2], ['lemon', 1]], 'served', null),
    mk(3, 0, 40, 'counter', 'Marco', null, null, [['short', 3], ['rooi', 1]], 'completed', 'cash'),
    mk(4, 0, 22, 'floor', '', 'Tavolo 5', null, [['scone', 3], ['blend', 3]], 'preparing', null, 'Una persona senza lattosio'),
    mk(5, 0, 14, 'app', 'Anna B.', null, '16:00', [['pie', 1], ['sponge', 2], ['earl', 2]], 'preparing', null),
    mk(6, 0, 8, 'floor', '', 'Tavolo 1', null, [['darj', 2], ['sponge', 2]], 'ready', null),
    mk(7, 0, 3, 'app', 'Luca P.', null, '17:00', [['scone', 2], ['rooi', 2]], 'new', null),
    mk(8, 0, 1, 'floor', '', 'Tavolo 7', null, [['cucu', 1], ['rare', 1], ['lemon', 1]], 'new', null),
  ]
  const seq: Record<string, number> = { [dayKey()]: orders.length }
  let n = 100
  for (let d = 1; d <= 13; d++) {
    const k = 2 + ((d * 7) % 9)
    for (let j = 0; j < k; j++) {
      orders.push(mk(n++, d, 200 + j * 37, j % 3 === 0 ? 'app' : 'counter', 'Ospite', null, null,
        [[['scone', 'cucu', 'lemon', 'sponge', 'short'][(d + j) % 5], 1 + (j % 3)], [['darj', 'earl', 'rooi', 'blend'][(d * j) % 4], 1 + (d % 2)]], 'completed', j % 2 ? 'card' : 'cash'))
    }
  }
  return { orders, seq }
}
const slugId = (s: string) => (s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'voce') + '-' + Math.random().toString(36).slice(2, 5)
const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2))

export function createLocalApi(): Api {
  const pub = (b: Booking): BookingPublic => ({ id: b.id, ref: b.ref, status: b.status, kind: b.kind, day: b.day, time: b.time, party: b.party, name: b.name, table_label: b.table_label })
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach(f => f())
  const write = (db: DB) => { mem = db; try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { throw new Error('Spazio del browser esaurito: usa foto più piccole o meno foto (in produzione le foto vanno su Supabase).') } notify() }
  window.addEventListener('storage', e => { if (e.key === KEY) notify() })

  const create = (o: NewOrder, source: 'app' | 'counter' | 'floor') => {
    if (!o.items.length || o.items.length > 30) throw new Error('Ordine vuoto o troppo grande')
    const db = read()
    const key = dayKey()
    const number = (db.seq[key] || 0) + 1
    let total = 0
    const items = o.items.map(i => {
      const m = db.catalog.menu.find(x => x.id === i.item_id)
      if (!m || !m.visible) throw new Error('Prodotto sconosciuto')
      if (!m.available) throw new Error(`Esaurito: ${m.name.it}`)
      if (i.qty < 1 || i.qty > 20) throw new Error('Quantità non valida')
      total += m.price * i.qty
      return { item_id: m.id, name: m.name.it, cat: m.cat, qty: i.qty, unit_price: m.price }
    })
    const paid = source !== 'app' && !!o.pay
    const order: Order = {
      id: uid(), number, source, customer_name: o.customer_name.trim().slice(0, 60), table_label: o.table_label?.trim() || null,
      pickup_slot: o.pickup_slot || null, note: o.note?.trim() || null, status: 'new',
      payment_method: paid ? o.pay! : null, payment_status: paid ? 'paid' : 'unpaid',
      total, created_at: new Date().toISOString(), items,
    }
    write({ ...db, seq: { ...db.seq, [key]: number }, orders: [...db.orders, order] })
    return { id: order.id, number }
  }
  const patch = (id: string, f: (o: Order) => Order) => { const db = read(); write({ ...db, orders: db.orders.map(o => (o.id === id ? f(o) : o)) }) }
  const putCatalog = (f: (c: Catalog) => Catalog) => { const db = read(); write({ ...db, catalog: f(db.catalog) }) }
  const upsert = <T extends { id: string }>(list: T[], item: T) => (list.some(x => x.id === item.id) ? list.map(x => (x.id === item.id ? item : x)) : [...list, item])

  const staffDb = (): NonNullable<DB['staff']> => { const db = read(); return db.staff ?? (window.__LB_DEMO?.seed ? demoStaff() : { members: [], shifts: [] }) }
  const putBack = (f: (b: Backoffice) => Backoffice) => { const db = read(); write({ ...db, back: f(db.back!) }) }
  const upsertBy = <T,>(list: T[], item: T, key: (x: T) => string) => (list.some(x => key(x) === key(item)) ? list.map(x => (key(x) === key(item) ? item : x)) : [...list, item])
  const moveStock = (id: string, delta: number, reason: MoveReason, note?: string) => putBack(b => ({
    ...b,
    ingredients: b.ingredients.map(i => (i.id === id ? { ...i, stock: i.stock + delta } : i)),
    moves: [...b.moves, { id: uid(), ingredient_id: id, delta, reason, note, at: new Date().toISOString() }].slice(-500),
  }))

  return {
    mode: 'demo',
    async getCatalog() { return read().catalog },
    async placeOrder(o) { return create(o, 'app') },
    async orderStatus(id) {
      const o = read().orders.find(x => x.id === id)
      return o ? { number: o.number, status: o.status, payment_status: o.payment_status } : null
    },
    async staffRole() { return getRole() },
    async staffLogin(role, pin) {
      if (pin !== (read().pins?.[role] ?? PINS[role])) throw new Error('PIN non valido')
      memRole = role
      try { sessionStorage.setItem('lb:demo:role', role) } catch { /* ignore */ }
      return role
    },
    async staffLogout() { memRole = null; if (window.__LB_DEMO) window.__LB_DEMO.role = undefined; try { sessionStorage.removeItem('lb:demo:role') } catch { /* ignore */ } },
    async listOrders() {
      const t = new Date(); t.setHours(0, 0, 0, 0)
      return read().orders.filter(o => new Date(o.created_at) >= t)
    },
    async listOrdersSince(from, to) { return read().orders.filter(o => new Date(o.created_at) >= from && (!to || new Date(o.created_at) < to)) },
    async saveBookingConfig(c) { putCatalog(k => ({ ...k, booking: c })) },
    async bookingAvailability(day) { const db = read(); return availability(db.catalog.booking, (db.bookings || []).filter(b => b.day === day)) },
    async placeBooking(nb) {
      const db = read(), list = db.bookings || []
      const e = checkBooking(db.catalog.booking, db.catalog.settings.open_days, list, nb)
      if (e) throw new Error(e)
      if (!nb.name.trim()) throw new Error('Scrivi il tuo nome.')
      const isSlot = nb.kind === 'table' || nb.kind === 'tea'
      const b: Booking = { id: uid(), ref: uid().slice(0, 5).toUpperCase(), created_at: new Date().toISOString(), kind: nb.kind, day: nb.day, time: isSlot ? nb.time ?? null : null, party: nb.party, name: nb.name.trim().slice(0, 60), phone: nb.phone?.trim().slice(0, 30) || null, note: nb.note?.trim().slice(0, 300) || null, status: isSlot && db.catalog.booking.auto_confirm ? 'confirmed' : 'pending', table_label: null, source: 'app' }
      write({ ...db, bookings: [...list, b] })
      return pub(b)
    },
    async bookingStatus(id) { const b = (read().bookings || []).find(x => x.id === id); return b ? pub(b) : null },
    async cancelBooking(id) { const db = read(); write({ ...db, bookings: (db.bookings || []).map(b => (b.id === id && (b.status === 'pending' || b.status === 'confirmed') ? { ...b, status: 'cancelled' as BookingStatus } : b)) }) },
    async listBookings(from, to) { return (read().bookings || []).filter(b => b.day >= from && b.day <= to).sort((a, b) => (a.day + (a.time || '99')).localeCompare(b.day + (b.time || '99'))) },
    async createStaffBooking(nb) {
      const db = read(), isSlot = nb.kind === 'table' || nb.kind === 'tea'
      const b: Booking = { id: uid(), ref: uid().slice(0, 5).toUpperCase(), created_at: new Date().toISOString(), kind: nb.kind, day: nb.day, time: isSlot ? nb.time ?? null : null, party: nb.party, name: nb.name.trim().slice(0, 60), phone: nb.phone?.trim() || null, note: nb.note?.trim() || null, status: 'confirmed', table_label: null, source: 'staff' }
      write({ ...db, bookings: [...(db.bookings || []), b] })
    },
    async setBookingStatus(id, status, table) { const db = read(); write({ ...db, bookings: (db.bookings || []).map(b => (b.id === id ? { ...b, status, table_label: table === undefined ? b.table_label : table } : b)) }) },
    async listStaff() { return [...(staffDb().members)].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name)) },
    async saveStaff(m) { const db = read(), st = staffDb(); write({ ...db, staff: { ...st, members: st.members.some(x => x.id === m.id) ? st.members.map(x => (x.id === m.id ? m : x)) : [...st.members, m] } }) },
    async deleteStaff(id) { const db = read(), st = staffDb(); write({ ...db, staff: { ...st, members: st.members.filter(x => x.id !== id), shifts: st.shifts.filter(s => s.member_id !== id) } }) },
    async listShifts(from, to) { return staffDb().shifts.filter(s => s.day >= from && s.day <= to).sort((a, b) => a.day.localeCompare(b.day) || (a.start ?? '').localeCompare(b.start ?? '')) },
    async saveShifts(list) { const db = read(), st = staffDb(), ids = new Set(list.map(s => s.id)); write({ ...db, staff: { ...st, shifts: [...st.shifts.filter(s => !ids.has(s.id)), ...list] } }) },
    async deleteShifts(ids) { const db = read(), st = staffDb(), del = new Set(ids); write({ ...db, staff: { ...st, shifts: st.shifts.filter(s => !del.has(s.id)) } }) },
    async getStaffConfig() { return withConfigDefaults(staffDb().config) },
    async saveStaffConfig(c) { const db = read(), st = staffDb(); write({ ...db, staff: { ...st, config: c } }) },
    async getClosure(day) { return (read().closures || []).find(c => c.day === day) ?? null },
    async listClosures(limit = 60) { return [...(read().closures || [])].sort((a, b) => b.day.localeCompare(a.day)).slice(0, limit) },
    async saveClosure(c) { const db = read(); write({ ...db, closures: [...(db.closures || []).filter(x => x.day !== c.day), c] }) },
    async listAllMoves() { return read().back!.moves },
    async createCounterOrder(o) {
      const role = getRole()
      return create(o, role === 'waiter' ? 'floor' : o.source ?? 'counter')
    },
    async setStatus(id, status: Status) {
      const db = read()
      const o = db.orders.find(x => x.id === id)
      if (!o) return
      if (status === 'preparing' && !o.stock_done) {
        // la cucina inizia l'ordine: scarica le scorte secondo il ricettario (una sola volta per ordine)
        const back = db.back!
        const used = consumption(o.items, back.recipes)
        const at = new Date().toISOString()
        const moves = [...back.moves]
        const ingredients = back.ingredients.map(i => {
          const q = used.get(i.id); if (!q) return i
          moves.push({ id: uid(), ingredient_id: i.id, delta: -q, reason: 'vendita', note: `Ordine ${o.number}`, at })
          return { ...i, stock: i.stock - q }
        })
        write({ ...db, back: { ...back, ingredients, moves: moves.slice(-500) }, orders: db.orders.map(x => (x.id === id ? { ...x, status, stock_done: true } : x)) })
      } else patch(id, x => ({ ...x, status }))
    },
    async setPayment(id, method) { patch(id, o => ({ ...o, payment_method: method, payment_status: 'paid' })) },
    async setAvailability(itemId, available) {
      putCatalog(c => ({ ...c, menu: c.menu.map((m: MenuItem) => (m.id === itemId ? { ...m, available } : m)) }))
    },
    async saveMenuItem(item) { putCatalog(c => ({ ...c, menu: upsert(c.menu, item) })) },
    async deleteMenuItems(ids) {
      const gone = new Set(ids)
      putCatalog(c => ({ ...c, menu: c.menu.filter((m: MenuItem) => !gone.has(m.id)) }))
      putBack(b => ({ ...b, recipes: b.recipes.filter(r => !gone.has(r.item_id)) }))
    },
    async saveService(svc) { putCatalog(c => ({ ...c, services: upsert(c.services, svc) })) },
    async setPin(role, pin) { const db = read(); write({ ...db, pins: { ...db.pins, [role]: pin } }) },
    async saveContent(c) { putCatalog(k => ({ ...k, content: c })) },
    async uploadImage(file) { return toDataUrl(file) },
    async saveSettings(st) { putCatalog(c => ({ ...c, settings: st })) },
    async getBackoffice() { return read().back! },
    async saveIngredient(i) { putBack(b => ({ ...b, ingredients: upsertBy(b.ingredients, i, x => x.id) })) },
    async deleteIngredient(id) { putBack(b => ({ ...b, ingredients: b.ingredients.filter(x => x.id !== id) })) },
    async addIngredient(name, unit) {
      const ing = { id: slugId(name), name: name.trim(), unit, pack_qty: 1, pack_price: 0, stock: 0, min_stock: 0 }
      putBack(b => ({ ...b, ingredients: [...b.ingredients, ing] }))
      return ing
    },
    async createDraftItem(name, cat) {
      const db = read()
      const item: MenuItem = { id: slugId(name), cat, price: 0, vg: false, available: true, visible: false, sort: Math.max(-1, ...db.catalog.menu.map(m => m.sort)) + 1, name: { it: name.trim(), en: name.trim() }, desc: { it: '', en: '' } }
      write({ ...db, catalog: { ...db.catalog, menu: [...db.catalog.menu, item] } })
      return item
    },
    async saveRecipe(r) { putBack(b => ({ ...b, recipes: upsertBy(b.recipes, r, x => x.item_id) })) },
    async deleteRecipe(itemId) { putBack(b => ({ ...b, recipes: b.recipes.filter(x => x.item_id !== itemId) })) },
    async saveCosts(c) { putBack(b => ({ ...b, costs: c })) },
    async moveStock(ingredientId, delta, reason: MoveReason, note) { moveStock(ingredientId, delta, reason, note) },
    async setStock(ingredientId, qty, note) {
      const cur = read().back!.ingredients.find(x => x.id === ingredientId); if (!cur) return
      moveStock(ingredientId, qty - cur.stock, 'inventario', note)
    },
    subscribe(cb) { listeners.add(cb); return () => { listeners.delete(cb) } },
  }
}
