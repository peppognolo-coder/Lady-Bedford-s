import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { api, type OrderStatus } from './api'
import { useCatalog, sortMenu, hoursLabel, isOpenNow } from './catalog'
import { TX, CATS, CHAPTERS, GALLERY, TABS, IMG, eur, type Lang, type Screen } from './data'

/* ---------- icone (Lucide) ---------- */
const P: Record<string, ReactNode> = {
  back: <path d="m12 19-7-7 7-7M19 12H5" />,
  user: <><circle cx="12" cy="8" r="4.5" /><path d="M20 21a8 8 0 0 0-16 0" /></>,
  bag: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></>,
  plus: <path d="M5 12h14M12 5v14" />,
  minus: <path d="M5 12h14" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="M20 6 9 17l-5-5" />,
  home: <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />,
  cup: <><path d="M17 8h1a4 4 0 1 1 0 8h-1" /><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" /><path d="M6 2v3M10 2v3M14 2v3" /></>,
  cupS: <><path d="M17 8h1a4 4 0 1 1 0 8h-1" /><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" /></>,
  book: <><path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" /><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></>,
  cal: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
}
function Icon({ n, size = 18, sw = 1.5 }: { n: keyof typeof P; size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {P[n]}
    </svg>
  )
}

/* ---------- stato persistente ---------- */
type PastOrder = { title: string; meta: string; total: string }
type Persist = { lang: Lang; name: string; stamps: number; orderNo: number; lastOrder?: { id: string; number: number } | null; cart: Record<string, number>; past: { lines: string; date: string; slot: string; total: number }[] }
const KEY = 'lady-bedford:v1'
const initial: Persist = { lang: 'it', name: 'Beatrice', stamps: 6, orderNo: 47, cart: {}, past: [] }
function load(): Persist {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...initial, ...JSON.parse(raw) }
  } catch { /* storage non disponibile */ }
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'it'
  return { ...initial, lang: nav.toLowerCase().startsWith('it') ? 'it' : 'en' }
}

const ss = {
  get: (k: string) => { try { return sessionStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { sessionStorage.setItem(k, v) } catch { /* ignore */ } },
  del: (k: string) => { try { sessionStorage.removeItem(k) } catch { /* ignore */ } },
}
const SCREENS: Screen[] = ['invite', 'home', 'menu', 'story', 'gallery', 'services', 'profile', 'cart', 'checkout', 'done']
const fromHash = (): Screen => {
  const h = location.hash.replace(/^#\/?/, '') as Screen
  return SCREENS.includes(h) && h !== 'done' && h !== 'checkout' ? h : 'invite'
}

/* ---------- app ---------- */
export default function App() {
  const [p, setP] = useState<Persist>(load)
  const [screen, setScreen] = useState<Screen>(() => (ss.get('lb:entered') ? fromHash() : 'invite'))
  const [prev, setPrev] = useState<Screen>('home')
  const [cat, setCat] = useState('tea')
  const [slot, setSlot] = useState(1)
  const [nameTouched, setNameTouched] = useState(false)
  const [dialog, setDialog] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [day, setDay] = useState(0)
  const [guests, setGuests] = useState(2)
  const [toast, setToast] = useState<string | null>(null)
  const [last, setLast] = useState({ total: 0, slot: '' })
  const { catalog, loaded: catLoaded, reload: reloadCatalog } = useCatalog()
  const menu = useMemo(() => sortMenu(catalog.menu.filter(m => m.visible)), [catalog.menu])
  const byId = useMemo(() => Object.fromEntries(menu.map(m => [m.id, m])), [menu])
  const SLOTS = catalog.settings.slots.length ? catalog.settings.slots : ['16:00']
  const slotValue = SLOTS[Math.min(slot, SLOTS.length - 1)]
  const [live, setLive] = useState<OrderStatus | null>(null)
  const [placing, setPlacing] = useState(false)
  const [orderErr, setOrderErr] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<number>()

  const { lang } = p
  const t = TX[lang]

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* ignore */ } }, [p])
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  useEffect(() => {
    if (!catLoaded) return
    const stale = Object.keys(p.cart).filter(id => !byId[id])
    if (stale.length) setP(o => { const cart = { ...o.cart }; stale.forEach(id => delete cart[id]); return { ...o, cart } })
  }, [catLoaded, byId, p.cart])
  const lastId = p.lastOrder?.id
  useEffect(() => {
    if (!lastId) { setLive(null); return }
    let alive = true
    const poll = () => api.orderStatus(lastId).then(s => {
      if (!alive) return
      setLive(s)
      if (!s || s.status === 'completed' || s.status === 'cancelled') clearInterval(timer)
    }).catch(() => { /* riprova al prossimo giro */ })
    const timer = setInterval(poll, 6000)
    poll()
    return () => { alive = false; clearInterval(timer) }
  }, [lastId])
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }) }, [screen])
  useEffect(() => () => window.clearTimeout(toastTimer.current), [])
  useEffect(() => {
    try {
      if (screen !== 'invite' && screen !== 'done' && screen !== 'checkout') history.replaceState(null, '', '#' + screen)
      else if (screen === 'invite') history.replaceState(null, '', location.pathname + location.search)
    } catch { /* frame senza history */ }
  }, [screen])
  useEffect(() => {
    if (!dialog) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDialog(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog])

  const go = (s: Screen) => {
    setPrev(TABS.includes((screen === 'invite' ? 'home' : screen) as never) ? (screen === 'invite' ? 'home' : screen) : prev)
    setToast(null)
    if (s === 'home' || s === 'menu') ss.set('lb:entered', '1')
    setScreen(s)
  }
  const patch = (x: Partial<Persist>) => setP(o => ({ ...o, ...x }))

  const qty = (id: string, d: number) => {
    if (d > 0 && (!byId[id] || !byId[id].available)) return
    setP(o => {
      const q = Math.max(0, (o.cart[id] || 0) + d)
      const cart = { ...o.cart, [id]: q }
      if (!q) delete cart[id]
      return { ...o, cart }
    })
    if (d > 0 && screen !== 'cart') {
      const it = byId[id]
      window.clearTimeout(toastTimer.current)
      setToast(`${it.name[lang]} ${t.added}`)
      toastTimer.current = window.setTimeout(() => setToast(null), 2200)
    }
  }

  const cartIds = Object.keys(p.cart).filter(id => byId[id])
  const count = cartIds.reduce((a, id) => a + p.cart[id], 0)
  const priceOf = (id: string) => byId[id]?.price ?? 0
  const soldOut = (id: string) => byId[id]?.available === false
  const total = cartIds.reduce((a, id) => a + priceOf(id) * p.cart[id], 0)
  const name = p.name.trim()
  const loc = (id: string) => { const m = byId[id]; return { id, vg: m.vg, name: m.name[lang], desc: m.desc[lang], price: eur(m.price, lang) } }

  const placeOrder = async () => {
    if (!name) { setNameTouched(true); return }
    const ids = cartIds
    if (!ids.length || placing) return
    setPlacing(true); setOrderErr(null)
    try {
      const res = await api.placeOrder({ customer_name: name, pickup_slot: slotValue, items: ids.map(id => ({ item_id: id, qty: p.cart[id] })) })
      const lines = ids.map(id => `${p.cart[id] > 1 ? p.cart[id] + '× ' : ''}${byId[id].name[lang]}`).join(', ')
      setLast({ total, slot: slotValue })
      setP(o => ({ ...o, cart: {}, lastOrder: res, stamps: Math.min(10, o.stamps + 1), orderNo: res.number, past: [{ lines, date: new Date().toISOString(), slot: slotValue, total }, ...o.past].slice(0, 10) }))
      setLive({ number: res.number, status: 'new', payment_status: 'unpaid' })
      setScreen('done')
    } catch (e) {
      setOrderErr((e as Error).message.toLowerCase().includes('esaurito') ? t.orderSoldOut : t.orderError)
      void reloadCatalog()
    } finally { setPlacing(false) }
  }

  const showHeader = screen !== 'invite' && screen !== 'done'
  const showTabs = showHeader && screen !== 'checkout'
  const showBack = ['cart', 'checkout', 'profile'].includes(screen)
  const [hk, ht] = (t.headers as Record<string, string[]>)[screen] || ['', '']

  const open = isOpenNow(catalog.settings)

  const pastOrders: PastOrder[] = [
    ...p.past.map(o => ({
      title: o.lines,
      meta: `${new Date(o.date).toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'long' })} · ${lang === 'it' ? 'ritiro' : 'pickup'} ${o.slot}`,
      total: eur(o.total, lang),
    })),
    ...(lang === 'it'
      ? [{ title: 'Cestino per due', meta: '14 settembre · ritirato alle 17:00', total: '€ 32,00' }, { title: 'Scone e Lady Bedford Blend', meta: '2 settembre · ritirato alle 16:30', total: '€ 11,00' }]
      : [{ title: 'Hamper for two', meta: '14 September · collected at 17:00', total: '€ 32.00' }, { title: 'Scone & Lady Bedford Blend', meta: '2 September · collected at 16:30', total: '€ 11.00' }]),
  ]

  const LangSeg = ({ labels, big }: { labels: [string, string]; big?: boolean }) => (
    <div className="seg" style={{ fontSize: big ? 12 : 11 }}>
      {(['it', 'en'] as Lang[]).map((l, i) => (
        <button key={l} aria-pressed={lang === l} onClick={() => patch({ lang: l })} style={{ padding: big ? '8px 14px' : '6px 10px' }}>{labels[i]}</button>
      ))}
    </div>
  )

  return (
    <div className="app">
      {showHeader && (
        <header style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px 12px', borderBottom: '1px solid var(--color-divider)' }}>
          {showBack ? (
            <button className="circ" aria-label={lang === 'it' ? 'Indietro' : 'Back'} onClick={() => go(screen === 'checkout' ? 'cart' : prev)}><Icon n="back" /></button>
          ) : (
            <div className="h-serif" style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid var(--color-accent)', display: 'grid', placeItems: 'center', fontStyle: 'italic', fontSize: 17, color: 'var(--color-accent-700)', flex: 'none' }}>LB</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="kicker">{hk}</div>
            <div className="h-serif" style={{ fontWeight: 600, fontSize: 22, lineHeight: 1.1 }}>{ht}</div>
          </div>
          <button className="circ" aria-label={lang === 'it' ? 'Profilo' : 'Profile'} onClick={() => go('profile')}><Icon n="user" /></button>
          <button className="circ acc" aria-label={lang === 'it' ? 'Cestino' : 'Cart'} onClick={() => go('cart')}>
            <Icon n="bag" />
            {count > 0 && <span className="tnum" style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, background: 'var(--color-accent-700)', color: 'var(--color-bg)', fontSize: 10, display: 'grid', placeItems: 'center', padding: '0 4px' }}>{count}</span>}
          </button>
        </header>
      )}

      <main className="scroll" ref={scrollRef}>
        {screen === 'invite' && <Invite t={t} onEnter={() => go('home')} seg={<LangSeg labels={['IT', 'EN']} />} />}

        {screen === 'home' && (
          <div className="fade" style={{ padding: '20px 20px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div>
              <h1 className="h-serif" style={{ fontWeight: 400, fontSize: 34, lineHeight: 1.05, margin: 0 }}>{t.greet(name || (lang === 'it' ? 'ospite' : 'guest'))}</h1>
              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--color-neutral-700)', lineHeight: 1.55 }}>{t.homeSub}</p>
            </div>
            <div style={{ border: '1px solid var(--lb-green)', borderRadius: '160px 160px 4px 4px', padding: 6, position: 'relative' }}>
              <div className="plate" style={{ height: 300, position: 'relative', borderRadius: '154px 154px 2px 2px', overflow: 'hidden', borderColor: 'var(--lb-green-100)' }}>
                <img className="imgslot" src={IMG.hero} alt={t.verandaCaption} style={{ objectPosition: '50% 30%' }} />
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 3, marginLeft: -1.5, background: 'var(--lb-green-100)', opacity: 0.9 }} />
                  <div style={{ position: 'absolute', left: 0, right: 0, top: '46%', height: 3, background: 'var(--lb-green-100)', opacity: 0.9 }} />
                </div>
              </div>
              <div className="kicker" style={{ position: 'absolute', left: '50%', bottom: -10, transform: 'translateX(-50%)', background: 'var(--color-bg)', padding: '0 10px', color: 'var(--lb-green-700)', whiteSpace: 'nowrap' }}>{t.verandaCaption}</div>
            </div>
            {live && live.status !== 'completed' && live.status !== 'cancelled' && (
              <button onClick={() => setScreen('done')} style={{ textAlign: 'left', background: 'transparent', border: '1px solid var(--lb-green)', borderRadius: 'var(--radius-md)', padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="h-serif tnum" style={{ fontSize: 26, fontWeight: 600, color: 'var(--lb-green-700)' }}>{String(live.number).padStart(3, '0')}</span>
                <span style={{ flex: 1 }}>
                  <span className="kicker" style={{ display: 'block', color: 'var(--lb-green-700)' }}>{t.yourOrder}</span>
                  <span className="h-serif" style={{ fontSize: 17, fontWeight: 600 }}>{t.statusLabel[live.status as 'new' | 'preparing' | 'ready']}</span>
                </span>
              </button>
            )}
            <div style={{ borderTop: '1px solid var(--color-divider)', borderBottom: '1px solid var(--color-divider)', padding: '14px 2px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div className="h-serif" style={{ fontSize: 44, lineHeight: 0.8, color: 'var(--lb-green)' }}>“</div>
              <div style={{ flex: 1 }}>
                <div className="h-serif" style={{ fontStyle: 'italic', fontSize: 17, lineHeight: 1.35 }}>{catalog.settings.butler[lang]}</div>
                <div className="kicker" style={{ marginTop: 6, fontSize: 10, letterSpacing: '.14em' }}>{t.butlerSign}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button className="tile" onClick={() => go('menu')} style={tile('var(--color-accent)')}>
                <span style={{ color: 'var(--color-accent-700)' }}><Icon n="bag" size={20} /></span>
                <span className="h-serif" style={{ fontWeight: 600, fontSize: 18, lineHeight: 1.1 }}>{t.homeOrder}</span>
                <span style={{ fontSize: 11, color: 'var(--color-neutral-700)' }}>{t.homeOrderSub}</span>
              </button>
              <button className="tile" onClick={() => go('services')} style={tile('var(--color-divider)')}>
                <span style={{ color: 'var(--color-accent-700)' }}><Icon n="cup" size={20} /></span>
                <span className="h-serif" style={{ fontWeight: 600, fontSize: 18, lineHeight: 1.1 }}>{t.homeTea}</span>
                <span style={{ fontSize: 11, color: 'var(--color-neutral-700)' }}>{t.homeTeaSub}</span>
              </button>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <h2 className="h-serif" style={{ fontWeight: 600, fontSize: 21, margin: 0 }}>{t.homeToday}</h2>
                <button className="link" style={{ fontSize: 12 }} onClick={() => go('menu')}>{t.seeMenu}</button>
              </div>
              {catalog.settings.featured.filter(id => byId[id]).slice(0, 4).map(id => {
                const m = loc(id)
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: '1px solid var(--color-divider)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="h-serif" style={{ fontWeight: 600, fontSize: 17 }}>{m.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--color-neutral-700)', marginTop: 2 }}>{m.desc}</div>
                    </div>
                    <div className="tnum" style={{ fontSize: 13 }}>{m.price}</div>
                    <button className="circ acc" style={{ width: 34, height: 34, opacity: soldOut(id) ? 0.4 : 1 }} disabled={soldOut(id)} aria-label={`${t.add}: ${m.name}`} onClick={() => qty(id, 1)}><Icon n="plus" size={15} sw={1.6} /></button>
                  </div>
                )
              })}
            </div>
            <button onClick={() => go('story')} style={{ textAlign: 'left', background: 'transparent', border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-md)', padding: 0, cursor: 'pointer', display: 'grid', gridTemplateColumns: '110px 1fr', overflow: 'hidden' }}>
              <div style={{ position: 'relative', height: 120 }}><img className="imgslot" src={IMG.portrait} alt="" /></div>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
                <div className="kicker">{t.homeStoryKicker}</div>
                <div className="h-serif" style={{ fontWeight: 600, fontSize: 19, lineHeight: 1.15 }}>{t.homeStoryTitle}</div>
                <div style={{ fontSize: 11.5, color: 'var(--color-neutral-700)', textDecoration: 'underline', textUnderlineOffset: 3 }}>{t.readMore}</div>
              </div>
            </button>
            <div className="tnum" style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 14, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-neutral-700)' }}>
              <span>{hoursLabel(catalog.settings, lang)}</span><span style={{ color: 'var(--color-accent-700)' }}>{open ? t.openNow : t.closedNow}</span>
            </div>
          </div>
        )}

        {screen === 'menu' && (
          <div className="fade">
            <div className="lb-cats" role="tablist" style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--color-bg)', padding: '14px 20px 12px', borderBottom: '1px solid var(--color-divider)', display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
              {CATS.map(c => (
                <button key={c.id} role="tab" aria-selected={c.id === cat} onClick={() => setCat(c.id)}
                  style={{ flex: 'none', padding: '8px 14px', borderRadius: 20, background: 'transparent', fontSize: 12.5, cursor: 'pointer', border: `1px solid ${c.id === cat ? 'var(--lb-green)' : 'var(--color-divider)'}`, color: c.id === cat ? 'var(--lb-green-700)' : 'var(--color-text)' }}>{c[lang]}</button>
              ))}
            </div>
            <div style={{ padding: '16px 20px 28px' }}>
              <p className="h-serif" style={{ margin: '0 0 6px', fontStyle: 'italic', fontSize: 16, lineHeight: 1.4, color: 'var(--color-neutral-800)' }}>{CATS.find(c => c.id === cat)![lang === 'it' ? 'introIt' : 'introEn']}</p>
              <div style={{ display: 'flex', gap: 12, fontSize: 10.5, color: 'var(--color-neutral-700)', marginBottom: 8 }}>
                <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}><span className="pill vg">VG</span>{t.vegan}</span>
                <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}><span className="pill v">V</span>{t.vegetarian}</span>
              </div>
              {menu.filter(m => m.cat === cat).map(({ id }) => {
                const m = loc(id), q = p.cart[id] || 0
                return (
                  <div key={id} style={{ padding: '16px 0', borderTop: '1px solid var(--color-divider)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <div className="h-serif" style={{ fontWeight: 600, fontSize: 18.5, lineHeight: 1.15, flex: 1 }}>{m.name}</div>
                      <div className="tnum" style={{ fontSize: 13 }}>{m.price}</div>
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--color-neutral-700)', textWrap: 'pretty' as CSSProperties['textWrap'] }}>{m.desc}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {m.vg ? <span className="pill vg">VG · {t.vegan}</span> : <span className="pill v">V · {t.vegetarian}</span>}
                      </div>
 {soldOut(id) && q === 0 ? (
                        <span className="pill v" style={{ fontSize: 11 }}>{t.soldOut}</span>
                      ) : q === 0 ? (
                        <button className="btn-o" style={{ height: 32, padding: '0 14px', borderRadius: 16, fontSize: 14 }} onClick={() => qty(id, 1)}>{t.add}</button>
                      ) : (
                        <div className="stepper acc">
                          <button aria-label="−" onClick={() => qty(id, -1)}><Icon n="minus" size={14} sw={1.6} /></button>
                          <span>{q}</span>
                          <button aria-label="+" onClick={() => qty(id, 1)}><Icon n="plus" size={14} sw={1.6} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {screen === 'story' && (
          <div className="fade" style={{ padding: '22px 22px 30px' }}>
            <div style={{ textAlign: 'center', padding: '10px 0 22px' }}>
              <div className="h-serif tnum" style={{ fontWeight: 400, fontSize: 64, lineHeight: 1, color: 'var(--color-accent)' }}>1874</div>
              <div className="h-serif" style={{ fontStyle: 'italic', fontSize: 18, lineHeight: 1.35, marginTop: 6 }}>{t.storyLead}</div>
            </div>
            {CHAPTERS[lang].map(ch => (
              <section key={ch.num} style={{ borderTop: '1px solid var(--color-divider)', padding: '22px 0 8px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                  <span className="h-serif tnum" style={{ fontSize: 15, color: 'var(--color-accent-700)' }}>{ch.num}</span>
                  <span className="kicker" style={{ color: 'var(--lb-green-700)' }}>{ch.kicker}</span>
                </div>
                <h3 className="h-serif" style={{ fontWeight: 600, fontSize: 25, lineHeight: 1.12, margin: '0 0 12px' }}>{ch.title}</h3>
                {IMG.story[ch.num] && ch.img && (
                  <div className="plate" style={{ height: 190, position: 'relative', marginBottom: 14 }}><img className="imgslot" src={IMG.story[ch.num]} alt={ch.img} loading="lazy" /></div>
                )}
                <p style={{ margin: '0 0 12px', fontSize: 13.5, lineHeight: 1.65, textAlign: 'justify', hyphens: 'auto' }}>{ch.body}</p>
              </section>
            ))}
            <div style={{ border: '1px solid var(--color-accent)', padding: 18, textAlign: 'center', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
              <div className="h-serif" style={{ fontStyle: 'italic', fontSize: 18, lineHeight: 1.35 }}>{t.storyClose}</div>
              <button className="link" onClick={() => go('gallery')}>{t.storyGallery}</button>
            </div>
          </div>
        )}

        {screen === 'gallery' && (
          <div className="fade" style={{ padding: '18px 18px 30px', width: '100%' }}>
            <p className="h-serif" style={{ margin: '0 0 16px', fontStyle: 'italic', fontSize: 16, lineHeight: 1.4, color: 'var(--color-neutral-800)', textAlign: 'center' }}>{t.galleryIntro}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 }}>
              {GALLERY.map(g => (
                <figure key={g.id} style={{ margin: 0, minWidth: 0, gridColumn: g.span }}>
                  <div className="plate" style={{ position: 'relative', width: '100%', overflow: 'hidden', height: g.h }}>
                    <img className="imgslot" src={g.src} alt={g[lang]} loading="lazy" />
                  </div>
                  <figcaption className="h-serif" style={{ fontStyle: 'italic', fontSize: 13, marginTop: 6, color: 'var(--color-neutral-800)' }}>{g[lang]}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}

        {screen === 'services' && (
          <div className="fade" style={{ padding: '18px 20px 30px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p className="h-serif" style={{ margin: 0, fontStyle: 'italic', fontSize: 16, lineHeight: 1.4, color: 'var(--color-neutral-800)' }}>{t.servicesIntro}</p>
            {catalog.services.filter(x => x.active).sort((x, y) => x.sort - y.sort).map(sv => ({ id: sv.id, kicker: sv.kicker[lang], title: sv.title[lang], body: sv.body[lang], price: sv.price[lang], cta: sv.cta[lang] })).map(s => (
              <article key={s.id} style={{ border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                {IMG.svc[s.id] && <div style={{ position: 'relative', height: 150, borderBottom: '1px solid var(--color-divider)' }}><img className="imgslot" src={IMG.svc[s.id]} alt={s.title} loading="lazy" /></div>}
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="kicker" style={{ color: 'var(--lb-green-700)' }}>{s.kicker}</div>
                  <h3 className="h-serif" style={{ fontWeight: 600, fontSize: 21, lineHeight: 1.15, margin: 0 }}>{s.title}</h3>
                  <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: 'var(--color-neutral-800)', textAlign: 'justify', hyphens: 'auto' }}>{s.body}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <span className="tnum" style={{ fontSize: 12.5 }}>{s.price}</span>
                    <button className="btn-o sm" onClick={() => { setDialog(s.id); setSent(false) }}>{s.cta}</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {screen === 'profile' && (
          <div className="fade" style={{ padding: '20px 20px 30px', display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ border: '1px solid var(--color-accent)', padding: 5, borderRadius: 3, boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ border: '1px solid var(--color-divider)', padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div className="kicker">{t.cardKicker}</div>
                    <div className="h-serif" style={{ fontWeight: 400, fontSize: 28, lineHeight: 1.1, marginTop: 4 }}>{name || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-neutral-700)', marginTop: 2 }}>{t.memberSince}</div>
                  </div>
                  <div className="h-serif" style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--color-accent)', display: 'grid', placeItems: 'center', fontStyle: 'italic', fontSize: 18, color: 'var(--color-accent-700)' }}>LB</div>
                </div>
                <div className="rule" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, justifyItems: 'center' }}>
                  {Array.from({ length: 10 }, (_, i) => {
                    const on = i < p.stamps
                    return (
                      <div key={i} style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', border: `1px ${on ? 'solid' : 'dashed'} ${on ? 'var(--color-accent)' : 'var(--color-divider)'}`, color: on ? 'var(--color-accent-700)' : 'var(--color-neutral-400)', background: on ? 'var(--color-accent-100)' : 'transparent' }}>
                        <Icon n="cupS" sw={1.4} />
                      </div>
                    )
                  })}
                </div>
                <div className="h-serif" style={{ fontStyle: 'italic', fontSize: 15, textAlign: 'center', lineHeight: 1.35 }}>{t.stamps(p.stamps)}</div>
              </div>
            </div>
            <div>
              <h2 className="h-serif" style={{ fontWeight: 600, fontSize: 21, margin: '0 0 8px' }}>{t.pastOrders}</h2>
              {pastOrders.map((o, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderTop: '1px solid var(--color-divider)', fontSize: 12.5 }}>
                  <div><div className="h-serif" style={{ fontWeight: 600, fontSize: 16 }}>{o.title}</div><div style={{ color: 'var(--color-neutral-700)', fontSize: 11, marginTop: 2 }}>{o.meta}</div></div>
                  <div className="tnum" style={{ whiteSpace: 'nowrap', flex: 'none' }}>{o.total}</div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13 }}>{t.language}</span>
              <LangSeg labels={['Italiano', 'English']} big />
            </div>
            <button className="link" style={{ color: 'var(--color-neutral-700)', fontSize: 12, alignSelf: 'center' }} onClick={() => { ss.del('lb:entered'); setScreen('invite') }}>{t.leave}</button>
          </div>
        )}

        {screen === 'cart' && (
          <div className="fade" style={{ padding: '18px 20px 24px', display: 'flex', flexDirection: 'column', gap: 16, minHeight: '100%' }}>
            {count === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 12, padding: '60px 10px' }}>
                <div className="h-serif" style={{ fontStyle: 'italic', fontSize: 22, lineHeight: 1.3 }}>{t.cartEmpty}</div>
                <button className="btn-o sm" style={{ height: 44, padding: '0 20px', fontSize: 16 }} onClick={() => go('menu')}>{t.seeMenu}</button>
              </div>
            ) : (
              <>
                <p className="h-serif" style={{ margin: 0, fontStyle: 'italic', fontSize: 16, lineHeight: 1.4, color: 'var(--color-neutral-800)' }}>{t.cartIntro}</p>
                <div>
                  {cartIds.map(id => {
                    const q = p.cart[id]
                    const m = loc(id)
                    return (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderTop: '1px solid var(--color-divider)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="h-serif" style={{ fontWeight: 600, fontSize: 17 }}>{m.name}</div>
                          <div className="tnum" style={{ fontSize: 11, color: 'var(--color-neutral-700)' }}>{m.price}</div>
                        </div>
                        <div className="stepper">
                          <button aria-label="−" onClick={() => qty(id, -1)}><Icon n="minus" size={13} sw={1.6} /></button>
                          <span>{q}</span>
                          <button aria-label="+" onClick={() => qty(id, 1)}><Icon n="plus" size={13} sw={1.6} /></button>
                        </div>
                        <div className="tnum" style={{ width: 64, textAlign: 'right', fontSize: 13 }}>{eur(priceOf(id) * q, lang)}</div>
                      </div>
                    )
                  })}
                </div>
                <div className="tnum" style={{ borderTop: '1px solid var(--color-text)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-neutral-700)' }}><span>{t.packaging}</span><span>{t.free}</span></div>
                  <div className="h-serif" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 21 }}><span>{t.total}</span><span>{eur(total, lang)}</span></div>
                </div>
                <div style={{ flex: 1 }} />
                <button className="btn-o" onClick={() => go('checkout')}>{t.toCheckout}</button>
              </>
            )}
          </div>
        )}

        {screen === 'checkout' && (
          <div className="fade" style={{ padding: '18px 20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div className="kicker" style={{ marginBottom: 10 }}>{t.pickupTime}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {SLOTS.map((l, i) => (
                  <button key={l} className="choice tnum" aria-pressed={i === slot} onClick={() => setSlot(i)} style={{ height: 42, fontSize: 13 }}>{l}</button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-neutral-700)', marginTop: 8 }}>{t.pickupWhere}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="who" className="kicker">{t.nameLabel}</label>
              <input id="who" value={p.name} autoComplete="given-name" onChange={e => { patch({ name: e.target.value }); setNameTouched(true) }} placeholder={t.namePh}
                style={{ height: 46, padding: '0 12px', font: 'inherit', fontSize: 16, background: 'transparent', color: 'var(--color-text)', border: `1px solid ${nameTouched && !name ? 'var(--color-accent-700)' : 'var(--color-divider)'}`, borderRadius: 'var(--radius-md)', outline: 'none', caretColor: 'var(--color-accent)' }} />
              {nameTouched && !name && <span role="alert" style={{ fontSize: 11, color: 'var(--color-accent-800)', fontStyle: 'italic' }}>{t.nameError}</span>}
            </div>
            <div>
              <div className="kicker" style={{ marginBottom: 10 }}>{t.payment}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 2px', borderTop: '1px solid var(--color-divider)' }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', flex: 'none', border: '1.5px solid var(--color-accent)', boxShadow: 'inset 0 0 0 4px var(--color-bg)', background: 'var(--color-accent)' }} />
                <span style={{ flex: 1, fontSize: 13.5 }}>{t.payStore}</span>
                <span style={{ fontSize: 11, color: 'var(--color-neutral-700)' }}>{t.payStoreSub}</span>
              </div>
            </div>
            <div className="h-serif tnum" style={{ borderTop: '1px solid var(--color-text)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 21 }}><span>{t.total}</span><span>{eur(total, lang)}</span></div>
            {orderErr && <span role="alert" style={{ fontSize: 12, color: 'var(--color-accent-800)', fontStyle: 'italic' }}>{orderErr}</span>}
            <button className="btn-o" onClick={placeOrder} disabled={count === 0 || placing} style={count === 0 || placing ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}>{placing ? '…' : t.placeOrder}</button>
          </div>
        )}

        {screen === 'done' && (
          <div className="fade" style={{ minHeight: '100%', padding: '30px 26px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22, textAlign: 'center' }}>
            <div style={{ width: 78, height: 78, borderRadius: '50%', border: '1px solid var(--color-accent)', alignSelf: 'center', display: 'grid', placeItems: 'center', color: 'var(--color-accent-700)' }}><Icon n="check" size={30} sw={1.3} /></div>
            <div>
              <div className="kicker tnum">{t.orderNo} {String(p.lastOrder?.number ?? live?.number ?? 0).padStart(3, '0')}</div>
              <div className="h-serif" style={{ fontWeight: 400, fontSize: 34, lineHeight: 1.1, marginTop: 8 }}>{t.doneTitle}</div>
            </div>
            <p className="h-serif" style={{ margin: 0, fontStyle: 'italic', fontSize: 18, lineHeight: 1.4 }}>{t.done(name, last.slot)}</p>
            <StatusSteps t={t} status={live?.status ?? 'new'} />
            <div style={{ borderTop: '1px solid var(--color-divider)', borderBottom: '1px solid var(--color-divider)', padding: '12px 0', fontSize: 12.5, color: 'var(--color-neutral-800)' }}>{t.doneStamp}</div>
            <button className="btn-o" style={{ height: 50, fontSize: 17 }} onClick={() => go('home')}>{t.backHome}</button>
          </div>
        )}
      </main>

      {showTabs && (
        <nav className="tabbar" aria-label="Navigation">
          {([['home', 'home', t.tabHome], ['menu', 'cup', t.tabMenu], ['story', 'book', t.tabStory], ['gallery', 'image', t.tabGallery], ['services', 'cal', t.tabServices]] as const).map(([id, ic, label]) => (
            <button key={id} aria-current={screen === id ? 'page' : undefined} onClick={() => go(id)}><Icon n={ic} size={22} sw={1.4} />{label}</button>
          ))}
        </nav>
      )}

      {dialog && (() => {
        const svc = catalog.services.find(x => x.id === dialog)
        if (!svc) return null
        const svcTitle = svc.title[lang]
        const today = new Date()
        return (
          <div onClick={() => setDialog(null)} style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'color-mix(in srgb, var(--color-neutral-900) 45%, transparent)', display: 'flex', alignItems: 'flex-end' }}>
            <div role="dialog" aria-modal="true" aria-label={svcTitle} onClick={e => e.stopPropagation()} className="fade" style={{ width: '100%', background: 'var(--color-bg)', borderRadius: '22px 22px 0 0', padding: '22px 22px 28px', display: 'flex', flexDirection: 'column', gap: 16, boxShadow: 'var(--shadow-lg)' }}>
              {sent ? (
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, padding: '10px 0' }}>
                  <div className="kicker">{t.sentKicker}</div>
                  <div className="h-serif" style={{ fontStyle: 'italic', fontSize: 20, lineHeight: 1.35 }}>{t.sentBody}</div>
                  <button className="btn-o sm" style={{ height: 46, fontSize: 16, marginTop: 6 }} onClick={() => setDialog(null)}>{t.close}</button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <div className="kicker">{t.requestKicker}</div>
                      <div className="h-serif" style={{ fontWeight: 600, fontSize: 23, lineHeight: 1.15, marginTop: 4 }}>{svcTitle}</div>
                    </div>
                    <button className="circ" style={{ width: 36, height: 36 }} aria-label={t.close} onClick={() => setDialog(null)}><Icon n="close" size={15} /></button>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--color-neutral-700)', marginBottom: 8 }}>{t.day}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                      {[0, 1, 2, 3].map(i => {
                        const d = new Date(today); d.setDate(d.getDate() + i)
                        return (
                          <button key={i} className="choice" aria-pressed={i === day} onClick={() => setDay(i)} style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em' }}>{i === 0 ? t.dows[0] : d.toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', { weekday: 'short' })}</span>
                            <span className="h-serif tnum" style={{ fontSize: 21, fontWeight: 600 }}>{d.getDate()}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{t.guests}</span>
                    <div className="stepper" style={{ height: 36, borderRadius: 18 }}>
                      <button style={{ width: 38, height: 34 }} aria-label="−" onClick={() => setGuests(g => Math.max(1, g - 1))}><Icon n="minus" size={14} sw={1.6} /></button>
                      <span style={{ minWidth: 22, fontSize: 14 }}>{guests}</span>
                      <button style={{ width: 38, height: 34 }} aria-label="+" onClick={() => setGuests(g => Math.min(24, g + 1))}><Icon n="plus" size={14} sw={1.6} /></button>
                    </div>
                  </div>
                  <button className="btn-o" style={{ height: 50, fontSize: 17 }} onClick={() => setSent(true)}>{t.sendRequest}</button>
                </>
              )}
            </div>
          </div>
        )
      })()}

      {toast && (
        <div role="status" className="fade" style={{ position: 'absolute', left: 20, right: 20, bottom: 100, zIndex: 15, background: 'var(--lb-green-900)', color: 'var(--color-bg)', borderRadius: 'var(--radius-md)', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: 12.5, boxShadow: 'var(--shadow-md)' }}>
          <span>{toast}</span>
          <button className="link" style={{ color: 'var(--color-accent-300)' }} onClick={() => go('cart')}>{t.viewCart}</button>
        </div>
      )}
    </div>
  )
}

const tile = (border: string): CSSProperties => ({ textAlign: 'left', padding: '16px 14px', border: `1px solid ${border}`, background: 'transparent', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--color-text)', display: 'flex', flexDirection: 'column', gap: 6 })

function Invite({ t, onEnter, seg }: { t: (typeof TX)['it']; onEnter: () => void; seg: ReactNode }) {
  return (
    <div className="fade" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', padding: '16px 26px 34px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{seg}</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ border: '1px solid var(--color-accent)', padding: 6, borderRadius: 2 }}>
          <div style={{ border: '1px solid var(--lb-green)', padding: '34px 24px 30px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div className="h-serif" style={{ width: 62, height: 62, borderRadius: '50%', border: '1px solid var(--color-accent)', display: 'grid', placeItems: 'center', fontStyle: 'italic', fontSize: 26, color: 'var(--color-accent-700)' }}>LB</div>
            <div className="kicker" style={{ fontSize: 10, letterSpacing: '.2em' }}>{t.inviteKicker}</div>
            <div className="h-serif" style={{ fontStyle: 'italic', fontSize: 19, lineHeight: 1.35, color: 'var(--color-neutral-800)', textWrap: 'pretty' as CSSProperties['textWrap'] }}>{t.inviteLine1}</div>
            <h1 className="h-serif" style={{ fontWeight: 400, fontSize: 40, lineHeight: 1, margin: 0 }}>Lady Bedford’s</h1>
            <div className="h-serif" style={{ fontStyle: 'italic', fontSize: 19, lineHeight: 1.35, color: 'var(--color-neutral-800)', textWrap: 'pretty' as CSSProperties['textWrap'] }}>{t.inviteLine2}</div>
            <div style={{ width: 40, height: 1, background: 'var(--color-accent)' }} />
            <div className="tnum" style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--color-neutral-700)' }}>{t.inviteAddress}</div>
          </div>
        </div>
        <p style={{ margin: '18px 4px 0', fontSize: 11, textAlign: 'center', color: 'var(--color-neutral-700)', fontStyle: 'italic' }}>{t.inviteRsvp}</p>
      </div>
      <button className="btn-o" onClick={onEnter}>{t.inviteCta}</button>
    </div>
  )
}

function StatusSteps({ t, status }: { t: (typeof TX)['it']; status: string }) {
  if (status === 'cancelled') return <p className="h-serif" style={{ margin: 0, fontStyle: 'italic', fontSize: 17, color: 'var(--color-accent-800)' }}>{t.statusCancelled}</p>
  const steps = ['new', 'preparing', 'ready'] as const
  const idx = status === 'completed' ? 3 : steps.indexOf(status as (typeof steps)[number])
  return (
    <ol aria-label={t.yourOrder} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
      {steps.map((s, i) => {
        const on = i <= idx, cur = i === idx
        return (
          <li key={s} aria-current={cur ? 'step' : undefined} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', border: `1px solid ${on ? 'var(--lb-green)' : 'var(--color-divider)'}`, background: on ? 'var(--lb-green-100)' : 'transparent', color: on ? 'var(--lb-green-700)' : 'var(--color-neutral-500)' }}>
              {on && !cur || status === 'completed' ? <Icon n="check" size={15} sw={1.6} /> : <span className="tnum" style={{ fontSize: 13 }}>{i + 1}</span>}
            </span>
            <span style={{ fontSize: 11, color: on ? 'var(--color-text)' : 'var(--color-neutral-600)', fontWeight: cur ? 600 : 400 }}>{t.statusLabel[s]}</span>
          </li>
        )
      })}
    </ol>
  )
}
