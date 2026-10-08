import { useRef, useState } from 'react'
import { api } from '../api'
import { prepareImage } from '../image'

/** Anteprima + carica/cambia/togli di una foto. `value` vuoto = nessuna foto (o originale). */
export function ImagePicker({ value, fallback, folder, max, onChange, label = 'Foto', ratio = '4 / 3' }: {
  value?: string | null; fallback?: string; folder: string; max: number; onChange: (url: string | null) => void; label?: string; ratio?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const shown = value || fallback
  const pick = async (f?: File) => {
    if (!f) return
    setBusy(true); setErr(null)
    try { const blob = await prepareImage(f, max); onChange(await api.uploadImage(blob, folder)) } catch (e) { setErr((e as Error).message) } finally { setBusy(false); if (ref.current) ref.current.value = '' }
  }
  return (
    <div className="st-imgpick" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ width: 120, aspectRatio: ratio, background: 'var(--color-divider, #ddd)', borderRadius: 4, overflow: 'hidden', flex: 'none', display: 'grid', placeItems: 'center', fontSize: 12, color: '#777' }}>
        {shown ? <img src={shown} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'Nessuna foto'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
        <input ref={ref} type="file" accept="image/*" hidden onChange={e => void pick(e.target.files?.[0])} aria-label={`${label}: scegli file`} />
        <button type="button" className="st-ghost" disabled={busy} onClick={() => ref.current?.click()}>{busy ? 'Carico…' : value ? 'Cambia foto' : 'Carica foto'}</button>
        {value && <button type="button" className="st-ghost" onClick={() => onChange(null)}>{fallback ? 'Ripristina originale' : 'Togli foto'}</button>}
        {err && <small role="alert" style={{ color: '#a33' }}>{err}</small>}
      </div>
    </div>
  )
}
