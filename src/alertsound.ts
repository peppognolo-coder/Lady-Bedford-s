/** Motore dei suoni di avviso (senza React): usato dal personale e dall'app cliente. */
export type AlertKind = 'order' | 'ready' | 'booking' | 'stock' | 'late'

let ctx: AudioContext | null = null
let hooked = false

/** Su iPhone/iPad il tasto del silenzioso spegne il Web Audio ma non un normale elemento audio: usiamo quello. */
function playbackSession() {
  try { const s = (navigator as unknown as { audioSession?: { type: string } }).audioSession; if (s) s.type = 'playback' } catch { /* non supportato */ }
}

function context(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
    }
    return ctx
  } catch { return null }
}

/** Sequenza di note [frequenza Hz, inizio s, durata s] per tipo di avviso. */
const TUNES: Record<AlertKind, [number, number, number][]> = {
  order: [[660, 0, 0.2], [880, 0.22, 0.2], [660, 0.55, 0.2], [880, 0.77, 0.3]],   // nuovo ordine in cucina/cassa
  ready: [[784, 0, 0.16], [988, 0.18, 0.16], [1175, 0.36, 0.3]],           // ordine pronto da servire
  booking: [[523, 0, 0.22], [659, 0.24, 0.22], [523, 0.5, 0.3]],           // nuova prenotazione
  stock: [[440, 0, 0.25], [330, 0.28, 0.35]],                              // scorta sotto soglia
  late: [[880, 0, 0.12], [880, 0.18, 0.12], [880, 0.36, 0.12], [1319, 0.56, 0.35]],   // ordine in ritardo sul ritiro
}
const VIBRATION: Record<AlertKind, number[]> = { order: [300, 100, 300, 100, 300], ready: [120, 60, 120, 60, 300], booking: [150, 80, 150], stock: [400], late: [150, 60, 150, 60, 150, 60, 400] }

/** Costruisce un file WAV (onda sinusoidale con un'armonica, più udibile dagli altoparlanti dei telefoni). */
function makeWav(kind: AlertKind | 'silence'): string {
  const SR = 22050
  const notes = kind === 'silence' ? [] : TUNES[kind]
  const total = kind === 'silence' ? 0.1 : Math.max(...notes.map(([, at, len]) => at + len)) + 0.1
  const n = Math.ceil(total * SR), pcm = new Int16Array(n)
  for (const [f, at, len] of notes) {
    const i0 = Math.floor(at * SR), cnt = Math.floor(len * SR)
    for (let i = 0; i < cnt && i0 + i < n; i++) {
      const t = i / SR, env = Math.min(1, t / 0.02) * Math.exp(-3.2 * (t / len))
      const v = (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(4 * Math.PI * f * t)) * env * 0.72
      pcm[i0 + i] = Math.max(-32767, Math.min(32767, Math.round((pcm[i0 + i] / 32767 + v) * 32767)))
    }
  }
  const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf)
  const str = (o: number, t: string) => { for (let i = 0; i < t.length; i++) dv.setUint8(o + i, t.charCodeAt(i)) }
  str(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt '); dv.setUint32(16, 16, true)
  dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, SR, true); dv.setUint32(28, SR * 2, true)
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, pcm[i], true)
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
}
const urls: Partial<Record<AlertKind | 'silence', string>> = {}
const urlOf = (k: AlertKind | 'silence') => (urls[k] ??= makeWav(k))

let el: HTMLAudioElement | null = null
const player = () => { if (!el && typeof Audio !== 'undefined') { el = new Audio(); el.preload = 'auto'; el.setAttribute('playsinline', '') } return el }

/** I browser permettono l'audio solo dopo un tocco: sblocca al primo gesto. */
export function unlockOnGesture(onUnlocked?: () => void) {
  if (hooked || typeof window === 'undefined') return
  hooked = true
  const go = () => {
    playbackSession()
    const c = context()
    if (c) void c.resume().catch(() => undefined)
    const p = player()
    if (p) { p.src = urlOf('silence'); p.volume = 0.01; void p.play().then(() => onUnlocked?.()).catch(() => onUnlocked?.()) } else onUnlocked?.()
    window.removeEventListener('pointerdown', go); window.removeEventListener('keydown', go); window.removeEventListener('touchend', go)
  }
  window.addEventListener('pointerdown', go); window.addEventListener('keydown', go); window.addEventListener('touchend', go)
}

/** Piano B: oscillatori Web Audio (se l'elemento audio viene rifiutato). */
function playWebAudio(kind: AlertKind, volume: number) {
  const c = context()
  if (!c || c.state === 'closed') return false
  void c.resume().catch(() => undefined)
  const peak = Math.max(0.02, Math.min(1, volume)) * 0.5
  for (const [f, at, len] of TUNES[kind]) {
    const o = c.createOscillator(), g = c.createGain()
    o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(c.destination)
    const t0 = c.currentTime + at
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len)
    o.start(t0); o.stop(t0 + len + 0.02)
  }
  return c.state === 'running'
}

export function playTune(kind: AlertKind, volume = 0.7): boolean {
  playbackSession()
  const p = player()
  const vol = Math.max(0.05, Math.min(1, volume))
  if (!p) return playWebAudio(kind, vol)
  try {
    p.pause(); p.src = urlOf(kind); p.volume = vol; p.currentTime = 0
    const r = p.play()
    if (r) r.catch(() => { playWebAudio(kind, vol) })
    return true
  } catch { return playWebAudio(kind, vol) }
}

export function vibrate(kind: AlertKind) {
  try { navigator.vibrate?.(VIBRATION[kind]) } catch { /* non supportato */ }
}

/** Mostra un pallino nel titolo della scheda finché la pagina non torna in primo piano. */
let baseTitle: string | null = null
export function flagTitle() {
  if (typeof document === 'undefined' || document.visibilityState === 'visible') return
  if (baseTitle === null) {
    baseTitle = document.title
    document.title = '● ' + baseTitle
    const clear = () => {
      if (document.visibilityState !== 'visible') return
      document.title = baseTitle ?? document.title; baseTitle = null
      document.removeEventListener('visibilitychange', clear)
    }
    document.addEventListener('visibilitychange', clear)
  }
}

/** Notifica di sistema (solo se concessa dall'utente e la pagina non è in primo piano). */
export async function systemNotify(title: string, body: string, tag: string) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || document.visibilityState === 'visible') return
    const reg = await navigator.serviceWorker?.getRegistration?.()
    if (reg) await reg.showNotification(title, { body, tag, icon: './icons/192.png', badge: './icons/192.png' } as NotificationOptions)
    else new Notification(title, { body, tag })
  } catch { /* ignora */ }
}
