import { useMemo } from 'react'
import { bush, f1, frond, rng } from './botanic'

/* Il murale del locale, ridisegnato in vettoriale: finestra ad arco, glicine fiorito, palme, zoccolo verde e piastrelle a rombi.
   Pesa pochi KB e si adatta a qualsiasi schermo (viewBox verticale, ancorato in basso). */
const W = 390, H = 844
const FLOOR = 716

function blossoms(seed: number, cx: number, cy: number, sx: number, sy: number, n: number) {
  const r = rng(seed), out: JSX.Element[] = []
  const cols = ['#e3d8bb', '#d3c29a', '#c4b186', '#8e5c6c', '#74505b', '#5e5a3a', '#7a7348']
  const leaf = ['#4a3c26', '#5c4b2c', '#3b3620', '#2f3a24']
  for (let i = 0; i < n; i++) {
    const x = cx + (r() - 0.5) * 2 * sx, y = cy + (r() - 0.5) * 2 * sy
    if (r() < 0.38) out.push(<ellipse key={'l' + i} cx={f1(x)} cy={f1(y)} rx={f1(6 + r() * 9)} ry={f1(2.6 + r() * 3)} transform={`rotate(${f1(r() * 180)} ${f1(x)} ${f1(y)})`} fill={leaf[Math.floor(r() * leaf.length)]} opacity=".85" />)
    else out.push(<circle key={'b' + i} cx={f1(x)} cy={f1(y)} r={f1(2.4 + r() * 5.4)} fill={cols[Math.floor(r() * cols.length)]} opacity={f1(0.55 + r() * 0.4)} />)
  }
  return out
}

export default function Mural() {
  const g = useMemo(() => ({
    vineBack: blossoms(3, 34, 200, 46, 210, 150),
    vineFront: blossoms(8, 40, 230, 34, 170, 80),
    garden: blossoms(21, 200, 400, 70, 120, 26),
    palmA: frond(41, [388, -20], [330, 20], [270, 100], [232, 250], 22, 118, '#17372b', 'pa'),
    palmB: frond(52, [392, 120], [330, 150], [280, 230], [262, 380], 20, 104, '#1e4637', 'pb'),
    palmC: frond(63, [394, 330], [350, 350], [316, 410], [304, 520], 15, 74, '#28604a', 'pc'),
    bushL: bush(7, [24, 724], 13, 150, 58, ['#11291f', '#173627', '#1d4231'], 'bl'),
    bushR: bush(19, [374, 726], 9, 110, 60, ['#11291f', '#173627'], 'br'),
  }), [])
  const ribs = [-150, -120, -90, -60, -30].map(a => { const t = a * Math.PI / 180; return [195 + Math.cos(t) * 135, 250 + Math.sin(t) * 135] })
  return (
    <svg className="mural" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden focusable="false">
      <defs>
        <linearGradient id="mu-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b3629" /><stop offset=".55" stopColor="#554a38" /><stop offset="1" stopColor="#3a3326" /></linearGradient>
        <radialGradient id="mu-glow" cx=".5" cy=".5" r=".6"><stop offset="0" stopColor="#f0dfb8" stopOpacity=".75" /><stop offset=".6" stopColor="#b9a47a" stopOpacity=".28" /><stop offset="1" stopColor="#b9a47a" stopOpacity="0" /></radialGradient>
        <linearGradient id="mu-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e2c9a1" stopOpacity=".55" /><stop offset="1" stopColor="#4a3c2a" stopOpacity=".95" /></linearGradient>
        <pattern id="mu-tile" width="64" height="32" patternUnits="userSpaceOnUse">
          <rect width="64" height="32" fill="#d9c19a" />
          <g fill="none" stroke="#5a4a36" strokeWidth="2.2"><path d="M32 2 62 16 32 30 2 16Z" /><path d="M32 9 50 16 32 23 14 16Z" /></g>
          <path d="M32 14 36 16 32 18 28 16Z" fill="#5a4a36" />
          <path d="M-0 0 12 0 0 6ZM64 0 52 0 64 6ZM0 32 12 32 0 26ZM64 32 52 32 64 26Z" fill="#5a4a36" opacity=".75" />
        </pattern>
        <filter id="mu-b2"><feGaussianBlur stdDeviation="2" /></filter>
        <filter id="mu-b6"><feGaussianBlur stdDeviation="6" /></filter>
        <filter id="mu-b12"><feGaussianBlur stdDeviation="12" /></filter>
        <clipPath id="mu-arch"><path d="M60 640V250A135 135 0 0 1 330 250V640Z" /></clipPath>
      </defs>

      <rect width={W} height={H} fill="url(#mu-wall)" />

      {/* finestra ad arco: giardino luminoso, vetri, montanti */}
      <g transform="translate(0,-84)">
      <g clipPath="url(#mu-arch)">
        <rect x="60" y="100" width="270" height="560" fill="#8a8566" opacity=".6" />
        <ellipse cx="195" cy="430" rx="190" ry="250" fill="url(#mu-glow)" />
        <g filter="url(#mu-b6)" opacity=".7">{g.garden}</g>
        <ellipse cx="150" cy="560" rx="70" ry="48" fill="#3f4a38" opacity=".45" filter="url(#mu-b12)" />
      </g>
      <g stroke="#14170f" strokeWidth="3" fill="none" opacity=".85">
        <path d="M60 640V250A135 135 0 0 1 330 250V640" strokeWidth="5" />
        <path d="M195 115V640M128 250V640M262 250V640" />
        <path d="M60 340H330M60 430H330M60 520H330M60 250H330" />
        {ribs.map((p, i) => <path key={i} d={`M195 250 L${f1(p[0])} ${f1(p[1])}`} />)}
      </g>

      </g>
      {/* luce del sole sul muro, con l'ombra dei montanti */}
      <g filter="url(#mu-b6)" transform="translate(0,-84)"><path d="M140 650 222 440 292 430 232 668Z" fill="#f6e2b0" opacity=".62" /></g>
      <g stroke="#2a2418" strokeWidth="2.4" opacity=".5" transform="translate(0,-84)"><path d="M156 600 280 548M170 548 292 498M186 498 296 460" /></g>

      {/* glicine fiorito a sinistra */}
      <g filter="url(#mu-b2)" opacity=".9">{g.vineBack}</g>
      <g>{g.vineFront}</g>

      {/* palme a destra */}
      <g filter="url(#mu-b2)">{g.palmA}</g>
      <g>{g.palmB}</g>
      <g opacity=".95">{g.palmC}</g>

      {/* zoccolo verde e pavimento */}
      <rect x="0" y={FLOOR - 24} width={W} height="24" fill="#1d4a3c" />
      <rect x="0" y={FLOOR - 24} width={W} height="3" fill="#2d6a56" opacity=".8" />
      <rect x="0" y={FLOOR} width={W} height={H - FLOOR} fill="url(#mu-tile)" />
      <rect x="0" y={FLOOR} width={W} height={H - FLOOR} fill="url(#mu-floor)" />
      <path d={`M120 ${FLOOR} 250 ${FLOOR} 300 ${H} 70 ${H}Z`} fill="#f6e2b0" opacity=".16" filter="url(#mu-b12)" />

      {/* piante in primo piano */}
      <g filter="url(#mu-b2)">{g.bushL}</g>
      <g>{g.bushR}</g>

      <rect width={W} height={H} fill="#0e1a14" opacity=".1" />
    </svg>
  )
}
