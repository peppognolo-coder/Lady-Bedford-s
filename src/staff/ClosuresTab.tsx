import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Closure } from '../api/types'
import { downloadCsv } from '../backup'
import { money } from './shared'

export default function ClosuresTab() {
  const [list, setList] = useState<Closure[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { api.listClosures(400).then(setList).catch(e => setErr((e as Error).message)) }, [])
  return (
    <div className="st-pane">
      <div className="st-rowline" style={{ justifyContent: 'space-between' }}>
        <h2 className="st-h2">Chiusure di cassa</h2>
        <button className="st-act alt" disabled={!list?.length} onClick={() => downloadCsv('chiusure-cassa.csv', ['Giorno', 'Ordini', 'Annullati', 'Fondo iniziale €', 'Contanti incassati €', 'Carta €', 'Non pagati €', 'Atteso €', 'Contato €', 'Differenza €', 'Fondo per domani €', 'Chiusa da', 'Nota'],
          list!.map(c => [c.day, c.orders_count, c.cancelled_count, c.float_start, c.cash_total, c.card_total, c.unpaid_total, c.float_start + c.cash_total, c.counted_cash, c.diff, c.float_next, c.closed_by === 'owner' ? 'Proprietà' : 'Cassa', c.note]))}>Scarica (CSV)</button>
      </div>
      {err && <div className="st-alert inline" role="alert">{err}</div>}
      {list === null && !err ? <p className="st-hint">Carico…</p> : (
        <div className="st-tablewrap"><table className="st-table">
          <thead><tr><th>Giorno</th><th className="r">Ordini</th><th className="r">Contanti</th><th className="r">Carta</th><th className="r">Contato</th><th className="r">Differenza</th></tr></thead>
          <tbody>
            {list?.length === 0 && <tr><td colSpan={6}>Nessuna chiusura ancora: la cassa le registra a fine giornata.</td></tr>}
            {list?.map(c => (
              <tr key={c.day}>
                <td>{new Date(c.day + 'T12:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                <td className="r tnum">{c.orders_count}</td><td className="r tnum">{money(c.cash_total)}</td><td className="r tnum">{money(c.card_total)}</td>
                <td className="r tnum">{money(c.counted_cash)}</td>
                <td className="r tnum" style={{ color: Math.abs(c.diff) < 0.01 ? undefined : '#a33', fontWeight: Math.abs(c.diff) < 0.01 ? undefined : 600 }}>{Math.abs(c.diff) < 0.01 ? 'quadra' : `${c.diff > 0 ? '+' : ''}${money(c.diff)}`}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  )
}
