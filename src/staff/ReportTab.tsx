import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, type Order } from '../api'
import type { StockMove } from '../api/types'
import { useBackoffice } from '../backoffice'
import { downloadCsv } from '../backup'
import { useCatalog } from '../catalog'
import { fmtQty, pct } from '../costs'
import { CATS } from '../data'
import { QUAD_LABEL, dailySeries, delta, heat, inRange, periods, products, summarize, waste, weekly, type ProductRow, type Range } from '../report'
import { Switch, money } from './shared'

const PERIODS = [7, 14, 30, 90]
const DAYS_IT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
const DAYS_LONG = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica']
const niceMax = (v: number) => { for (const s of [10, 20, 40, 50, 100, 200, 400, 500, 1000, 2000, 5000, 10000]) if (v <= s) return s; return Math.ceil(v / 5000) * 5000 }
const fmtD = (d: Date) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
const lastDay = (r: Range) => new Date(r.to.getTime() - 86400000)

/** Variazione rispetto al periodo precedente, con segno e freccia (non solo colore). */
function Delta({ cur, prev, unit = '' }: { cur: number; prev: number; unit?: string }) {
  const d = delta(cur, prev)
  if (d === null) return <small>{prev === 0 && cur > 0 ? 'nessun dato prima' : '—'}</small>
  const up = d > 0.005, down = d < -0.005
  return <small className="tnum" aria-label={`${up ? 'in aumento' : down ? 'in calo' : 'stabile'} del ${pct(Math.abs(d))}${unit}`}>{up ? '▲ +' : down ? '▼ −' : '= '}{pct(Math.abs(d))} rispetto al periodo prima</small>
}

export default function ReportTab() {
  const { catalog } = useCatalog()
  const { data: bo } = useBackoffice()
  const [days, setDays] = useState(30)
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [moves, setMoves] = useState<StockMove[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [overhead, setOverhead] = useState(false)
  const [sort, setSort] = useState<'rev' | 'qty' | 'margin' | 'pct'>('rev')
  const [hover, setHover] = useState<number | null>(null)
  const per = useMemo(() => periods(days), [days])

  useEffect(() => {
    let alive = true
    setOrders(null); setErr(null)
    const from = new Date(Math.min(per.prev.from.getTime(), Date.now() - 63 * 86400000)); from.setHours(0, 0, 0, 0)
    Promise.all([api.listOrdersSince(from), api.listAllMoves().catch(() => [] as StockMove[])])
      .then(([o, m]) => { if (alive) { setOrders(o); setMoves(m) } })
      .catch(e => alive && setErr((e as Error).message))
    return () => { alive = false }
  }, [per])

  const R = useMemo(() => {
    if (!orders) return null
    const cur = orders.filter(o => inRange(o.created_at, per.cur)), prev = orders.filter(o => inRange(o.created_at, per.prev))
    const sc = summarize(cur), sp = summarize(prev)
    const rows = products(cur, catalog.menu, bo.recipes, bo.ingredients, bo.costs, overhead)
    const wc = waste(moves, bo.ingredients, per.cur), wp = waste(moves, bo.ingredients, per.prev)
    return { cur, sc, sp, series: dailySeries(cur, per.cur), prevSeries: dailySeries(prev, per.prev), heat: heat(cur), weeks: weekly(orders, 8), rows, wc, wp }
  }, [orders, per, catalog.menu, bo, overhead, moves])

  const sorted = useMemo(() => {
    if (!R) return []
    const k = (r: ProductRow) => sort === 'qty' ? r.qty : sort === 'margin' ? (r.margin ?? -Infinity) : sort === 'pct' ? (r.marginPct ?? -Infinity) : r.rev
    return [...R.rows].sort((a, b) => k(b) - k(a))
  }, [R, sort])

  if (err) return <div className="st-pane"><div className="st-alert" role="alert">{err}</div></div>
  if (!R) return <div className="st-pane"><p className="st-hint">Caricamento…</p></div>

  const { sc, sp, series, prevSeries, heat: H, weeks, rows, wc, wp } = R
  const noRecipe = rows.filter(r => r.cost === null)
  const withM = rows.filter(r => r.margin !== null)
  const totalMargin = withM.reduce((a, r) => a + (r.margin as number), 0), totalNet = withM.reduce((a, r) => a + r.net, 0)
  const topMargin = [...withM].sort((a, b) => (b.margin as number) - (a.margin as number))[0]
  const lowPct = [...withM].filter(r => r.qty >= 3).sort((a, b) => (a.marginPct as number) - (b.marginPct as number))[0]

  // grafico ricavi: barre del periodo + linea del periodo precedente
  const W = 640, Ht = 230, ML = 46, MR = 8, MT = 12, MB = 30
  const max = niceMax(Math.max(1, ...series.map(x => x.rev), ...prevSeries.map(x => x.rev)))
  const pw = W - ML - MR, ph = Ht - MT - MB, slotW = pw / series.length, bw = Math.max(3, Math.min(30, slotW * 0.62))
  const y = (v: number) => MT + ph - (v / max) * ph
  const every = Math.ceil(series.length / 8)
  const hv = hover !== null ? series[hover] : null
  const prevLine = prevSeries.map((p, i) => `${i ? 'L' : 'M'}${ML + slotW * i + slotW / 2},${y(p.rev)}`).join(' ')

  // ore da mostrare nella mappa degli orari: quelle con ordini, almeno 8–20
  const hoursWithData = H.grid.flatMap(r => r.map((n, h) => (n ? h : -1))).filter(h => h >= 0)
  const h0 = Math.min(8, ...hoursWithData), h1 = Math.max(19, ...hoursWithData)
  const hours = Array.from({ length: h1 - h0 + 1 }, (_, i) => h0 + i)

  const exportProducts = () => downloadCsv(`report-prodotti-${days}g.csv`, ['prodotto', 'sezione', 'quantità', 'ricavi lordi', 'ricavi netti IVA', 'costo ingredienti' + (overhead ? ' + spese' : ''), 'margine €', 'margine %', 'valutazione'],
    sorted.map(r => [r.name, CATS.find(c => c.id === r.cat)?.it ?? r.cat, r.qty, r.rev, r.net, r.cost, r.margin, r.marginPct === null ? '' : Math.round(r.marginPct * 100), r.quad ? QUAD_LABEL[r.quad].label : '']))
  const th = (label: string, key: typeof sort, cls = 'r') => <th className={cls} aria-sort={sort === key ? 'descending' : undefined}><button type="button" className="st-thbtn" onClick={() => setSort(key)}>{label}{sort === key ? ' ↓' : ''}</button></th>
  const Stat = ({ label, value, children }: { label: string; value: string; children?: ReactNode }) => <div className="st-stat"><span>{label}</span><b className="tnum">{value}</b>{children}</div>

  return (
    <div className="st-pane wide">
      <div className="st-rowline" style={{ justifyContent: 'space-between' }}>
        <div className="st-chips" role="group" aria-label="Periodo">
          {PERIODS.map(n => <button key={n} aria-pressed={days === n} className="st-daybtn" onClick={() => setDays(n)}>{n} giorni</button>)}
        </div>
        <button className="st-ghost" onClick={exportProducts} disabled={!rows.length}>Esporta prodotti (CSV)</button>
      </div>
      <p className="st-hint">Dal {fmtD(per.cur.from)} al {fmtD(lastDay(per.cur))}, confrontato con i {days} giorni precedenti ({fmtD(per.prev.from)} – {fmtD(lastDay(per.prev))}). Gli ordini annullati non contano.</p>

      <div className="st-stats">
        <Stat label="Ricavi" value={money(sc.rev)}><Delta cur={sc.rev} prev={sp.rev} /></Stat>
        <Stat label="Ordini" value={String(sc.n)}><Delta cur={sc.n} prev={sp.n} /></Stat>
        <Stat label="Scontrino medio" value={money(sc.avg)}><Delta cur={sc.avg} prev={sp.avg} /></Stat>
        <Stat label="Margine sugli ingredienti" value={withM.length ? money(totalMargin) : '—'}><small>{withM.length ? `${pct(totalNet > 0 ? totalMargin / totalNet : 0)} dei ricavi netti${noRecipe.length ? ` · ${noRecipe.length} prodotti senza ricetta esclusi` : ''}` : 'Servono le ricette con i prezzi degli ingredienti'}</small></Stat>
        <Stat label="Sprechi" value={money(wc.total)}><small>{wc.times} registrazioni{wp.total > 0 || wc.total > 0 ? ` · prima ${money(wp.total)}` : ''}</small></Stat>
      </div>

      <section aria-label="Ricavi per giorno">
        <div className="st-chart-head">
          <h2 className="st-h3">Ricavi per giorno</h2>
          <div className="st-readout tnum" aria-live="polite">{hv ? `${hv.d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })} · ${money(hv.rev)} · ${hv.n} ordini · prima ${money(prevSeries[hover as number]?.rev ?? 0)}` : 'Barre = periodo attuale · linea = periodo precedente'}</div>
        </div>
        <svg viewBox={`0 0 ${W} ${Ht}`} className="st-chart" role="img" aria-label={`Ricavi giornalieri, totale ${money(sc.rev)}`}>
          {[0, 1, 2, 3, 4].map(i => { const v = (max / 4) * i; return <g key={i}><line x1={ML} x2={W - MR} y1={y(v)} y2={y(v)} className={i === 0 ? 'axis' : 'grid'} /><text x={ML - 6} y={y(v) + 4} textAnchor="end" className="tick tnum">{Math.round(v)}</text></g> })}
          {series.map((x, i) => {
            const cx = ML + slotW * i + slotW / 2, top = y(x.rev)
            return (
              <g key={x.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${x.d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}: ${money(x.rev)}, ${x.n} ordini`}>
                <rect x={ML + slotW * i} y={MT} width={slotW} height={ph} fill="transparent" />
                {x.rev > 0 && <rect className={`bar ${hover === i ? 'on' : ''}`} x={cx - bw / 2} y={top} width={bw} height={y(0) - top} rx={Math.min(3, bw / 2)} />}
                {((i % every === 0 && series.length - 1 - i >= every * 0.6) || i === series.length - 1) && <text x={cx} y={Ht - 9} textAnchor="middle" className="tick tnum">{x.d.getDate()}/{x.d.getMonth() + 1}</text>}
              </g>
            )
          })}
          <path d={prevLine} className="prevline" fill="none" />
        </svg>
      </section>

      <section aria-label="Settimane a confronto">
        <h2 className="st-h3">Settimana per settimana</h2>
        <div className="st-tablewrap"><table className="st-table">
          <thead><tr><th>Settimana</th><th className="r">Ricavi</th><th className="r">Ordini</th><th className="r">Scontrino medio</th><th className="r">Rispetto alla settimana prima</th></tr></thead>
          <tbody>{[...weeks].reverse().map((w, i, arr) => {
            const before = arr[i + 1], d = before ? delta(w.rev, before.rev) : null
            return <tr key={w.from.toISOString()}><td>{fmtD(w.from)} – {fmtD(new Date(w.to.getTime() - 86400000))}{w.current && <span className="st-pill new" style={{ marginLeft: 8 }}>in corso</span>}</td><td className="r tnum">{money(w.rev)}</td><td className="r tnum">{w.n}</td><td className="r tnum">{w.n ? money(w.avg) : '—'}</td><td className="r tnum">{w.current ? 'parziale' : d === null ? '—' : `${d > 0.005 ? '▲ +' : d < -0.005 ? '▼ −' : '= '}${pct(Math.abs(d))}`}</td></tr>
          })}</tbody>
        </table></div>
        <p className="st-hint">La settimana in corso è parziale, quindi di solito appare più bassa.</p>
      </section>

      <section aria-label="Orari di punta">
        <h2 className="st-h3">Orari di punta</h2>
        {H.max === 0 ? <div className="st-empty">Ancora nessun ordine nel periodo.</div> : (
          <>
            <p className="st-hint">Il momento più affollato è <b>{DAYS_LONG[H.best.day]} dalle {H.best.hour}:00 alle {H.best.hour + 1}:00</b> ({H.best.n} ordini nel periodo).</p>
            <div className="st-tablewrap"><table className="st-heat">
              <thead><tr><th scope="col"><span className="sr">Giorno</span></th>{hours.map(h => <th key={h} scope="col" className="tnum">{h}</th>)}</tr></thead>
              <tbody>{H.grid.map((row, d) => <tr key={d}><th scope="row">{DAYS_IT[d]}</th>{hours.map(h => { const n = row[h]; return <td key={h} className="tnum" title={`${DAYS_LONG[d]} ${h}:00 — ${n} ordini`} aria-label={`${DAYS_LONG[d]} ${h}:00, ${n} ordini`} style={{ background: n ? `color-mix(in srgb, var(--color-accent) ${Math.round(14 + (n / H.max) * 76)}%, transparent)` : undefined, color: n / H.max > 0.6 ? 'var(--color-bg)' : undefined }}>{n || ''}</td> })}</tr>)}</tbody>
            </table></div>
          </>
        )}
      </section>

      <section aria-label="Prodotti e margini">
        <div className="st-chart-head"><h2 className="st-h3">Prodotti e margini</h2><Switch on={overhead} onChange={setOverhead} label="Togli anche le spese generali" /></div>
        <p className="st-hint">Margine = ricavi senza IVA meno il costo degli ingredienti{overhead ? ' e la quota di spese generali' : ''}, calcolato con le ricette e i prezzi di acquisto di oggi. “Valutazione” confronta le vendite con il margine desiderato ({bo.costs.target_margin}%).</p>
        {rows.length === 0 ? <div className="st-empty">Ancora nessuna vendita nel periodo.</div> : (
          <div className="st-tablewrap"><table className="st-table">
            <thead><tr><th>Prodotto</th>{th('Venduti', 'qty')}{th('Ricavi', 'rev')}<th className="r">Costo</th>{th('Margine €', 'margin')}{th('Margine %', 'pct')}<th>Valutazione</th></tr></thead>
            <tbody>{sorted.slice(0, 40).map(r => (
              <tr key={r.id}>
                <td>{r.name}</td><td className="r tnum">{r.qty}</td><td className="r tnum">{money(r.rev)}</td>
                <td className="r tnum">{r.cost === null ? '—' : money(r.cost)}</td>
                <td className="r tnum">{r.margin === null ? <span className="st-sub">senza ricetta</span> : money(r.margin)}{r.incomplete && <abbr title="Mancano i prezzi di alcuni ingredienti: il costo è sottostimato"> *</abbr>}</td>
                <td className="r tnum">{r.marginPct === null ? '—' : pct(r.marginPct)}</td>
                <td>{r.quad ? <span className={`st-pill ${r.quad === 'star' ? 'paid' : r.quad === 'reprice' ? 'unpaid' : ''}`} title={QUAD_LABEL[r.quad].hint}>{QUAD_LABEL[r.quad].label}</span> : ''}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        {rows.some(r => r.quad) && <ul className="st-legend">{(Object.keys(QUAD_LABEL) as (keyof typeof QUAD_LABEL)[]).map(k => <li key={k}><b>{QUAD_LABEL[k].label}</b> — {QUAD_LABEL[k].hint}</li>)}</ul>}
        {rows.some(r => r.incomplete) && <p className="st-hint">* Mancano i prezzi di acquisto di alcuni ingredienti: il margine reale è più basso di quello mostrato.</p>}
      </section>

      <section aria-label="Sprechi">
        <h2 className="st-h3">Sprechi e scarti</h2>
        {wc.rows.length === 0 ? <div className="st-empty">Nessuno spreco registrato nel periodo. Si registra da Scorte → Spreco.</div> : (
          <>
            <p className="st-hint">Valore degli scarti: <b>{money(wc.total)}</b>{sc.rev > 0 && <> (<b>{pct(wc.total / sc.rev)}</b> dei ricavi)</>}. Nel periodo prima: {money(wp.total)}.</p>
            <div className="st-tablewrap"><table className="st-table">
              <thead><tr><th>Ingrediente</th><th className="r">Quantità</th><th className="r">Valore</th><th className="r">Volte</th></tr></thead>
              <tbody>{wc.rows.slice(0, 12).map(w => <tr key={w.ing.id}><td>{w.ing.name}</td><td className="r tnum">{fmtQty(w.qty, w.ing.unit)}</td><td className="r tnum">{w.ing.pack_price > 0 ? money(w.value) : '—'}</td><td className="r tnum">{w.times}</td></tr>)}</tbody>
            </table></div>
          </>
        )}
      </section>

      <section aria-label="Cosa notare">
        <h2 className="st-h3">Da notare</h2>
        <ul className="st-notes">
          {sc.n === 0 && <li>Nel periodo non ci sono ordini: i dati compaiono man mano che si vende.</li>}
          {delta(sc.rev, sp.rev) !== null && <li>I ricavi sono {(delta(sc.rev, sp.rev) as number) >= 0 ? 'in aumento' : 'in calo'} del <b>{pct(Math.abs(delta(sc.rev, sp.rev) as number))}</b> rispetto ai {days} giorni precedenti.</li>}
          {topMargin && <li>Il prodotto che ha reso di più è <b>{topMargin.name}</b>: {money(topMargin.margin as number)} di margine su {topMargin.qty} venduti.</li>}
          {lowPct && (lowPct.marginPct as number) < bo.costs.target_margin / 100 && <li><b>{lowPct.name}</b> ha il margine più basso ({pct(lowPct.marginPct as number)}, contro il {bo.costs.target_margin}% desiderato): vale la pena rivedere prezzo o ricetta.</li>}
          {noRecipe.length > 0 && <li>{noRecipe.length} prodotti venduti non hanno una ricetta ({noRecipe.slice(0, 3).map(r => r.name).join(', ')}{noRecipe.length > 3 ? '…' : ''}): senza ricetta non si può calcolare il margine né scalare le scorte.</li>}
          {wc.total > 0 && wp.total > 0 && wc.total > wp.total * 1.2 && <li>Gli sprechi sono aumentati rispetto al periodo prima ({money(wp.total)} → {money(wc.total)}).</li>}
        </ul>
      </section>
    </div>
  )
}
