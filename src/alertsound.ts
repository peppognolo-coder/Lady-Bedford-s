/** Motore dei suoni di avviso (senza React): usato dal personale e dall'app cliente. */
export type AlertKind = 'order' | 'ready' | 'booking' | 'stock'

let ctx: AudioContext | null = null
let hooked = false

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

/** I browser permettono l'audio solo dopo un tocco: sblocca al primo gesto. */
export function unlockOnGesture(onUnlocked?: () => void) {
  if (hooked || typeof window === 'undefined') return
  hooked = true
  const go = () => {
    const c = context()
    if (c) void c.resume().then(() => onUnlocked?.()).catch(() => undefined)
    window.removeEventListener('pointerdown', go); window.removeEventListener('keydown', go)
  }
  window.addEventListener('pointerdown', go); window.addEventListener('keydown', go)
}

/** Sequenza di note [frequenza Hz, inizio s, durata s] per tipo di avviso. */
const TUNES: Record<AlertKind, [number, number, number][]> = {
  order: [[660, 0, 0.2], [880, 0.22, 0.2]],                                // nuovo ordine in cucina/cassa
  ready: [[784, 0, 0.16], [988, 0.18, 0.16], [1175, 0.36, 0.3]],           // ordine pronto da servire
  booking: [[523, 0, 0.22], [659, 0.24, 0.22], [523, 0.5, 0.3]],           // nuova prenotazione
  stock: [[440, 0, 0.25], [330, 0.28, 0.35]],                              // scorta sotto soglia
}
const VIBRATION: Record<AlertKind, number[]> = { order: [200, 80, 200], ready: [120, 60, 120, 60, 300], booking: [150, 80, 150], stock: [400] }

export function playTune(kind: AlertKind, volume = 0.7): boolean {
  const c = context()
  if (!c || c.state === 'closed') return false
  void c.resume().catch(() => undefined)
  const peak = Math.max(0.02, Math.min(1, volume)) * 0.35
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
