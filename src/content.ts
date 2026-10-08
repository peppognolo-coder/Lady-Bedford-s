import { CHAPTERS, GALLERY, IMG } from './data'
import type { Chapter, Content, GalleryItem, SocialId } from './api/types'

export const EMPTY_CONTENT: Content = { images: {}, chapters: null, gallery: null, invite: {}, social: {} }

/** Profili e contatti: la proprietà scrive @nome, un numero o un indirizzo web; qui diventa un link sicuro (solo https). */
export const SOCIALS: { id: SocialId; label: string; hint: string }[] = [
  { id: 'instagram', label: 'Instagram', hint: '@ladybedfords oppure il link del profilo' },
  { id: 'facebook', label: 'Facebook', hint: 'nome della pagina oppure il link' },
  { id: 'tiktok', label: 'TikTok', hint: '@nome oppure il link' },
  { id: 'whatsapp', label: 'WhatsApp', hint: 'numero con prefisso, es. 39 333 1234567' },
  { id: 'maps', label: 'Google Maps', hint: 'link della scheda (Condividi → Copia link)' },
  { id: 'website', label: 'Sito web', hint: 'indirizzo del sito' },
]
const HANDLE = /^@?[A-Za-z0-9._]{1,40}$/
export function socialUrl(id: SocialId, raw: string | undefined): string | null {
  const v = (raw ?? '').trim()
  if (!v) return null
  if (id === 'whatsapp') {
    const d = v.replace(/[^\d]/g, '')
    return d.length >= 8 && d.length <= 15 && !/^https?:/i.test(v) ? `https://wa.me/${d}` : (/^https:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(v) ? v : null)
  }
  if (/^https:\/\//i.test(v)) { try { return new URL(v).href } catch { return null } }
  if (/^http:\/\//i.test(v)) { try { const u = new URL(v); u.protocol = 'https:'; return u.href } catch { return null } }
  if (id === 'website' || id === 'maps') { try { return /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(v) ? new URL('https://' + v).href : null } catch { return null } }
  if (!HANDLE.test(v)) return null
  const h = v.replace(/^@/, '')
  return id === 'instagram' ? `https://www.instagram.com/${h}/` : id === 'facebook' ? `https://www.facebook.com/${h}` : `https://www.tiktok.com/@${h}`
}

/** Capitoli della storia di serie, uniti italiano/inglese. */
export const defaultChapters = (): Chapter[] => CHAPTERS.it.map((it, i) => {
  const en = CHAPTERS.en[i]
  return { id: it.num, num: it.num, kicker: { it: it.kicker, en: en.kicker }, title: { it: it.title, en: en.title }, body: { it: it.body, en: en.body }, image: IMG.story[it.num] ?? null }
})
export const defaultGallery = (): GalleryItem[] => GALLERY.map(g => ({ id: g.id, src: g.src, it: g.it, en: g.en, wide: g.span === 'span 2', h: g.h }))

export const chaptersOf = (c: Content) => c.chapters ?? defaultChapters()
export const galleryOf = (c: Content) => c.gallery ?? defaultGallery()
/** Foto principale: quella caricata dalla proprietà oppure quella di serie. */
export const imageOf = (c: Content, slot: string, fallback?: string) => c.images[slot] || fallback
export const galleryH = (g: GalleryItem) => g.h ?? (g.wide ? '260px' : '220px')
