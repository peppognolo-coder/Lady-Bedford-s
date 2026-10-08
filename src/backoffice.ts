import { useCallback, useEffect, useState } from 'react'
import { api, type Backoffice } from './api'
import { EMPTY_BACKOFFICE } from './costs'

/** Ricettario, scorte e costi sempre aggiornati (si aggiorna da solo quando cambia qualcosa). */
export function useBackoffice() {
  const [data, setData] = useState<Backoffice>(EMPTY_BACKOFFICE)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    try { setData(await api.getBackoffice()); setLoaded(true); setError(null) } catch (e) { setError((e as Error).message) }
  }, [])
  useEffect(() => {
    void load()
    const off = api.subscribe(() => void load())
    const t = setInterval(() => void load(), 20000)
    return () => { off(); clearInterval(t) }
  }, [load])
  return { data, loaded, error, reload: load }
}

export const toNum = (t: string) => parseFloat(t.replace(/\s/g, '').replace(',', '.'))
export const numStr = (n: number) => (n ? String(Math.round(n * 1000) / 1000).replace('.', ',') : '')
export const idOf = (s: string) => (s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'ing') + '-' + Math.random().toString(36).slice(2, 5)
