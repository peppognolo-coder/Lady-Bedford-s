import { useState } from 'react'
import { api, type Catalog, type L } from '../api'
import type { Chapter, Content, GalleryItem } from '../api/types'
import { SOCIALS, chaptersOf, galleryOf, socialUrl } from '../content'
import { IMG } from '../data'
import { Field, Switch } from './shared'
import { ImagePicker } from './ImagePicker'

type Save = (f: () => Promise<void>, ok?: string) => Promise<boolean>
type Sec = 'foto' | 'storia' | 'galleria' | 'invito' | 'social'
const uid = () => Math.random().toString(36).slice(2, 9)
const swap = <T,>(a: T[], i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= a.length) return a; const c = [...a];[c[i], c[j]] = [c[j], c[i]]; return c }

export default function ContentTab({ catalog, save }: { catalog: Catalog; save: Save }) {
  const [sec, setSec] = useState<Sec>('foto')
  const [c, setC] = useState<Content>(catalog.content)
  const [dirty, setDirty] = useState(false)
  const upd = (f: (o: Content) => Content) => { setC(f); setDirty(true) }
  const setImg = (slot: string, url: string | null) => upd(o => { const images = { ...o.images }; if (url) images[slot] = url; else delete images[slot]; return { ...o, images } })
  const secs: [Sec, string][] = [['foto', 'Foto principali'], ['storia', 'Storia'], ['galleria', 'Galleria'], ['invito', 'Invito e contatti'], ['social', 'Social']]
  const chapters = chaptersOf(c), gallery = galleryOf(c)
  const setCh = (i: number, p: Partial<Chapter>) => upd(o => ({ ...o, chapters: chaptersOf(o).map((x, k) => (k === i ? { ...x, ...p } : x)) }))
  const setGa = (i: number, p: Partial<GalleryItem>) => upd(o => ({ ...o, gallery: galleryOf(o).map((x, k) => (k === i ? { ...x, ...p } : x)) }))
  const setInv = (k: keyof Content['invite'], lang: keyof L, v: string) => upd(o => ({ ...o, invite: { ...o.invite, [k]: { it: '', en: '', ...o.invite[k], [lang]: v } } }))
  const inv = (k: keyof Content['invite'], lang: keyof L) => c.invite[k]?.[lang] ?? ''

  return (
    <div className="st-pane">
      <div className="st-rowline" style={{ justifyContent: 'space-between' }}>
        <div className="st-chips" role="tablist">{secs.map(([id, l]) => <button key={id} role="tab" aria-selected={sec === id} onClick={() => setSec(id)}>{l}</button>)}</div>
        <button className="st-act" style={{ minHeight: 44, fontSize: 16 }} disabled={!dirty} onClick={async () => { if (await save(() => api.saveContent(c), 'Contenuti pubblicati')) setDirty(false) }}>{dirty ? 'Pubblica le modifiche' : 'Nessuna modifica'}</button>
      </div>
      <p className="st-hint">Le modifiche si vedono nell’app dei clienti solo dopo “Pubblica le modifiche”. Le foto vengono ridimensionate automaticamente.</p>

      {sec === 'foto' && (
        <section className="st-sheet">
          <h2 className="st-h3">Foto dell’app</h2>
          <div className="st-form">
            <Field label="Foto di copertina (home)" id="c-hero"><ImagePicker value={c.images.hero} fallback={IMG.hero} folder="site" max={1600} label="Copertina" onChange={u => setImg('hero', u)} /></Field>
            <Field label="Ritratto (box “La nostra storia”)" id="c-por"><ImagePicker value={c.images.portrait} fallback={IMG.portrait} folder="site" max={900} label="Ritratto" onChange={u => setImg('portrait', u)} /></Field>
            {catalog.services.map(s => (
              <Field key={s.id} label={`Servizio: ${s.title.it}`} id={`c-svc-${s.id}`}><ImagePicker value={c.images['svc:' + s.id]} fallback={IMG.svc[s.id]} folder="site" max={1200} label={s.title.it} onChange={u => setImg('svc:' + s.id, u)} /></Field>
            ))}
          </div>
        </section>
      )}

      {sec === 'storia' && (
        <section className="st-sheet">
          <h2 className="st-h3">Capitoli della storia</h2>
          {chapters.map((ch, i) => (
            <fieldset key={ch.id} className="st-form" style={{ border: '1px solid var(--color-divider, #ddd)', padding: 12, marginBottom: 12 }}>
              <legend>Capitolo {i + 1}</legend>
              <Field label="Sopratitolo (IT)" id={`s-k-it-${i}`}><input id={`s-k-it-${i}`} value={ch.kicker.it} onChange={e => setCh(i, { kicker: { ...ch.kicker, it: e.target.value } })} /></Field>
              <Field label="Sopratitolo (EN)" id={`s-k-en-${i}`}><input id={`s-k-en-${i}`} value={ch.kicker.en} onChange={e => setCh(i, { kicker: { ...ch.kicker, en: e.target.value } })} /></Field>
              <Field label="Titolo (IT)" id={`s-t-it-${i}`}><input id={`s-t-it-${i}`} value={ch.title.it} onChange={e => setCh(i, { title: { ...ch.title, it: e.target.value } })} /></Field>
              <Field label="Titolo (EN)" id={`s-t-en-${i}`}><input id={`s-t-en-${i}`} value={ch.title.en} onChange={e => setCh(i, { title: { ...ch.title, en: e.target.value } })} /></Field>
              <Field label="Testo (IT)" id={`s-b-it-${i}`}><textarea id={`s-b-it-${i}`} rows={5} value={ch.body.it} onChange={e => setCh(i, { body: { ...ch.body, it: e.target.value } })} /></Field>
              <Field label="Testo (EN)" id={`s-b-en-${i}`}><textarea id={`s-b-en-${i}`} rows={5} value={ch.body.en} onChange={e => setCh(i, { body: { ...ch.body, en: e.target.value } })} /></Field>
              <Field label="Foto del capitolo" id={`s-i-${i}`}><ImagePicker value={ch.image} folder="story" max={1400} label="Foto capitolo" onChange={u => setCh(i, { image: u })} /></Field>
              <div className="st-actions">
                <button className="st-ghost" disabled={i === 0} onClick={() => upd(o => ({ ...o, chapters: swap(chaptersOf(o), i, -1) }))}>↑ Su</button>
                <button className="st-ghost" disabled={i === chapters.length - 1} onClick={() => upd(o => ({ ...o, chapters: swap(chaptersOf(o), i, 1) }))}>↓ Giù</button>
                <button className="st-ghost" onClick={() => { if (confirm('Eliminare questo capitolo?')) upd(o => ({ ...o, chapters: chaptersOf(o).filter((_, k) => k !== i) })) }}>Elimina</button>
              </div>
            </fieldset>
          ))}
          <div className="st-actions">
            <button className="st-act alt" onClick={() => upd(o => ({ ...o, chapters: [...chaptersOf(o), { id: uid(), num: String(chaptersOf(o).length + 1).padStart(2, '0'), kicker: { it: '', en: '' }, title: { it: 'Nuovo capitolo', en: 'New chapter' }, body: { it: '', en: '' }, image: null }] }))}>Aggiungi capitolo</button>
            <button className="st-ghost" onClick={() => { if (confirm('Tornare ai testi e alle foto originali della storia?')) upd(o => ({ ...o, chapters: null })) }}>Ripristina originali</button>
          </div>
          <p className="st-hint">L’anno “1874” in cima alla pagina è fisso. Se serve cambiarlo, dimmelo.</p>
        </section>
      )}

      {sec === 'galleria' && (
        <section className="st-sheet">
          <h2 className="st-h3">Galleria</h2>
          {gallery.map((g, i) => (
            <fieldset key={g.id} className="st-form" style={{ border: '1px solid var(--color-divider, #ddd)', padding: 12, marginBottom: 12 }}>
              <legend>Foto {i + 1}</legend>
              <Field label="Immagine" id={`g-i-${i}`}><ImagePicker value={g.src} folder="gallery" max={1600} label={`Foto ${i + 1}`} onChange={u => u && setGa(i, { src: u })} /></Field>
              <Field label="Didascalia (IT)" id={`g-it-${i}`}><input id={`g-it-${i}`} value={g.it} onChange={e => setGa(i, { it: e.target.value })} /></Field>
              <Field label="Didascalia (EN)" id={`g-en-${i}`}><input id={`g-en-${i}`} value={g.en} onChange={e => setGa(i, { en: e.target.value })} /></Field>
              <Switch on={g.wide} onChange={v => setGa(i, { wide: v })} label="Foto larga (due colonne)" />
              <div className="st-actions">
                <button className="st-ghost" disabled={i === 0} onClick={() => upd(o => ({ ...o, gallery: swap(galleryOf(o), i, -1) }))}>↑ Su</button>
                <button className="st-ghost" disabled={i === gallery.length - 1} onClick={() => upd(o => ({ ...o, gallery: swap(galleryOf(o), i, 1) }))}>↓ Giù</button>
                <button className="st-ghost" onClick={() => { if (confirm('Eliminare questa foto dalla galleria?')) upd(o => ({ ...o, gallery: galleryOf(o).filter((_, k) => k !== i) })) }}>Elimina</button>
              </div>
            </fieldset>
          ))}
          <div className="st-actions">
            <NewGalleryPhoto onAdd={src => upd(o => ({ ...o, gallery: [...galleryOf(o), { id: uid(), src, it: '', en: '', wide: false }] }))} />
            <button className="st-ghost" onClick={() => { if (confirm('Tornare alla galleria originale?')) upd(o => ({ ...o, gallery: null })) }}>Ripristina originale</button>
          </div>
        </section>
      )}

      {sec === 'social' && (
        <section className="st-sheet">
          <h2 className="st-h3">Social e contatti</h2>
          <p className="st-hint">Compaiono nell’app dei clienti, nella pagina d’invito e nella carta da visita. Lascia vuoto ciò che non usi.</p>
          <div className="st-form">
            {SOCIALS.map(s => {
              const v = c.social?.[s.id] ?? ''
              const ok = !v.trim() || socialUrl(s.id, v)
              return (
                <Field key={s.id} label={s.label} id={`so-${s.id}`} hint={ok ? s.hint : 'Non riconosco questo valore: controlla il link o il nome.'}>
                  <input id={`so-${s.id}`} value={v} maxLength={200} autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-invalid={!ok} onChange={e => upd(o => ({ ...o, social: { ...o.social, [s.id]: e.target.value } }))} />
                </Field>
              )
            })}
          </div>
        </section>
      )}
      {sec === 'invito' && (
        <section className="st-sheet">
          <h2 className="st-h3">Pagina d’invito e contatti</h2>
          <p className="st-hint">Lascia vuoto un campo per usare il testo originale.</p>
          <div className="st-form">
            {([['kicker', 'Sopratitolo'], ['line1', 'Prima frase'], ['line2', 'Seconda frase'], ['address', 'Indirizzo e telefono'], ['rsvp', 'Nota finale']] as [keyof Content['invite'], string][]).map(([k, l]) => (
              (['it', 'en'] as const).map(lang => (
                <Field key={k + lang} label={`${l} (${lang.toUpperCase()})`} id={`i-${k}-${lang}`}>
                  <textarea id={`i-${k}-${lang}`} rows={k === 'address' ? 2 : 1} value={inv(k, lang)} onChange={e => setInv(k, lang, e.target.value)} />
                </Field>
              ))
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function NewGalleryPhoto({ onAdd }: { onAdd: (src: string) => void }) {
  return <ImagePicker value={null} folder="gallery" max={1600} label="Nuova foto" onChange={u => u && onAdd(u)} />
}
