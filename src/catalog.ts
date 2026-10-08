import { useCallback, useEffect, useState } from 'react'
import { api, type Catalog, type MenuItem, type Settings } from './api'

export { DEFAULT_CATALOG, DEFAULT_SETTINGS } from './defaults'
import { DEFAULT_CATALOG } from './defaults'

/** Catalogo (menu, servizi, impostazioni) sempre aggiornato; parte dai dati di serie. */
export function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog>(DEFAULT_CATALOG)
  const [loaded, setLoaded] = useState(false)
  const load = useCallback(async () => {
    try { setCatalog(await api.getCatalog()); setLoaded(true) } catch { /* resta l'ultimo noto */ }
  }, [])
  useEffect(() => {
    void load()
    const off = api.subscribe(() => void load())
    const t = setInterval(() => void load(), 30000)
    return () => { off(); clearInterval(t) }
  }, [load])
  return { catalog, loaded, reload: load }
}

export const sortMenu = (m: MenuItem[]) => [...m].sort((a, b) => a.sort - b.sort)

const DAYS_IT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const DAY_NAMES = { it: DAYS_IT, en: DAYS_EN }

/** "Mar–Dom · 11:00–19:00" a partire dalle impostazioni (settimana da lunedì). */
export function hoursLabel(s: Settings, lang: 'it' | 'en') {
  const names = DAY_NAMES[lang]
  const order = [1, 2, 3, 4, 5, 6, 0]
  const on = order.filter(d => s.open_days.includes(d))
  const hours = `${s.open_time}–${s.close_time}`
  if (!on.length) return lang === 'it' ? 'Chiuso' : 'Closed'
  const runs: number[][] = []
  order.forEach((d, i) => {
    if (!on.includes(d)) return
    const last = runs[runs.length - 1]
    if (last && order.indexOf(last[last.length - 1]) === i - 1) last.push(d); else runs.push([d])
  })
  const txt = runs.map(r => (r.length === 1 ? names[r[0]] : r.length === 2 ? `${names[r[0]]}, ${names[r[1]]}` : `${names[r[0]]}–${names[r[r.length - 1]]}`)).join(', ')
  return `${txt} · ${hours}`
}

export function isOpenNow(s: Settings, at = new Date()) {
  if (!s.open_days.includes(at.getDay())) return false
  const m = at.getHours() * 60 + at.getMinutes()
  const [oh, om] = s.open_time.split(':').map(Number), [ch, cm] = s.close_time.split(':').map(Number)
  return m >= oh * 60 + om && m < ch * 60 + cm
}
