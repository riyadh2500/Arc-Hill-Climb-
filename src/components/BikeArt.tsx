import { BIKES, type BikeLook } from '@/game/bikes'

interface Props {
  bikeId: number
  /** Spin the wheels and run the engine effects like the bike is moving. */
  spin?: boolean
  className?: string
}

function Wheel({ cx, cy, look, spin }: { cx: number; cy: number; look: BikeLook; spin: boolean }) {
  const knobby = look.kind === 'enduro'
  const wide = look.kind === 'hawk'
  const outer = wide ? 24 : 22
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <g className={spin ? 'bike-wheel' : undefined}>
        <circle r={outer} fill="#17212b" />
        {knobby &&
          Array.from({ length: 16 }, (_, i) => (
            <rect key={i} x="-1.8" y={-outer - 2.6} width="3.6" height="4.4" rx="1" fill="#17212b" transform={`rotate(${i * 22.5})`} />
          ))}
        {wide &&
          Array.from({ length: 12 }, (_, i) => (
            <line key={i} x1="0" y1={-outer + 1} x2="0" y2={-outer + 5} stroke="#2b3947" strokeWidth="2.4" transform={`rotate(${i * 30})`} />
          ))}
        <circle r="14.5" fill={look.rim} />
        <circle r="3.4" fill="#6b7a89" />
        {[0, 45, 90, 135].map((a) => (
          <line key={a} x1="0" y1="-14" x2="0" y2="14" stroke="#6b7a89" strokeWidth="2" transform={`rotate(${a})`} />
        ))}
      </g>
      {look.neon && (
        <circle r={outer + 1.5} fill="none" stroke={look.neon} strokeWidth="3" className={spin ? 'neon-pulse' : undefined} style={{ filter: `drop-shadow(0 0 5px ${look.neon})` }} />
      )}
    </g>
  )
}

function Flame({ x, y, scale = 1, color = '#ffb347', on }: { x: number; y: number; scale?: number; color?: string; on: boolean }) {
  if (!on) return null
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} className="flame-flick">
      <path d="M0 -4 L-30 0 L0 4 Z" fill={color} opacity="0.92" />
      <path d="M0 -2 L-17 0 L0 2 Z" fill="#fff3c4" />
    </g>
  )
}

/** Fittings that make each bike its own machine. Coordinates are in the 200x120 art box. */
function Body({ look, spin }: { look: BikeLook; spin: boolean }) {
  switch (look.kind) {
    case 'enduro':
      return (
        <>
          {/* tall front fender, number plate, long fork */}
          <path d="M132 70 Q154 40 180 70" fill="none" stroke={look.tank} strokeWidth="6" strokeLinecap="round" />
          <rect x="112" y="34" width="22" height="16" rx="4" fill="#fff" stroke={look.frame} strokeWidth="2" />
          <text x="123" y="46" textAnchor="middle" fontSize="11" fontWeight="800" fill={look.frame} fontFamily="Space Grotesk, sans-serif">
            1
          </text>
          <path d="M52 58 L36 52 L32 58 L50 64 Z" fill={look.tank} />
        </>
      )
    case 'hawk':
      return (
        <>
          {/* hawk wing fairing with feather cuts and a beak fender */}
          <path d="M124 46 L170 56 L158 78 L122 66 Z" fill={look.tank} stroke={look.frame} strokeWidth="1.5" />
          <path d="M132 54 L160 61 M130 61 L154 68 M128 68 L148 73" stroke={look.stripe} strokeWidth="2" strokeLinecap="round" />
          <path d="M156 68 L184 82 L152 77 Z" fill={look.stripe} stroke={look.frame} strokeWidth="1.5" />
          <path d="M50 60 L28 70 L30 76 L56 68 Z" fill="#5f6f80" />
          <path d="M50 54 L22 40 L36 56 Z" fill={look.tank} />
        </>
      )
    case 'storm':
      return (
        <>
          {/* underglow, full fairing, windscreen, spoiler and a bolt */}
          <ellipse cx="100" cy="112" rx="70" ry="6" fill={look.neon ?? look.glow ?? '#fff'} opacity="0.5" className={spin ? 'neon-pulse' : undefined} />
          <path d="M114 44 L164 62 L152 84 L100 70 Z" fill={look.tank} stroke={look.frame} strokeWidth="1.5" />
          <path d="M124 46 L146 26 L152 30 L134 50 Z" fill="rgba(190,215,255,0.7)" stroke="#fff" strokeWidth="1" />
          <path d="M44 54 L18 42 L26 58 L52 62 Z" fill={look.frame} />
          <path d="M120 54 L132 54 L124 64 L138 64 L118 80 L123 68 L112 68 Z" fill="#fde047" className={spin ? 'bolt' : undefined} />
        </>
      )
    case 'phantom':
      return (
        <>
          {/* sleek wedge body, canopy, neon line, twin boosters */}
          <ellipse cx="100" cy="112" rx="76" ry="6" fill={look.neon ?? '#fff'} opacity="0.55" className={spin ? 'neon-pulse' : undefined} />
          <path d="M66 68 L130 50 L168 64 L154 82 L74 84 Z" fill={look.frame} stroke={look.neon ?? look.stripe} strokeWidth="2" style={{ filter: `drop-shadow(0 0 6px ${look.neon ?? '#fff'})` }} />
          <path d="M80 72 L150 62" stroke={look.neon ?? look.stripe} strokeWidth="3" strokeLinecap="round" className={spin ? 'neon-pulse' : undefined} />
          <path d="M80 46 Q104 -2 142 44 Z" fill="rgba(160,225,255,0.28)" stroke="rgba(255,255,255,0.85)" strokeWidth="1.5" />
          <rect x="30" y="66" width="30" height="7" rx="3.5" fill="#2b3947" stroke={look.neon ?? '#fff'} strokeWidth="1.2" />
          <rect x="30" y="78" width="30" height="7" rx="3.5" fill="#2b3947" stroke={look.neon ?? '#fff'} strokeWidth="1.2" />
        </>
      )
    default:
      return null
  }
}

/** Side-on bike and rider. Every bike has its own silhouette, colors, and (when moving) its own effects. */
export function BikeArt({ bikeId, spin = false, className }: Props) {
  const def = BIKES[bikeId] ?? BIKES[0]
  const look = def.look
  const showTank = look.kind !== 'phantom'
  return (
    <svg viewBox="-10 -6 224 126" className={className} role="img" aria-label={`${def.name} with rider`}>
      {look.glow && (
        <>
          <defs>
            <radialGradient id={`bike-glow-${bikeId}`}>
              <stop offset="0" stopColor={look.glow} />
              <stop offset="1" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="70" r="92" fill={`url(#bike-glow-${bikeId})`} className={spin ? 'neon-pulse' : undefined} />
        </>
      )}

      {/* exhaust flames: single on the lower bikes, double and bigger on the top two */}
      {look.kind === 'phantom' ? (
        <>
          <Flame x={30} y={69.5} scale={1.35} color={look.neon ?? '#fb7185'} on={spin} />
          <Flame x={30} y={81.5} scale={1.35} color={look.neon ?? '#fb7185'} on={spin} />
        </>
      ) : (
        <Flame x={28} y={84} scale={look.kind === 'storm' ? 1.25 : look.kind === 'classic' ? 0.6 : 0.9} color={look.kind === 'storm' ? '#a5b4fc' : '#ffb347'} on={spin} />
      )}

      <Wheel cx={45} cy={88} look={look} spin={spin} />
      <Wheel cx={155} cy={88} look={look} spin={spin} />

      {/* exhaust pipe */}
      {look.kind !== 'phantom' && <path d="M62 78 L28 82 L28 87 L64 86 Z" fill="#8a96a3" />}
      {/* frame and fork */}
      <g stroke={look.frame} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M45 88 L82 62 L128 62 L155 88" />
        <path d={look.kind === 'enduro' ? 'M134 48 L155 88' : 'M132 52 L155 88'} />
        <path d="M122 48 L142 48" />
      </g>
      {/* engine, tank, seat */}
      <rect x="80" y="66" width="34" height="16" rx="3" fill="#5f6f80" />
      {showTank && (
        <>
          <rect x="86" y="46" width="44" height="17" rx="6" fill={look.tank} />
          <rect x="94" y="52" width="26" height="3" fill={look.stripe} />
        </>
      )}
      <rect x="56" y="56" width="32" height="8" rx="4" fill="#17212b" />

      <Body look={look} spin={spin} />

      {/* rider */}
      <g strokeLinecap="round" strokeLinejoin="round" fill="none" className={spin ? 'rider-bob' : undefined}>
        <path d="M95 68 L111 70 L102 88" stroke={look.frame} strokeWidth="8" />
        <path d="M74 56 L94 24" stroke={look.suit} strokeWidth="13" />
        <path d="M92 30 L128 46" stroke={look.suit} strokeWidth="7" />
        <circle cx="98" cy="13" r="13" fill={look.helmet} stroke="none" />
        <path d="M100 6 A13 13 0 0 1 110 17 L100 17 Z" fill={look.frame} stroke="none" />
      </g>
    </svg>
  )
}
