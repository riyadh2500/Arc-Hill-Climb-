import { useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { BikeArt } from '@/components/BikeArt'
import { BIKES } from '@/game/bikes'
import { enterFullscreen } from '@/lib/fullscreen'
import { MAPS, terrainFor, type MapDef } from '@/game/maps'
import { glass } from '@/lib/hillclimb'

const W = 1200
const H = 400

const h = (i: number) => {
  const v = Math.sin(i * 127.1 + 17.3) * 43758.5453
  return v - Math.floor(v)
}

const cyclesFor = (f: number) => Math.max(1, Math.round((f * 3000) / (2 * Math.PI)))

/** Height of a seamless hill line at x: integer cycles per tile, so the loop never jumps. */
function hillY(m: MapDef, x: number, base: number, amp: number, phase: number): number {
  const u = (2 * Math.PI * x) / W
  return (
    base -
    amp *
      (Math.sin(cyclesFor(m.f1) * u + phase) + m.a2 * Math.sin(cyclesFor(m.f2) * u + m.p2 + phase) + m.a3 * Math.sin(cyclesFor(m.f3) * u + m.p3 + phase)) *
      0.55
  )
}

function closeFill(pts: string[], tiles: number): string {
  return `${pts.join(' ')} L ${W * tiles} ${H} L 0 ${H} Z`
}

function hillPath(m: MapDef, base: number, amp: number, phase: number, tiles = 2, closed = true): string {
  const pts: string[] = []
  for (let x = 0; x <= W * tiles; x += 20) pts.push(`${x === 0 ? 'M' : 'L'} ${x} ${hillY(m, x, base, amp, phase).toFixed(1)}`)
  return closed ? closeFill(pts, tiles) : pts.join(' ')
}

/** Far horizon outline for this map, periodic over one tile. */
function farOutline(m: MapDef, tiles = 2): { fill: string; snow: string | null } {
  const pts: string[] = []
  const per = (n: number) => W / n
  for (let x = 0; x <= W * tiles; x += 10) {
    let y: number
    if (m.far === 'mesas') {
      const pw = per(6)
      const idx = Math.floor(x / pw)
      const u = (x - idx * pw) / pw
      const e = Math.min(1, Math.min(u, 1 - u) / 0.16)
      const sm = e * e * (3 - 2 * e)
      y = 300 - (30 + h((idx % 6) + 11) * 80) * Math.pow(sm, 0.55)
    } else if (m.far === 'peaks') {
      const pw = per(5)
      const idx = Math.floor(x / pw)
      const u = (x - idx * pw) / pw
      y = 290 - (80 + h((idx % 5) + 5) * 90) * Math.pow(1 - Math.abs(u * 2 - 1), 1.15)
    } else if (m.far === 'lunar') {
      const pw = per(6)
      const idx = Math.floor(x / pw)
      const u = (x - idx * pw) / pw
      y = 292 - (24 + h((idx % 6) + 9) * 52) * Math.pow(1 - Math.abs(u * 2 - 1), 0.8)
    } else {
      y = hillY(m, x, 250, 70, 0.6)
    }
    pts.push(`${x === 0 ? 'M' : 'L'} ${x} ${y.toFixed(1)}`)
  }
  return { fill: closeFill(pts, tiles), snow: m.far === 'peaks' ? closeFill(pts, tiles) : null }
}

/** Small trackside props that scroll with the ground. */
function PropSvg({ m, kind }: { m: MapDef; kind: number }) {
  if (m.id === 0) {
    if (kind === 0)
      return (
        <g>
          <rect x="-3" y="-12" width="6" height="12" fill="#7a5230" />
          <path d="M-22 -8 L0 -52 L22 -8 Z" fill="#2f7d3a" />
          <path d="M-16 -30 L0 -66 L16 -30 Z" fill="#4aa64f" />
        </g>
      )
    if (kind === 1)
      return (
        <g>
          <rect x="-3" y="-28" width="6" height="28" fill="#7a5230" />
          <circle cx="0" cy="-42" r="20" fill="#4aa64f" />
          <circle cx="-13" cy="-34" r="12" fill="#4aa64f" />
          <circle cx="13" cy="-34" r="12" fill="#3f9a4a" />
        </g>
      )
    return (
      <g>
        {[-9, 0, 9].map((x, i) => (
          <g key={x}>
            <path d={`M${x} 0 L${x} -16`} stroke="#3c8f45" strokeWidth="2" />
            <circle cx={x} cy="-18" r="4.5" fill={['#ff7aa8', '#ffd24a', '#fff'][i]} />
          </g>
        ))}
      </g>
    )
  }
  if (m.id === 1) {
    if (kind === 0)
      return (
        <g fill="#3f8a4d">
          <rect x="-5" y="-42" width="10" height="42" rx="5" />
          <rect x="-19" y="-30" width="8" height="18" rx="4" />
          <rect x="-19" y="-14" width="19" height="6" rx="3" />
          <rect x="11" y="-36" width="8" height="22" rx="4" />
        </g>
      )
    if (kind === 1)
      return (
        <g fill="none" strokeLinecap="round">
          <path d="M0 0 Q9 -26 4 -52" stroke="#8a5a30" strokeWidth="6" />
          {[-2, -1, 0, 1, 2].map((f) => (
            <path key={f} d={`M4 -52 Q${4 + f * 14} ${-62 + Math.abs(f) * 8} ${4 + f * 24} ${-44 + Math.abs(f) * 8}`} stroke="#3f9a55" strokeWidth="4" />
          ))}
        </g>
      )
    return <path d="M-22 0 L-14 -20 L4 -26 L22 -8 L24 0 Z" fill="#b98a5a" />
  }
  if (m.id === 2) {
    if (kind === 0)
      return (
        <g>
          <rect x="-3" y="-10" width="6" height="10" fill="#5b4030" />
          <path d="M-22 -6 L0 -44 L22 -6 Z" fill="#2f6b55" />
          <path d="M-15 -26 L0 -58 L15 -26 Z" fill="#3a7f66" />
          <path d="M-8 -46 L0 -64 L8 -46 Q0 -41 -8 -46 Z" fill="#fff" />
        </g>
      )
    if (kind === 1)
      return (
        <g fill="rgba(170,225,255,0.8)" stroke="#fff" strokeWidth="1.2">
          <path d="M-14 0 L-8 -28 L-2 0 Z" />
          <path d="M-4 0 L2 -42 L8 0 Z" />
          <path d="M6 0 L12 -24 L18 0 Z" />
        </g>
      )
    return (
      <g fill="#fff" stroke="rgba(18,45,69,0.25)" strokeWidth="1.2">
        <circle cy="-11" r="13" />
        <circle cy="-31" r="9.5" />
        <circle cy="-46" r="7" />
      </g>
    )
  }
  if (kind === 0) return <path d="M-18 0 L-12 -16 L2 -22 L16 -12 L20 0 Z" fill="#7d8498" />
  if (kind === 1)
    return (
      <g>
        <path d="M0 0 L0 -50 M-9 -38 L9 -38" stroke="#aeb6c8" strokeWidth="3" />
        <circle cy="-52" r="3.2" fill="#ff4d5e" style={{ animation: 'tw 1.1s ease-in-out infinite' }} />
      </g>
    )
  return (
    <g>
      <path d="M0 0 L0 -52" stroke="#d8dce8" strokeWidth="3" />
      <path d="M0 -50 Q10 -54 20 -50 L20 -38 Q10 -42 0 -38 Z" fill="#4f7cff" />
    </g>
  )
}

function Weather({ m }: { m: MapDef }) {
  const n = m.weather === 'snow' ? 34 : m.weather === 'petals' ? 16 : m.weather === 'sand' ? 22 : 30
  return (
    <g aria-hidden>
      {Array.from({ length: n }, (_, i) => {
        const x = h(i + 1) * W
        const y = h(i + 60) * H
        const dur = 3 + h(i + 120) * 5
        const delay = -h(i + 180) * dur
        if (m.weather === 'snow') {
          return (
            <g key={i} transform={`translate(${x} 0)`}>
              <circle cx={0} cy={0} r={1.5 + h(i + 240) * 2.4} fill="#fff" opacity={0.85} style={{ animation: `fall ${dur + 2}s linear ${delay}s infinite` }} />
            </g>
          )
        }
        if (m.weather === 'petals') {
          return <ellipse key={i} cx={x} cy={y} rx={6} ry={2.8} fill={i % 3 === 0 ? '#ffb8d0' : '#b0e28c'} opacity={0.85} style={{ animation: `wind-x ${dur + 4}s linear ${delay}s infinite` }} />
        }
        if (m.weather === 'sand') {
          return <rect key={i} x={x} y={y} width={40 + h(i + 300) * 50} height={2} rx={1} fill="#fff1cf" opacity={0.35} style={{ animation: `wind-x ${dur * 0.35 + 0.8}s linear ${delay}s infinite` }} />
        }
        return <circle key={i} cx={x} cy={y * 0.7} r={1 + h(i + 360) * 1.4} fill="#e0e8ff" style={{ animation: `tw ${1.5 + h(i + 400) * 2.5}s ease-in-out ${delay}s infinite` }} />
      })}
      {m.weather === 'stardust' && (
        <motion.line
          x1={W}
          y1={20}
          x2={W + 110}
          y2={-20}
          stroke="#fff"
          strokeWidth={2.5}
          strokeLinecap="round"
          initial={{ x: 0, y: 0, opacity: 0 }}
          animate={{ x: [-120, -700], y: [0, 260], opacity: [0, 1, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, repeatDelay: 3.6, ease: 'easeIn' }}
        />
      )}
    </g>
  )
}

function Aurora() {
  const wave = (y: number, ph: number) => {
    const pts: string[] = []
    for (let x = 0; x <= W * 2; x += 20) {
      const u = (2 * Math.PI * x) / W
      pts.push(`${x === 0 ? 'M' : 'L'} ${x} ${(y + Math.sin(2 * u + ph) * 16 + Math.sin(5 * u + ph) * 5).toFixed(1)}`)
    }
    return pts.join(' ')
  }
  const bands = [
    { y: 70, c: 'rgba(120,255,200,0.55)', ph: 0, d: 26 },
    { y: 112, c: 'rgba(140,160,255,0.5)', ph: 1.7, d: 34 },
    { y: 150, c: 'rgba(255,150,220,0.42)', ph: 3.1, d: 42 },
  ]
  return (
    <g style={{ filter: 'blur(7px)' }} aria-hidden>
      {bands.map((b) => (
        <g key={b.y} style={{ animation: `scroll-w ${b.d}s linear infinite` }}>
          <path d={wave(b.y, b.ph)} fill="none" stroke={b.c} strokeWidth={34} strokeLinecap="round" className="neon-pulse" />
        </g>
      ))}
    </g>
  )
}

function Earth() {
  return (
    <g aria-hidden>
      <defs>
        <clipPath id="earth-clip">
          <circle cx="190" cy="92" r="40" />
        </clipPath>
        <radialGradient id="earth-sea" cx="35%" cy="30%">
          <stop offset="0" stopColor="#8fd0ff" />
          <stop offset="1" stopColor="#2a62b8" />
        </radialGradient>
      </defs>
      <circle cx="190" cy="92" r="40" fill="url(#earth-sea)" />
      <g clipPath="url(#earth-clip)">
        <g style={{ animation: 'scroll-earth 24s linear infinite' }}>
          {[0, 1].map((t) => (
            <g key={t} transform={`translate(${t * 120} 0)`} fill="rgba(98,190,120,0.9)">
              <ellipse cx="160" cy="80" rx="16" ry="9" />
              <ellipse cx="196" cy="100" rx="13" ry="8" />
              <ellipse cx="226" cy="76" rx="14" ry="7" />
              <ellipse cx="180" cy="116" rx="10" ry="5" />
            </g>
          ))}
        </g>
        <circle cx="214" cy="100" r="40" fill="rgba(6,10,28,0.5)" />
      </g>
    </g>
  )
}

/** Big animated preview of a course: parallax hills, ambient weather, and your bike riding through. */
function Scene({ m, bikeId, riding }: { m: MapDef; bikeId: number; riding: boolean }) {
  const sky = m.day
  const far = farOutline(m)
  const mx = useMotionValue(0)
  const sxs = useSpring(mx, { stiffness: 80, damping: 18 })
  const layerX = useTransform(sxs, (v) => v * -14)
  const bikeShift = useTransform(sxs, (v) => v * 10)
  return (
    <div
      className="relative h-60 overflow-hidden rounded-3xl sm:h-80"
      style={{ boxShadow: '0 12px 36px rgba(18,45,69,0.18)', border: '1px solid rgba(255,255,255,0.7)' }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        mx.set(((e.clientX - r.left) / r.width - 0.5) * 2)
      }}
      onPointerLeave={() => mx.set(0)}
    >
      <motion.svg style={{ x: layerX }} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" className="absolute -inset-x-4 inset-y-0 h-full w-[calc(100%+2rem)]">
        <defs>
          <linearGradient id={`scene-sky-${m.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={sky.top} />
            <stop offset="0.65" stopColor={sky.mid} />
            <stop offset="1" stopColor={sky.bottom} />
          </linearGradient>
          <clipPath id={`snowclip-${m.id}`}>
            <rect x="0" y="0" width={W * 2} height="188" />
          </clipPath>
          <radialGradient id={`scene-sun-${m.id}`}>
            <stop offset="0" stopColor={sky.sun} stopOpacity="0.95" />
            <stop offset="1" stopColor={sky.sun} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill={`url(#scene-sky-${m.id})`} />
        <motion.circle
          cx={930}
          cy={105}
          r={95}
          fill={`url(#scene-sun-${m.id})`}
          animate={{ r: [95, 112, 95] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <circle cx={930} cy={105} r={30} fill={sky.sun} />

        {m.far === 'peaks' && <Aurora />}
        {m.far === 'lunar' && <Earth />}

        {m.clouds && (
          <g style={{ animation: 'scroll-w 70s linear infinite' }} opacity={0.75}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <ellipse key={i} cx={100 + i * 400} cy={60 + (i % 3) * 38} rx={70} ry={16} fill="#fff" />
            ))}
          </g>
        )}

        <g style={{ animation: 'scroll-w 44s linear infinite' }}>
          <path d={far.fill} fill={sky.far} />
          {far.snow && (
            <g clipPath={`url(#snowclip-${m.id})`}>
              <path d={far.snow} fill="rgba(255,255,255,0.92)" />
            </g>
          )}
        </g>
        <g style={{ animation: 'scroll-w 22s linear infinite' }}>
          <path d={hillPath(m, 300, 60, 2.1)} fill={sky.near} />
        </g>
        <g style={{ animation: 'scroll-w 8s linear infinite' }}>
          <path d={hillPath(m, 345, 34, 4)} fill={m.dirtTop} />
          {[0, 1].map((tile) =>
            Array.from({ length: 9 }, (_, k) => {
              const x = ((k + 0.5) * W) / 9 + (h(k + m.id * 13) - 0.5) * 60 + tile * W
              const kind = Math.floor(h(k * 7 + m.id * 5 + 2) * 3)
              if (h(k + m.id * 31) < 0.3) return null
              return (
                <g key={`${tile}-${k}`} transform={`translate(${x} ${hillY(m, x % W, 345, 34, 4) + 2}) scale(${0.9 + h(k + 50) * 0.5})`}>
                  <PropSvg m={m} kind={kind} />
                </g>
              )
            }),
          )}
          <path d={hillPath(m, 345, 34, 4, 2, false)} fill="none" stroke={m.grass} strokeWidth={14} strokeLinejoin="round" />
          <path d={hillPath(m, 345, 34, 4, 2, false)} fill="none" stroke={m.edge} strokeWidth={3.5} strokeLinejoin="round" />
        </g>
        <Weather m={m} />
      </motion.svg>

      {/* rider, bobbing along the track */}
      <motion.div className="absolute bottom-[14%] left-[16%] w-[34%] max-w-[260px]" style={{ x: bikeShift }}>
        <motion.div
          animate={
            riding
              ? { x: '420%', rotate: -10, transition: { duration: 0.55, ease: [0.5, 0, 0.9, 0.4] } }
              : { x: 0, y: [0, -7, 0, -3, 0], rotate: [0, -2.5, 0, 1.5, 0] }
          }
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <BikeArt bikeId={bikeId} spin className="w-full drop-shadow-[0_10px_14px_rgba(18,45,69,0.3)]" />
        </motion.div>
      </motion.div>

      <div className="pointer-events-none absolute left-4 top-4 rounded-2xl px-3.5 py-2" style={{ ...glass.pill, background: 'rgba(255,255,255,0.74)' }}>
        <div className="display text-xl font-bold" style={{ color: 'var(--ink)' }}>
          {m.name}
        </div>
        <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
          {m.blurb}
          {m.gravity < 1 ? ' Low gravity.' : ''}
        </div>
      </div>
    </div>
  )
}

function Thumb({ map }: { map: MapDef }) {
  const w = 120
  const ht = 60
  const pts: number[] = []
  for (let i = 0; i <= 30; i++) pts.push(terrainFor(map, 1100 + i * 340))
  const lo = Math.min(...pts)
  const range = Math.max(...pts) - lo || 1
  const line = pts.map((y, i) => `${i === 0 ? 'M' : 'L'} ${((i / 30) * w).toFixed(1)} ${(30 + ((y - lo) / range) * 16).toFixed(1)}`).join(' ')
  const gid = `thumb-${map.id}`
  return (
    <svg viewBox={`0 0 ${w} ${ht}`} preserveAspectRatio="none" className="block h-14 w-full overflow-hidden rounded-xl" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={map.day.top} />
          <stop offset="1" stopColor={map.day.bottom} />
        </linearGradient>
      </defs>
      <rect width={w} height={ht} fill={`url(#${gid})`} />
      <circle cx={94} cy={14} r={6} fill={map.day.sun} />
      <path d={`${line} L ${w} ${ht} L 0 ${ht} Z`} fill={map.dirtTop} />
      <path d={line} fill="none" stroke={map.grass} strokeWidth={5} strokeLinejoin="round" />
      <path d={line} fill="none" stroke={map.edge} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  )
}

interface Props {
  mapId: number
  bikeId: number
  onChange: (id: number) => void
  onBack: () => void
  onNext: () => void
}

export function MapStep({ mapId, bikeId, onChange, onBack, onNext }: Props) {
  const selected = MAPS[mapId] ?? MAPS[0]
  const [riding, setRiding] = useState(false)
  const go = () => {
    if (riding) return
    setRiding(true)
    void enterFullscreen()
    window.setTimeout(onNext, 520)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="display text-3xl font-bold text-balance sm:text-4xl" style={{ color: 'var(--ink)' }}>
            Step 2: choose a map
          </h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Riding {BIKES[bikeId].name}. Each map has its own hills, weather, and score multiplier.
          </p>
        </div>
        <button
          onClick={onBack}
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-transform hover:scale-[1.03] active:scale-[0.97]"
          style={{ ...glass.pill, color: 'var(--ink)' }}
        >
          <ArrowLeft className="size-4" /> Bike
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={selected.id}
          initial={{ opacity: 0, x: 40, scale: 0.985 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -40, scale: 0.985 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <Scene m={selected} bikeId={bikeId} riding={riding} />
        </motion.div>
      </AnimatePresence>

      <div role="radiogroup" aria-label="Maps" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {MAPS.map((m, i) => {
          const on = m.id === mapId
          return (
            <motion.button
              key={m.id}
              role="radio"
              aria-checked={on}
              onClick={() => onChange(m.id)}
              className="relative rounded-2xl p-2 text-left"
              style={{ ...glass.card, color: 'var(--ink)' }}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * i, duration: 0.35 }}
              whileHover={{ y: -5, rotate: -0.6 }}
              whileTap={{ scale: 0.96 }}
            >
              {on && (
                <motion.span
                  layoutId="map-ring"
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                  style={{ border: '2px solid var(--accent)', boxShadow: '0 0 0 4px rgba(18,45,69,0.08)' }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
              <Thumb map={m} />
              <span className="mt-2 flex items-center justify-between gap-1 px-1 pb-0.5">
                <span className="truncate text-xs font-bold">{m.name}</span>
                {on ? (
                  <Check className="size-4 shrink-0" style={{ color: 'var(--success)' }} />
                ) : (
                  <span className="shrink-0 text-[10px] font-bold tabular-nums" style={{ color: 'var(--subtle)' }}>
                    x{m.scoreFactor.toFixed(2)}
                  </span>
                )}
              </span>
            </motion.button>
          )
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-3xl p-4 sm:flex-row sm:items-center sm:justify-between" style={glass.card}>
        <p className="text-xs text-pretty" style={{ color: 'var(--muted)' }}>
          {selected.scoreFactor < 1
            ? `Scores here are multiplied by ${selected.scoreFactor.toFixed(2)} so easier maps cannot out-score harder ones.`
            : 'Full score. This is the baseline map.'}{' '}
          Entering the ride costs 0.1 USDC per run.
        </p>
        <button
          onClick={go}
          disabled={riding}
          className="cta flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'var(--accent)' }}
        >
          Play on {selected.name} <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  )
}
