import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import type { StaffConfig, StaffMember } from '../api/types'
import { DEFAULT_STAFF_CONFIG } from '../shifts'
import HoursTab from './HoursTab'
import ShiftPlanner from './ShiftPlanner'
import { PeopleSection, RulesSection } from './PeopleRules'

type Sec = 'turni' | 'ore' | 'persone' | 'regole'

/** Dati di base del personale, sempre riletti dopo ogni modifica. */
export function useStaffData() {
  const [members, setMembers] = useState<StaffMember[] | null>(null)
  const [config, setConfig] = useState<StaffConfig>(DEFAULT_STAFF_CONFIG)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(async () => {
    try { const [m, c] = await Promise.all([api.listStaff(), api.getStaffConfig()]); setMembers(m); setConfig(c); setError(null) } catch (e) { setError((e as Error).message) }
  }, [])
  useEffect(() => { void reload() }, [reload])
  return { members, config, error, reload }
}

/** Personale e turni: visibile e modificabile solo dalla proprietà. */
export default function StaffTab() {
  const data = useStaffData()
  const [sec, setSec] = useState<Sec>('turni')
  const secs: [Sec, string][] = [['turni', 'Turni'], ['ore', 'Ore lavorate'], ['persone', 'Persone'], ['regole', 'Regole e modelli']]
  if (data.error) return <div className="st-pane"><div className="st-alert" role="alert">{data.error}. Se è la prima volta, esegui di nuovo lo script SQL (supabase/sql/01_schema.sql).</div></div>
  if (!data.members) return <div className="st-pane"><p className="st-hint">Caricamento…</p></div>
  const noPeople = !data.members.some(m => m.active)
  return (
    <div className="st-pane wide">
      <div className="st-chips" role="tablist">{secs.map(([id, l]) => <button key={id} role="tab" aria-selected={sec === id} onClick={() => setSec(id)}>{l}</button>)}</div>
      {noPeople && sec !== 'persone' && <div className="st-empty">Per iniziare aggiungi le persone che lavorano da te, nella scheda <button className="link" onClick={() => setSec('persone')}>Persone</button>.</div>}
      {sec === 'turni' && !noPeople && <ShiftPlanner members={data.members} config={data.config} />}
      {sec === 'ore' && !noPeople && <HoursTab members={data.members} />}
      {sec === 'persone' && <PeopleSection members={data.members} reload={data.reload} />}
      {sec === 'regole' && <RulesSection config={data.config} reload={data.reload} />}
    </div>
  )
}
