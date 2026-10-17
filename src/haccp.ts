import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import type { HaccpDocument, HaccpCleanLog, HaccpEquipment, HaccpNc, HaccpReading, HaccpTask } from './api/types'
import { isoDay } from './booking'

export const KIND_LABEL: Record<string, string> = { frigo: 'Frigo', congelatore: 'Congelatore', abbattitore: 'Abbattitore', altro: 'Altro' }
export const FREQ_LABEL: Record<string, string> = { giornaliera: 'Ogni giorno', settimanale: 'Ogni settimana', mensile: 'Ogni mese' }
export const fmtTemp = (n: number) => `${String(n).replace('.', ',')} °C`
export const parseTemp = (s: string) => Number(s.trim().replace(',', '.').replace('−', '-'))

/** Lunedì della settimana e primo del mese, per sapere se un compito periodico è già fatto. */
export const periodStart = (f: string, now = new Date()) => {
  if (f === 'giornaliera') return isoDay(now)
  if (f === 'mensile') return isoDay(new Date(now.getFullYear(), now.getMonth(), 1))
  const d = new Date(now); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoDay(d)
}

/** Quante rilevazioni di oggi dovrebbero già esserci per un apparecchio, e quante ce ne sono. */
export function slotStatus(eq: HaccpEquipment, today: HaccpReading[], now = new Date()) {
  const mins = now.getHours() * 60 + now.getMinutes()
  const due = eq.slots.filter(s => { const [h, m] = s.split(':').map(Number); return h * 60 + m <= mins }).length
  const done = today.filter(r => r.equipment_id === eq.id && !r.corrects_id).length
  return { due, done, missing: Math.max(0, due - done) }
}

export type CertState = 'scaduto' | 'in_scadenza' | 'valido'
export const certState = (expires: string, now = new Date()): CertState => {
  const today = isoDay(now)
  if (expires < today) return 'scaduto'
  const lim = new Date(now); lim.setDate(lim.getDate() + 60)
  return expires <= isoDay(lim) ? 'in_scadenza' : 'valido'
}
export const CERT_LABEL: Record<CertState, string> = { scaduto: 'Scaduto', in_scadenza: 'In scadenza', valido: 'Valido' }
export const fmtDay = (d: string) => new Date(d + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
export const fmtHM = (iso: string) => new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })

export const DOC_CAT: Record<string, string> = { piano: 'Piano di autocontrollo', procedura: 'Procedura', scheda: 'Scheda o etichetta', rapporto: 'Rapporto (ASL, disinfestazione, manutenzione)', altro: 'Altro' }
export const fmtSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
/** Apre un documento in una nuova scheda; la scheda si apre subito per non essere bloccata dal telefono. */
export async function openDoc(doc: HaccpDocument) {
  const w = window.open('', '_blank')
  try {
    const url = await api.haccpDocumentUrl(doc)
    if (w) w.location.href = url; else window.location.href = url
  } catch (e) { w?.close(); throw e }
}

export const OP_KEY = 'lb:haccp:op'
export const loadOp = () => { try { return localStorage.getItem(OP_KEY) || '' } catch { return '' } }
export const saveOp = (n: string) => { try { localStorage.setItem(OP_KEY, n) } catch { /* ignore */ } }

export interface HaccpData { equipment: HaccpEquipment[]; tasks: HaccpTask[]; today: HaccpReading[]; cleaning: HaccpCleanLog[]; ncs: HaccpNc[] }

/** Dati HACCP di oggi (e del periodo di pulizie), riletti a ogni cambiamento. */
export function useHaccp() {
  const [data, setData] = useState<HaccpData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(async () => {
    try {
      const now = new Date(), t = isoDay(now)
      const from = [periodStart('mensile', now), periodStart('settimanale', now)].sort()[0]
      const [equipment, tasks, today, cleaning, ncs] = await Promise.all([api.listHaccpEquipment(), api.listHaccpTasks(), api.listHaccpReadings(t, t), api.listHaccpCleaning(from, t), api.listHaccpNcs()])
      setData({ equipment, tasks, today, cleaning, ncs }); setError(null)
    } catch (e) { setError((e as Error).message) }
  }, [])
  useEffect(() => { void reload(); return api.subscribe(() => { void reload() }) }, [reload])
  return { data, error, reload }
}

/** Un compito di pulizia è "fatto" se esiste una spunta nel suo periodo (giorno, settimana o mese). */
export const cleanDone = (t: HaccpTask, logs: HaccpCleanLog[]) => logs.find(l => l.task_id === t.id && l.day >= periodStart(t.frequency))
