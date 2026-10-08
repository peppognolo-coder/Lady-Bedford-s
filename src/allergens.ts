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
