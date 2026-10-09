import type { Catalog, L, MenuItem, Service, Settings } from './api/types'
import { EMPTY_CONTENT } from './content'
import { DEFAULT_BOOKING } from './booking'
import { DEMO_ITEM_ALLERGENS } from './allergens'
import { MENU, SERVICES, SLOTS } from './data'

const l = (it: string, en: string): L => ({ it, en })

export const DEFAULT_SETTINGS: Settings = {
  open_days: [2, 3, 4, 5, 6, 0],
  open_time: '11:00',
  close_time: '19:00',
  slots: SLOTS,
  featured: ['darj', 'scone', 'cucu'],
  butler: l('Oggi vi consigliamo il Darjeeling First Flush, con uno scone ancora tiepido.', 'Today we recommend the Darjeeling First Flush, with a scone still warm.'),
  tables: 12,
  show_product_photos: false,
}

export const DEFAULT_CATALOG: Catalog = {
  menu: MENU.map((m, i): MenuItem => ({ id: m.id, cat: m.cat, price: m.p, vg: !!m.vg, available: true, visible: true, sort: i, name: l(m.it[0], m.en[0]), desc: l(m.it[1], m.en[1]), allergens: DEMO_ITEM_ALLERGENS[m.id] ?? null })),
  services: SERVICES.it.map((s, i): Service => {
    const e = SERVICES.en[i]
    return { id: s.id, active: true, sort: i, kicker: l(s.kicker, e.kicker), title: l(s.title, e.title), body: l(s.body, e.body), price: l(s.price, e.price), cta: l(s.cta, e.cta) }
  }),
  settings: DEFAULT_SETTINGS,
  content: EMPTY_CONTENT,
  booking: DEFAULT_BOOKING,
}

