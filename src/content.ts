import { CHAPTERS, GALLERY, IMG } from './data'
import type { Chapter, Content, GalleryItem } from './api/types'

export const EMPTY_CONTENT: Content = { images: {}, chapters: null, gallery: null, invite: {} }

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
