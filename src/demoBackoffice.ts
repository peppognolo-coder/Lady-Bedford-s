import type { Backoffice, Ingredient, Recipe, Unit } from './api/types'
import { DEFAULT_COSTS } from './costs'
import { DEMO_ING_ALLERGENS } from './allergens'

// Dati di prova per la demo (NON sono le ricette vere della cuoca): servono solo a mostrare come funzionano scorte e costi.
// [id, nome, unità, qtà confezione, prezzo confezione € (IVA esclusa), giacenza, soglia]
const ING: [string, string, Unit, number, number, number, number][] = [
  ['te-blend', 'Tè nero Assam/Ceylon', 'g', 500, 28, 900, 200],
  ['te-earl', 'Earl Grey', 'g', 500, 26, 380, 200],
  ['te-darj', 'Darjeeling First Flush', 'g', 250, 38, 150, 100],
  ['te-rooi', 'Rooibos alla vaniglia', 'g', 500, 18, 700, 200],
  ['latte-avena', 'Latte di avena', 'ml', 1000, 1.6, 6000, 3000],
  ['farina', 'Farina 00', 'g', 1000, 0.9, 12000, 4000],
  ['burro-veg', 'Burro vegetale', 'g', 1000, 6.5, 2500, 1500],
  ['burro', 'Burro', 'g', 1000, 10, 2000, 1000],
  ['zucchero', 'Zucchero', 'g', 1000, 1.2, 9000, 3000],
  ['anacardi', 'Anacardi (crema)', 'g', 1000, 14, 600, 500],
  ['confettura', 'Confettura di fragole', 'g', 1000, 5.5, 3000, 1000],
  ['uova', 'Uova', 'pz', 30, 7, 40, 30],
  ['lamponi', 'Lamponi', 'g', 500, 4.5, 400, 500],
  ['limone', 'Limoni', 'pz', 10, 4, 25, 10],
  ['cetriolo', 'Cetrioli', 'pz', 1, 0.8, 10, 6],
  ['form-veg', 'Formaggio vegetale', 'g', 1000, 11, 1800, 800],
  ['pane', 'Pane in cassetta (fette)', 'pz', 20, 2.4, 80, 40],
  ['cheddar', 'Cheddar', 'g', 1000, 12, 1500, 600],
  ['funghi', 'Funghi champignon', 'g', 1000, 6, 1200, 800],
  ['porri', 'Porri', 'g', 1000, 2.5, 1500, 800],
  ['brisee', 'Pasta brisée vegetale', 'g', 1000, 3.5, 2200, 1000],
  ['menta', 'Menta fresca', 'g', 100, 1.5, 100, 60],
  ['lime', 'Lime', 'pz', 10, 3, 18, 8],
  ['tonica', 'Acqua tonica', 'ml', 4800, 14.4, 7000, 2400],
  ['soda', 'Soda', 'ml', 6000, 3.6, 12000, 3000],
  ['ibisco', 'Ibisco (fiori secchi)', 'g', 250, 12, 200, 100],
  ['agave', 'Sciroppo di agave', 'ml', 1000, 9, 2000, 500],
  ['acqua-rose', 'Acqua di rose', 'ml', 250, 5, 220, 100],
  ['zucc-canna', 'Zucchero di canna', 'g', 1000, 2.2, 3000, 1000],
]
// [id prodotto, porzioni, [[ingrediente, quantità totale]…]]
const REC: [string, number, [string, number][]][] = [
  ['blend', 1, [['te-blend', 4], ['latte-avena', 30]]],
  ['earl', 1, [['te-earl', 4], ['latte-avena', 80]]],
  ['darj', 1, [['te-darj', 4]]],
  ['rooi', 1, [['te-rooi', 4]]],
  ['scone', 8, [['farina', 500], ['burro-veg', 100], ['zucchero', 60], ['latte-avena', 250], ['anacardi', 120], ['confettura', 160]]],
  ['sponge', 8, [['farina', 200], ['burro', 200], ['zucchero', 200], ['uova', 4], ['lamponi', 150]]],
  ['lemon', 10, [['farina', 220], ['burro-veg', 150], ['zucchero', 220], ['limone', 3], ['latte-avena', 100]]],
  ['short', 12, [['farina', 250], ['burro', 170], ['zucchero', 80]]],
  ['cucu', 4, [['pane', 8], ['cetriolo', 2], ['form-veg', 120]]],
  ['rare', 1, [['pane', 2], ['cheddar', 70]]],
  ['pie', 6, [['brisee', 500], ['funghi', 500], ['porri', 300], ['burro-veg', 40]]],
  ['garden', 1, [['cetriolo', 0.25], ['menta', 3], ['lime', 0.5], ['tonica', 150]]],
  ['hibiscus', 1, [['ibisco', 4], ['limone', 0.5], ['agave', 20], ['soda', 80]]],
  ['rosa', 1, [['lamponi', 60], ['acqua-rose', 8], ['zucc-canna', 15], ['soda', 150]]],
  ['earlfizz', 1, [['te-earl', 3], ['limone', 0.5], ['zucc-canna', 15], ['soda', 120]]],
]

const METHOD: Record<string, [string, number]> = {
  scone: ['Setacciare la farina con il lievito e lo zucchero.\nUnire il burro vegetale freddo a cubetti e sabbiare con la punta delle dita.\nImpastare con il latte di avena senza lavorare troppo.\nStendere a 3 cm, tagliare dei dischi e spennellare con latte.\nCuocere a 200 °C per 15 minuti. Servire tiepidi con crema di anacardi e confettura.', 40],
  blend: ['Scaldare l’acqua a 95 °C.\nInfondere 4 g di miscela per 4 minuti.\nServire con latte di avena a parte.', 5],
  short: ['Lavorare burro e zucchero a crema.\nUnire la farina e impastare rapidamente.\nRiposo 30 minuti in frigo, stendere a 1 cm, tagliare a dita.\nCuocere a 160 °C per 20 minuti.', 60],
}
export function demoBackoffice(): Backoffice {
  const ingredients: Ingredient[] = ING.map(([id, name, unit, pack_qty, pack_price, stock, min_stock]) => ({ id, name, unit, pack_qty, pack_price, stock, min_stock, allergens: DEMO_ING_ALLERGENS[id] ?? [] }))
  const recipes: Recipe[] = REC.map(([item_id, yld, lines]) => ({ item_id, yield: yld, lines: lines.map(([ingredient_id, qty]) => ({ ingredient_id, qty })), method: METHOD[item_id]?.[0], prep_min: METHOD[item_id]?.[1] }))
  return {
    ingredients, recipes, moves: [],
    costs: { ...DEFAULT_COSTS, portions_month: 6500, target_margin: 60, vat: 10, fixed: [
      { id: 'affitto', label: 'Affitto', monthly: 2200 }, { id: 'utenze', label: 'Utenze', monthly: 650 },
      { id: 'personale', label: 'Personale', monthly: 5200 }, { id: 'altro', label: 'Imballaggi, pulizie, commissioni POS', monthly: 500 },
    ] },
  }
}
