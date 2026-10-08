import { ALLERGENS } from '../allergens'

/** Selezione dei 14 allergeni (chip attivabili). */
export function AllergenChips({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="st-chips" role="group" aria-label="Allergeni" style={{ flexWrap: 'wrap' }}>
      {ALLERGENS.map(a => (
        <button key={a.id} type="button" aria-pressed={value.includes(a.id)} onClick={() => onChange(value.includes(a.id) ? value.filter(x => x !== a.id) : [...value, a.id])}>{a.it}</button>
      ))}
    </div>
  )
}
