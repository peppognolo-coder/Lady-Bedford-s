import type { ReactNode } from 'react'

/* vegetazione dell'invito: foglie piene generate con un seme fisso, nessuna immagine da scaricare */
export function rng(seed: number) { let a = seed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
export type Pt = [number, number]
export const f1 = (n: number) => n.toFixed(1)

/* fronda di palma: nervatura ad arco, foglioline che pendono */
export function frond(seed: number, o: Pt, c1: Pt, c2: Pt, e: Pt, n: number, maxLen: number, fill: string, key: string) {
  const r = rng(seed), out: ReactNode[] = []
  const at = (u: number): Pt => { const m = 1 - u; return [m ** 3 * o[0] + 3 * m * m * u * c1[0] + 3 * m * u * u * c2[0] + u ** 3 * e[0], m ** 3 * o[1] + 3 * m * m * u * c1[1] + 3 * m * u * u * c2[1] + u ** 3 * e[1]] }
  out.push(<path key={key + 'r'} d={`M${f1(o[0])} ${f1(o[1])} C${f1(c1[0])} ${f1(c1[1])} ${f1(c2[0])} ${f1(c2[1])} ${f1(e[0])} ${f1(e[1])}`} fill="none" stroke={fill} strokeWidth="2.4" strokeLinecap="round" />)
  for (let k = 1; k <= n; k++) {
    const u = 0.1 + 0.88 * (k / n), p = at(u), q = at(Math.min(1, u + 0.02))
    const ang = Math.atan2(q[1] - p[1], q[0] - p[0])
    const len = maxLen * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, 0.15 + 0.85 * u))) * (0.85 + 0.3 * r())
    for (const side of [-1, 1]) {
      const a = ang + side * ((0.95 - 0.3 * u) + (r() - 0.5) * 0.18)
      const dx = Math.cos(a) * len, dy = Math.sin(a) * len + len * 0.28   // gravità: la fogliolina scende
      const mx = p[0] + dx * 0.5, my = p[1] + dy * 0.5, w = len * 0.1
      const nx = -dy / len * w, ny = dx / len * w
      out.push(<path key={`${key}${k}${side}`} d={`M${f1(p[0])} ${f1(p[1])} Q${f1(mx + nx)} ${f1(my + ny)} ${f1(p[0] + dx)} ${f1(p[1] + dy)} Q${f1(mx - nx)} ${f1(my - ny)} ${f1(p[0])} ${f1(p[1])}Z`} fill={fill} opacity={0.82 + 0.18 * r()} />)
    }
  }
  return out
}

/* foglie larghe tipo ficus / aspidistra, a ciuffo */
export function bush(seed: number, base: Pt, n: number, size: number, spread: number, fills: string[], key: string) {
  const r = rng(seed), out: ReactNode[] = []
  for (let k = 0; k < n; k++) {
    const a = (-90 + (r() - 0.5) * 2 * spread) * Math.PI / 180, len = size * (0.55 + 0.45 * r()), w = len * (0.26 + 0.1 * r())
    const tx = base[0] + Math.cos(a) * len, ty = base[1] + Math.sin(a) * len + len * 0.12
    const nx = -Math.sin(a) * w, ny = Math.cos(a) * w
    const m1: Pt = [base[0] + (tx - base[0]) * 0.35, base[1] + (ty - base[1]) * 0.35], m2: Pt = [base[0] + (tx - base[0]) * 0.75, base[1] + (ty - base[1]) * 0.75]
    const fill = fills[Math.floor(r() * fills.length)]
    out.push(
      <g key={key + k}>
        <path d={`M${f1(base[0])} ${f1(base[1])} C${f1(m1[0] + nx)} ${f1(m1[1] + ny)} ${f1(m2[0] + nx * 0.8)} ${f1(m2[1] + ny * 0.8)} ${f1(tx)} ${f1(ty)} C${f1(m2[0] - nx * 0.8)} ${f1(m2[1] - ny * 0.8)} ${f1(m1[0] - nx)} ${f1(m1[1] - ny)} ${f1(base[0])} ${f1(base[1])}Z`} fill={fill} />
        <path d={`M${f1(base[0])} ${f1(base[1])} L${f1(tx)} ${f1(ty)}`} stroke="#8fb39a" strokeOpacity=".22" strokeWidth=".8" fill="none" />
      </g>
    )
  }
  return out
}

