import { createClient } from '@supabase/supabase-js'
import { DEFAULT_SETTINGS } from '../defaults'
import { DEFAULT_COSTS } from '../costs'
import { EMPTY_CONTENT } from '../content'
import { DEFAULT_BOOKING } from '../booking'
import { withConfigDefaults } from '../shifts'
import type { Shift, StaffConfig, StaffMember, Booking, BookingConfig, BookingPublic, Closure, Api, Backoffice, Catalog, Costs, Ingredient, Recipe, StockMove, MenuItem, NewOrder, Order, Role, Service, Settings, Content } from './types'
import { startOfToday } from './types'

const staffEmail = (role: Role) => `${role}@staff.ladybedford.app`
const num = (v: unknown) => Number(v)

type Row = Record<string, unknown> & { total: unknown; order_items?: { item_id: string; name: string; cat: string; qty: number; unit_price: unknown }[] }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapClosure = (r: Record<string, any>): Closure => ({ day: r.day, float_start: num(r.float_start), cash_total: num(r.cash_total), card_total: num(r.card_total), unpaid_total: num(r.unpaid_total), orders_count: r.orders_count, cancelled_count: r.cancelled_count, counted_cash: num(r.counted_cash), float_next: num(r.float_next), diff: num(r.diff), note: r.note ?? undefined, closed_by: r.closed_by, closed_at: r.closed_at })
const mapOrders = (rows: Row[]) => rows.map(r => ({
  ...r, total: num(r.total),
  items: (r.order_items || []).map(i => ({ ...i, unit_price: num(i.unit_price) })),
})) as unknown as Order[]

let chanSeq = 0
export function createSupabaseApi(url: string, key: string): Api {
  const sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message) }

  const create = async (fn: 'place_order' | 'staff_place_order', args: Record<string, unknown>) => {
    const { data, error } = await sb.rpc(fn, args)
    fail(error)
    return data as { id: string; number: number }
  }

  return {
    mode: 'supabase',
    async getCatalog() {
      const [m, sv, st, ct, bk] = await Promise.all([
        sb.from('menu_items').select('*').order('sort'),
        sb.from('services').select('*').order('sort'),
        sb.from('settings').select('value').eq('key', 'main').maybeSingle(),
        sb.from('settings').select('value').eq('key', 'content').maybeSingle(),
        sb.from('settings').select('value').eq('key', 'booking').maybeSingle(),
      ])
      fail(m.error); fail(sv.error); fail(st.error)
      const menu: MenuItem[] = (m.data || []).map(r => ({
        id: r.id, cat: r.cat, price: num(r.price), vg: r.vg, available: r.available, visible: r.visible, sort: r.sort,
        name: { it: r.name_it, en: r.name_en }, desc: { it: r.desc_it, en: r.desc_en }, photo: r.photo ?? null, allergens: r.allergens ?? null,
      }))
      const services: Service[] = (sv.data || []).map(r => ({
        id: r.id, active: r.active, sort: r.sort,
        kicker: { it: r.kicker_it, en: r.kicker_en }, title: { it: r.title_it, en: r.title_en }, body: { it: r.body_it, en: r.body_en },
        price: { it: r.price_it, en: r.price_en }, cta: { it: r.cta_it, en: r.cta_en },
      }))
      const settings: Settings = { ...DEFAULT_SETTINGS, ...((st.data?.value as Partial<Settings>) || {}) }
      const content = { ...EMPTY_CONTENT, ...((ct.data?.value as Partial<Content>) || {}) }
      const booking = { ...DEFAULT_BOOKING, ...((bk.data?.value as Partial<BookingConfig>) || {}) }
      return { menu, services, settings, content, booking } as Catalog
    },
    placeOrder(o: NewOrder) {
      return create('place_order', { p_name: o.customer_name, p_slot: o.pickup_slot ?? null, p_note: o.note ?? null, p_items: o.items })
    },
    async orderStatus(id) {
      const { data, error } = await sb.rpc('order_status', { p_id: id })
      fail(error)
      return (data as { number: number; status: never; payment_status: never } | null) ?? null
    },
    async staffRole() {
      const { data: s } = await sb.auth.getSession()
      if (!s.session) return null
      const { data } = await sb.from('staff_roles').select('role').eq('user_id', s.session.user.id).maybeSingle()
      return (data?.role as Role) ?? null
    },
    async staffLogin(role, pin) {
      const { error } = await sb.auth.signInWithPassword({ email: staffEmail(role), password: pin })
      if (error) throw new Error('PIN non valido')
      const r = await this.staffRole()
      if (r !== role) { await sb.auth.signOut(); throw new Error('Account senza permessi') }
      return role
    },
    async staffLogout() { await sb.auth.signOut() },
    async listOrders() {
      const { data, error } = await sb.from('orders').select('*, order_items(*)').gte('created_at', startOfToday().toISOString()).order('created_at')
      fail(error)
      return mapOrders(data || [])
    },
    createCounterOrder(o) {
      return create('staff_place_order', { p_name: o.customer_name, p_table: o.table_label ?? null, p_note: o.note ?? null, p_items: o.items, p_pay: o.pay ?? null })
    },
    async listOrdersSince(from, to) {
      // Supabase restituisce al massimo 1000 righe per richiesta: si legge a pagine.
      const rows: Row[] = []
      for (let off = 0; ; off += 1000) {
        let q = sb.from('orders').select('*, order_items(*)').gte('created_at', from.toISOString())
        if (to) q = q.lt('created_at', to.toISOString())
        const { data, error } = await q.order('created_at').order('id').range(off, off + 999)
        fail(error)
        rows.push(...((data || []) as Row[]))
        if (!data || data.length < 1000) break
      }
      return mapOrders(rows)
    },
    async saveBookingConfig(c) { const { error } = await sb.from('settings').upsert({ key: 'booking', value: c }); fail(error) },
    async bookingAvailability(day) { const { data, error } = await sb.rpc('booking_availability', { p_day: day }); fail(error); return (data || {}) as Record<string, number> },
    async placeBooking(b) {
      const { data, error } = await sb.rpc('place_booking', { p_kind: b.kind, p_day: b.day, p_time: b.time ?? null, p_party: b.party, p_name: b.name, p_phone: b.phone ?? null, p_note: b.note ?? null })
      fail(error); return data as BookingPublic
    },
    async bookingStatus(id) { const { data, error } = await sb.rpc('booking_status', { p_id: id }); fail(error); return (data as BookingPublic | null) ?? null },
    async cancelBooking(id) { const { error } = await sb.rpc('cancel_booking', { p_id: id }); fail(error) },
    async listBookings(from, to) {
      const { data, error } = await sb.from('bookings').select('*').gte('day', from).lte('day', to).order('day').order('time', { nullsFirst: false })
      fail(error); return (data || []) as Booking[]
    },
    async createStaffBooking(b) {
      const { error } = await sb.rpc('staff_booking', { p_kind: b.kind, p_day: b.day, p_time: b.time ?? null, p_party: b.party, p_name: b.name, p_phone: b.phone ?? null, p_note: b.note ?? null })
      fail(error)
    },
    async setBookingStatus(id, status, table) {
      const patch: Record<string, unknown> = { status }
      if (table !== undefined) patch.table_label = table
      const { error } = await sb.from('bookings').update(patch).eq('id', id); fail(error)
    },
    async listStaff() {
      const { data, error } = await sb.from('staff_members').select('*').order('sort').order('name'); fail(error)
      return (data || []).map((r: Record<string, any>) => ({ id: r.id, name: r.name, role: r.role, weekly_hours: r.weekly_hours === null ? null : Number(r.weekly_hours), active: r.active, sort: r.sort }) as StaffMember)
    },
    async saveStaff(m) {
      const { error } = await sb.from('staff_members').upsert({ id: m.id, name: m.name.trim(), role: m.role, weekly_hours: m.weekly_hours, active: m.active, sort: m.sort }); fail(error)
    },
    async deleteStaff(id) { const { error } = await sb.from('staff_members').delete().eq('id', id); fail(error) },
    async listShifts(from, to) {
      const out: Shift[] = []
      for (let page = 0; ; page++) {   // PostgREST restituisce al massimo 1000 righe per richiesta
        const { data, error } = await sb.from('staff_shifts').select('*').gte('day', from).lte('day', to).order('day').order('start_time').order('id').range(page * 1000, page * 1000 + 999); fail(error)
        for (const r of (data || []) as Record<string, any>[]) out.push({ id: r.id, member_id: r.member_id, day: r.day, kind: r.kind, start: r.start_time ? String(r.start_time).slice(0, 5) : null, end: r.end_time ? String(r.end_time).slice(0, 5) : null, break_min: r.break_min, adj_kind: r.adj_kind, adj_min: r.adj_min, note: r.note })
        if (!data || data.length < 1000) break
      }
      return out
    },
    async saveShifts(list) {
      for (let i = 0; i < list.length; i += 200) {
        const rows = list.slice(i, i + 200).map(s => ({ id: s.id, member_id: s.member_id, day: s.day, kind: s.kind, start_time: s.kind === 'work' ? s.start : null, end_time: s.kind === 'work' ? s.end : null, break_min: s.break_min, adj_kind: s.adj_kind, adj_min: s.adj_kind ? s.adj_min : 0, note: s.note }))
        const { error } = await sb.from('staff_shifts').upsert(rows); fail(error)
      }
    },
    async deleteShifts(ids) {
      for (let i = 0; i < ids.length; i += 200) { const { error } = await sb.from('staff_shifts').delete().in('id', ids.slice(i, i + 200)); fail(error) }
    },
    async getStaffConfig() {
      const { data, error } = await sb.from('staff_config').select('value').eq('id', 1).maybeSingle(); fail(error)
      return withConfigDefaults(data?.value as Partial<StaffConfig> | undefined)
    },
    async saveStaffConfig(c) { const { error } = await sb.from('staff_config').upsert({ id: 1, value: c }); fail(error) },
    async getClosure(day) {
      const { data, error } = await sb.from('cash_closures').select('*').eq('day', day).maybeSingle()
      fail(error)
      return data ? mapClosure(data) : null
    },
    async listClosures(limit = 60) {
      const { data, error } = await sb.from('cash_closures').select('*').order('day', { ascending: false }).limit(limit)
      fail(error)
      return (data || []).map(mapClosure)
    },
    async saveClosure(c) { const { error } = await sb.from('cash_closures').upsert({ ...c, note: c.note ?? null }); fail(error) },
    async listAllMoves() {
      const out: StockMove[] = []
      for (let off = 0; ; off += 1000) {
        const { data, error } = await sb.from('stock_moves').select('*').order('at').order('id').range(off, off + 999)
        fail(error)
        out.push(...(data || []).map((r): StockMove => ({ id: String(r.id), ingredient_id: r.ingredient_id, delta: num(r.delta), reason: r.reason, note: r.note ?? undefined, at: r.at })))
        if (!data || data.length < 1000) break
      }
      return out
    },
    async setStatus(id, status) { const { error } = await sb.from('orders').update({ status }).eq('id', id); fail(error) },
    async setPayment(id, method) { const { error } = await sb.from('orders').update({ payment_method: method, payment_status: 'paid' }).eq('id', id); fail(error) },
    async setAvailability(itemId, available) { const { error } = await sb.from('menu_items').update({ available }).eq('id', itemId); fail(error) },
    async saveMenuItem(i) {
      const { error } = await sb.from('menu_items').upsert({
        id: i.id, cat: i.cat, price: i.price, vg: i.vg, available: i.available, visible: i.visible, sort: i.sort,
        name_it: i.name.it, name_en: i.name.en, desc_it: i.desc.it, desc_en: i.desc.en, photo: i.photo ?? null, allergens: i.allergens ?? null,
      })
      fail(error)
    },
    async deleteMenuItems(ids) {
      if (!ids.length) return
      for (let i = 0; i < ids.length; i += 100) { const { error } = await sb.from('menu_items').delete().in('id', ids.slice(i, i + 100)); fail(error) }
    },
    async saveService(v) {
      const { error } = await sb.from('services').upsert({
        id: v.id, active: v.active, sort: v.sort,
        kicker_it: v.kicker.it, kicker_en: v.kicker.en, title_it: v.title.it, title_en: v.title.en, body_it: v.body.it, body_en: v.body.en,
        price_it: v.price.it, price_en: v.price.en, cta_it: v.cta.it, cta_en: v.cta.en,
      })
      fail(error)
    },
    async setPin(role, pin) { const { error } = await sb.rpc('set_staff_pin', { p_role: role, p_pin: pin }); fail(error) },
    async saveContent(c) { const { error } = await sb.from('settings').upsert({ key: 'content', value: c }); fail(error) },
    async uploadImage(file, folder) {
      const path = `${folder}/${crypto.randomUUID()}.webp`
      const { error } = await sb.storage.from('media').upload(path, file, { contentType: file.type || 'image/webp', cacheControl: '31536000' })
      fail(error)
      return sb.storage.from('media').getPublicUrl(path).data.publicUrl
    },
    async saveSettings(st) { const { error } = await sb.from('settings').upsert({ key: 'main', value: st }); fail(error) },
    async getBackoffice() {
      const [ing, rec, mv, co] = await Promise.all([
        sb.from('ingredients').select('*').order('name'),
        sb.from('recipes').select('*'),
        sb.from('stock_moves').select('*').order('at', { ascending: false }).limit(300),
        sb.from('owner_settings').select('value').eq('key', 'costs').maybeSingle(),
      ])
      fail(ing.error); fail(rec.error); fail(mv.error); fail(co.error)
      return {
        ingredients: (ing.data || []).map((r): Ingredient => ({ id: r.id, name: r.name, unit: r.unit, pack_qty: num(r.pack_qty), pack_price: num(r.pack_price), stock: num(r.stock), min_stock: num(r.min_stock), supplier: r.supplier ?? undefined, allergens: r.allergens ?? [] })),
        recipes: (rec.data || []).map((r): Recipe => ({ item_id: r.item_id, yield: num(r.yield), lines: (r.lines as Recipe['lines']) || [], notes: r.notes ?? undefined, method: r.method ?? undefined, prep_min: r.prep_min ?? undefined })),
        moves: (mv.data || []).map((r): StockMove => ({ id: String(r.id), ingredient_id: r.ingredient_id, delta: num(r.delta), reason: r.reason, note: r.note ?? undefined, at: r.at })),
        costs: { ...DEFAULT_COSTS, ...((co.data?.value as Partial<Costs>) || {}) },
      } as Backoffice
    },
    async saveIngredient(i) {
      const { data, error: e0 } = await sb.from('ingredients').select('id').eq('id', i.id).maybeSingle()
      fail(e0)
      // la giacenza non si scrive direttamente: si muove con set_stock
      const { error } = await sb.from('ingredients').upsert({ id: i.id, name: i.name, unit: i.unit, pack_qty: i.pack_qty, pack_price: i.pack_price, min_stock: i.min_stock, supplier: i.supplier ?? null, allergens: i.allergens ?? [] })
      fail(error)
      if (!data && i.stock) { const r = await sb.rpc('set_stock', { p_id: i.id, p_qty: i.stock, p_note: 'Giacenza iniziale' }); fail(r.error) }
    },
    async deleteIngredient(id) { const { error } = await sb.from('ingredients').delete().eq('id', id); fail(error) },
    async addIngredient(name, unit) {
      const { data, error } = await sb.rpc('add_ingredient', { p_name: name, p_unit: unit }); fail(error)
      return { id: data as string, name: name.trim(), unit, pack_qty: 1, pack_price: 0, stock: 0, min_stock: 0 }
    },
    async createDraftItem(name, cat) {
      const { data, error } = await sb.rpc('create_draft_item', { p_name: name, p_cat: cat }); fail(error)
      return { id: data as string, cat, price: 0, vg: false, available: true, visible: false, sort: 999, name: { it: name.trim(), en: name.trim() }, desc: { it: '', en: '' } }
    },
    async saveRecipe(r) { const { error } = await sb.from('recipes').upsert({ item_id: r.item_id, yield: r.yield, lines: r.lines, notes: r.notes ?? null, method: r.method ?? null, prep_min: r.prep_min ?? null }); fail(error) },
    async deleteRecipe(itemId) { const { error } = await sb.from('recipes').delete().eq('item_id', itemId); fail(error) },
    async saveCosts(c) { const { error } = await sb.from('owner_settings').upsert({ key: 'costs', value: c }); fail(error) },
    async moveStock(id, delta, reason, note) { const { error } = await sb.rpc('move_stock', { p_id: id, p_delta: delta, p_reason: reason, p_note: note ?? null }); fail(error) },
    async setStock(id, qty, note) { const { error } = await sb.rpc('set_stock', { p_id: id, p_qty: qty, p_note: note ?? null }); fail(error) },
    subscribe(cb) {
      // un canale per ogni ascoltatore: con lo stesso nome Supabase rifiuta il secondo (e la pagina diventa bianca)
      const ch = sb.channel(`lb-live-${++chanSeq}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, cb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, cb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, cb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredients' }, cb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'recipes' }, cb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, cb)
        .subscribe()
      return () => { void sb.removeChannel(ch) }
    },
  }
}
