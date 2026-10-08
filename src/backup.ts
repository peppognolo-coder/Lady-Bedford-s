import { api } from './api'
import type { Order } from './api/types'

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const LAST = 'lb:last-backup'
export const lastBackup = (): Date | null => { try { const v = localStorage.getItem(LAST); return v ? new Date(v) : null } catch { return null } }
const markBackup = () => { try { localStorage.setItem(LAST, new Date().toISOString()) } catch { /* ignore */ } }

export function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}

/** CSV pensato per Excel italiano: separatore “;”, decimali con la virgola, accenti corretti. */
export function toCsv(head: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    const s = typeof v === 'number' ? String(Math.round(v * 1000) / 1000).replace('.', ',') : String(v ?? '')
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + [head, ...rows].map(r => r.map(cell).join(';')).join('\r\n')
}
export const downloadCsv = (name: string, head: string[], rows: (string | number | null | undefined)[][]) => download(name, toCsv(head, rows), 'text/csv;charset=utf-8')

export const SOURCE: Record<Order['source'], string> = { app: 'App clienti', counter: 'Banco', floor: 'Sala' }
export const STATUS: Record<string, string> = { new: 'Da preparare', preparing: 'In preparazione', ready: 'Pronto', served: 'Servito', completed: 'Completato', cancelled: 'Annullato' }

export const ordersCsv = (orders: Order[]) => ({
  head: ['Data', 'Ora', 'Numero', 'Origine', 'Tavolo', 'Cliente', 'Stato', 'Pagamento', 'Totale €', 'Prodotti'],
  rows: orders.map(o => {
    const d = new Date(o.created_at)
    return [dayKey(d), d.toTimeString().slice(0, 5), o.number, SOURCE[o.source], o.table_label, o.customer_name, STATUS[o.status] ?? o.status,
      o.payment_status === 'paid' ? (o.payment_method === 'cash' ? 'Contanti' : o.payment_method === 'card' ? 'Carta' : 'Pagato') : 'Da pagare', o.total, o.items.map(i => `${i.qty}× ${i.name}`).join(' + ')]
  }),
})

export const BACKUP_APP = 'lady-bedford'
export async function buildBackup() {
  const [catalog, orders, back, moves] = await Promise.all([api.getCatalog(), api.listOrdersSince(new Date(2000, 0, 1)), api.getBackoffice(), api.listAllMoves()])
  // personale e turni: solo la proprietà può leggerli (per gli altri ruoli la richiesta viene negata e il backup resta senza)
  const staff = await Promise.all([api.listStaff(), api.listShifts('2000-01-01', '2100-01-01'), api.getStaffConfig()]).then(([members, shifts, config]) => ({ members, shifts, config })).catch(() => null)
  const data = { app: BACKUP_APP, version: 1, created_at: new Date().toISOString(), catalog, backoffice: { ...back, moves }, orders, staff }
  return { data, text: JSON.stringify(data) }
}
export async function downloadFullBackup() {
  const { text, data } = await buildBackup()
  download(`lady-bedford-backup-${dayKey(new Date())}.json`, text, 'application/json')
  markBackup()
  return { orders: data.orders.length, menu: data.catalog.menu.length, ingredients: data.backoffice.ingredients.length }
}

/** Ripristina catalogo, contenuti, ricette, costi, personale e turni da un backup. Ordini e giacenze NON vengono toccati. */
export async function restoreBackup(raw: string) {
  let d: any // eslint-disable-line @typescript-eslint/no-explicit-any
  try { d = JSON.parse(raw) } catch { throw new Error('Il file non è un backup valido.') }
  if (d?.app !== BACKUP_APP || d?.version !== 1 || !d.catalog || !d.backoffice) throw new Error('Il file non è un backup di Lady Bedford’s.')
  for (const m of d.catalog.menu) await api.saveMenuItem(m)
  for (const s of d.catalog.services) await api.saveService(s)
  await api.saveSettings(d.catalog.settings)
  await api.saveContent(d.catalog.content)
  const cur = await api.getBackoffice()
  const have = new Set(cur.ingredients.map(i => i.id))
  for (const i of d.backoffice.ingredients) await api.saveIngredient(have.has(i.id) ? { ...i, stock: cur.ingredients.find(x => x.id === i.id)!.stock } : i)
  for (const r of d.backoffice.recipes) await api.saveRecipe(r)
  await api.saveCosts(d.backoffice.costs)
  if (d.staff?.members) {
    for (const m of d.staff.members) await api.saveStaff(m)
    if (d.staff.shifts?.length) await api.saveShifts(d.staff.shifts)
    if (d.staff.config) await api.saveStaffConfig(d.staff.config)
  }
  return { menu: d.catalog.menu.length, ingredients: d.backoffice.ingredients.length, recipes: d.backoffice.recipes.length }
}
