export type Status = 'new' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled'
export type PayMethod = 'cash' | 'card'
export type Role = 'kitchen' | 'cashier' | 'waiter' | 'owner'
/** Il PIN della proprietà è più lungo: protegge costi, margini e vendite. */
export const PIN_LENGTH: Record<Role, number> = { kitchen: 6, cashier: 6, waiter: 6, owner: 8 }

export interface OrderItem { item_id: string; name: string; cat: string; qty: number; unit_price: number }
export interface Order {
  id: string
  number: number
  source: 'app' | 'counter' | 'floor'
  customer_name: string
  table_label: string | null
  pickup_slot: string | null
  note: string | null
  status: Status
  payment_method: PayMethod | null
  payment_status: 'unpaid' | 'paid'
  total: number
  created_at: string
  items: OrderItem[]
  stock_done?: boolean
}
export interface NewOrder {
  customer_name: string
  pickup_slot?: string
  table_label?: string
  note?: string
  items: { item_id: string; qty: number }[]
  pay?: PayMethod | null // solo cassa
  source?: 'counter' | 'floor' // solo demo; con Supabase lo decide il ruolo
}
export type L = { it: string; en: string }
export interface MenuItem { id: string; cat: string; price: number; vg: boolean; available: boolean; visible: boolean; sort: number; name: L; desc: L; photo?: string | null; allergens?: string[] | null /* null = non ancora dichiarati */ }
export interface Service { id: string; active: boolean; sort: number; kicker: L; title: L; body: L; price: L; cta: L }
export interface Settings {
  open_days: number[]      // 0 = domenica … 6 = sabato
  open_time: string        // 'HH:MM'
  close_time: string
  slots: string[]          // fasce di ritiro, 'HH:MM'
  featured: string[]       // id dei prodotti in "Oggi in dispensa"
  butler: L                // consiglio del giorno
  tables: number           // numero di tavoli in sala
  show_product_photos?: boolean // mostra nel menu dell'app le foto dei prodotti che ne hanno una
}
/* ---------- ricettario, scorte, costi ---------- */
export type Unit = 'g' | 'ml' | 'pz'
export interface Ingredient {
  id: string; name: string; unit: Unit
  pack_qty: number      // quantità per confezione, nella unità sopra (es. 1000 g)
  pack_price: number    // prezzo della confezione, IVA esclusa
  stock: number         // giacenza attuale, nella unità sopra
  min_stock: number     // soglia di riordino
  supplier?: string
  allergens?: string[]   // id degli allergeni contenuti (vedi allergens.ts)
}
export interface RecipeLine { ingredient_id: string; qty: number } // quantità per l'intera ricetta
export interface Recipe { item_id: string; yield: number; lines: RecipeLine[]; notes?: string; method?: string; prep_min?: number } // yield = porzioni prodotte
export interface FixedCost { id: string; label: string; monthly: number }
export interface Costs {
  fixed: FixedCost[]          // spese mensili: affitto, utenze, personale…
  portions_month: number      // porzioni vendute in un mese medio (per ripartire le spese)
  target_margin: number       // margine netto desiderato, in % del prezzo netto
  vat: number                 // aliquota IVA sul venduto, in %
}
export type MoveReason = 'carico' | 'inventario' | 'spreco' | 'vendita'
export interface StockMove { id: string; ingredient_id: string; delta: number; reason: MoveReason; note?: string; at: string }
export interface Backoffice { ingredients: Ingredient[]; recipes: Recipe[]; costs: Costs; moves: StockMove[] }

/* ---------- contenuti dell'app cliente (foto, storia, galleria, invito) ---------- */
export interface Chapter { id: string; num: string; kicker: L; title: L; body: L; image?: string | null }
export interface GalleryItem { id: string; src: string; it: string; en: string; wide: boolean; h?: string }
export interface Content {
  images: Record<string, string>   // sostituzioni delle foto principali: 'hero', 'portrait', 'svc:<id servizio>'
  chapters: Chapter[] | null       // null = testi originali
  gallery: GalleryItem[] | null    // null = galleria originale
  invite: Partial<Record<'kicker' | 'line1' | 'line2' | 'address' | 'rsvp', L>>  // vuoto = testi originali
}
/** Chiusura di cassa di una giornata. */
export interface Closure {
  day: string                // 'AAAA-MM-GG'
  float_start: number        // fondo cassa a inizio giornata
  cash_total: number         // incassi in contanti registrati dall'app
  card_total: number
  unpaid_total: number       // ordini non pagati al momento della chiusura
  orders_count: number
  cancelled_count: number
  counted_cash: number       // contanti realmente contati nel cassetto
  float_next: number         // fondo lasciato in cassa per il giorno dopo
  diff: number               // contato − (fondo + incassi contanti)
  note?: string
  closed_by: string          // 'cashier' | 'owner'
  closed_at: string
}
export interface Catalog { menu: MenuItem[]; services: Service[]; settings: Settings; content: Content }
export interface OrderStatus { number: number; status: Status; payment_status: 'unpaid' | 'paid' }

export interface Api {
  mode: 'supabase' | 'demo'
  // cliente
  getCatalog(): Promise<Catalog>
  placeOrder(o: NewOrder): Promise<{ id: string; number: number }>
  orderStatus(id: string): Promise<OrderStatus | null>
  // staff
  staffRole(): Promise<Role | null>
  staffLogin(role: Role, pin: string): Promise<Role>
  staffLogout(): Promise<void>
  listOrders(): Promise<Order[]>
  createCounterOrder(o: NewOrder): Promise<{ id: string; number: number }>
  setStatus(id: string, status: Status): Promise<void>
  setPayment(id: string, method: PayMethod): Promise<void>
  setAvailability(itemId: string, available: boolean): Promise<void>
  // proprietà
  saveMenuItem(item: MenuItem): Promise<void>
  saveService(svc: Service): Promise<void>
  saveSettings(st: Settings): Promise<void>
  saveContent(c: Content): Promise<void>
  uploadImage(file: Blob, folder: string): Promise<string> // restituisce l'indirizzo della foto caricata
  listOrdersSince(from: Date, to?: Date): Promise<Order[]>
  /** Tutti i movimenti di scorta (per il backup). */
  listAllMoves(): Promise<StockMove[]>
  // chiusura di cassa (cassa e proprietà)
  getClosure(day: string): Promise<Closure | null>
  listClosures(limit?: number): Promise<Closure[]>
  saveClosure(c: Closure): Promise<void>
  // ricettario, scorte, costi (cucina: legge e muove le scorte; proprietà: tutto)
  getBackoffice(): Promise<Backoffice>
  saveIngredient(i: Ingredient): Promise<void>
  deleteIngredient(id: string): Promise<void>
  addIngredient(name: string, unit: Unit): Promise<Ingredient> // la cuoca crea l'ingrediente; il prezzo lo completa la proprietà
  createDraftItem(name: string, cat: string): Promise<MenuItem> // prodotto nuovo, nascosto e a prezzo 0, finché la proprietà non lo pubblica
  saveRecipe(r: Recipe): Promise<void>
  deleteRecipe(itemId: string): Promise<void>
  saveCosts(c: Costs): Promise<void>
  /** Solo proprietà: imposta il nuovo PIN di un ruolo. */
  setPin(role: Role, pin: string): Promise<void>
  moveStock(ingredientId: string, delta: number, reason: MoveReason, note?: string): Promise<void>
  setStock(ingredientId: string, qty: number, note?: string): Promise<void> // conteggio inventario
  subscribe(cb: () => void): () => void
}

export const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
