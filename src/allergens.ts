import type { Ingredient, Recipe } from './api/types'

/** I 14 allergeni da dichiarare (Reg. UE 1169/2011, All. II). */
export const ALLERGENS: { id: string; it: string; en: string }[] = [
  { id: 'gluten', it: 'Glutine', en: 'Gluten' },
  { id: 'crustaceans', it: 'Crostacei', en: 'Crustaceans' },
  { id: 'eggs', it: 'Uova', en: 'Eggs' },
  { id: 'fish', it: 'Pesce', en: 'Fish' },
  { id: 'peanuts', it: 'Arachidi', en: 'Peanuts' },
  { id: 'soy', it: 'Soia', en: 'Soy' },
  { id: 'milk', it: 'Latte e derivati', en: 'Milk' },
  { id: 'nuts', it: 'Frutta a guscio', en: 'Tree nuts' },
  { id: 'celery', it: 'Sedano', en: 'Celery' },
  { id: 'mustard', it: 'Senape', en: 'Mustard' },
  { id: 'sesame', it: 'Sesamo', en: 'Sesame' },
  { id: 'sulphites', it: 'Solfiti', en: 'Sulphites' },
  { id: 'lupin', it: 'Lupini', en: 'Lupin' },
  { id: 'molluscs', it: 'Molluschi', en: 'Molluscs' },
]
export const allergenName = (id: string, lang: 'it' | 'en') => ALLERGENS.find(a => a.id === id)?.[lang] ?? id
export const sortAllergens = (ids: string[]) => ALLERGENS.map(a => a.id).filter(id => ids.includes(id))

/** Unione degli allergeni degli ingredienti usati nella ricetta. */
export const fromRecipe = (r: Recipe | undefined, ings: Ingredient[]): string[] => {
  if (!r) return []
  const by = new Map(ings.map(i => [i.id, i]))
  return sortAllergens([...new Set(r.lines.flatMap(l => by.get(l.ingredient_id)?.allergens ?? []))])
}

/* ---------- allergie del cliente in sala e in cucina ---------- */
/** L'allergia di un cliente viaggia nella nota dell'ordine, con questo prefisso (nessuna modifica al database). */
export const ALLERGY_PREFIX = 'ALLERGIA'
export const isAllergyNote = (note?: string | null) => !!note && note.trimStart().toUpperCase().startsWith(ALLERGY_PREFIX)
/** Nota completa per la cucina: "ALLERGIA: glutine, latte · testo libero" (max 300 caratteri, come nel database). */
export const allergyNote = (avoid: string[], note: string) => {
  const head = avoid.length ? `${ALLERGY_PREFIX}: ${sortAllergens(avoid).map(id => allergenName(id, 'it').toLowerCase()).join(', ')}` : ''
  return [head, note.trim()].filter(Boolean).join(' · ').slice(0, 300)
}
const names = (ids: string[]) => sortAllergens(ids).map(id => allergenName(id, 'it').toLowerCase()).join(', ')
/** Allergeni di un prodotto per il personale: null = non dichiarati, [] = dichiarato senza allergeni. */
export const allergenShort = (ids?: string[] | null) => ids == null ? 'allergeni non dichiarati' : ids.length ? names(ids) : 'senza allergeni'
export const allergenLabel = (ids?: string[] | null) => ids == null ? 'allergeni non dichiarati' : ids.length ? `contiene: ${names(ids)}` : 'nessun allergene dichiarato'
/** Un prodotto rispetto agli allergeni da evitare: 'yes' li contiene, 'unknown' non sono dichiarati, 'no' è a posto. */
export const allergenConflict = (ids: string[] | null | undefined, avoid: string[]): 'yes' | 'unknown' | 'no' => {
  if (!avoid.length) return 'no'
  if (ids == null) return 'unknown'
  return ids.some(a => avoid.includes(a)) ? 'yes' : 'no'
}
export const allergenHits = (ids: string[] | null | undefined, avoid: string[]) => names((ids ?? []).filter(a => avoid.includes(a)))

/** Allergeni presunti degli ingredienti demo (solo per la modalità demo). */
export const DEMO_ING_ALLERGENS: Record<string, string[]> = {
  'latte-avena': ['gluten'], farina: ['gluten'], 'burro-veg': [], burro: ['milk'], anacardi: ['nuts'], uova: ['eggs'],
  'form-veg': ['nuts'], pane: ['gluten'], cheddar: ['milk'], brisee: ['gluten'],
}
/** Allergeni dichiarati dei prodotti demo; gli altri restano "non dichiarati". */
export const DEMO_ITEM_ALLERGENS: Record<string, string[]> = {
  blend: ['gluten'], earl: ['gluten'], darj: [], rooi: [], scone: ['gluten', 'nuts'], sponge: ['gluten', 'eggs', 'milk'],
  lemon: ['gluten'], short: ['gluten', 'milk'], cucu: ['gluten', 'nuts'], rare: ['gluten', 'milk'],
}
