// Course definitions. Riders pick any course. Each course carries a score factor (at most 1)
// so a flatter, faster course cannot beat a harder one on raw distance alone. The factors are
// set from how far a scripted rider gets on each course in the same time, hardest course = 1.

/** Matches PPM (40) * 700 m in the engine: where terrain reaches full difficulty. */
const DIFFICULTY_PX = 28000

export interface SkyTheme {
  top: string
  mid: string
  bottom: string
  far: string
  near: string
  sun: string
}

export interface MapDef {
  id: number
  name: string
  blurb: string
  /** Multiplier on the base gravity. */
  gravity: number
  base: number
  gain: number
  f1: number
  f2: number
  a2: number
  p2: number
  f3: number
  a3: number
  p3: number
  day: SkyTheme
  dusk: SkyTheme
  dirtTop: string
  dirtBottom: string
  grass: string
  edge: string
  clouds: boolean
  stars: boolean
  /** Ambient particles drawn over the scene. */
  weather: 'petals' | 'sand' | 'snow' | 'stardust'
  /** Silhouette drawn on the far horizon. */
  far: 'hills' | 'mesas' | 'peaks' | 'lunar'
  /** Swatch used for small previews. */
  accent: string
  /** Submitted score = floor(distance * scoreFactor). Never above 1, so the contract's speed cap still holds. */
  scoreFactor: number
}

export const MAPS: readonly MapDef[] = [
  {
    id: 0,
    name: 'Green Meadow',
    blurb: 'Rolling hills. A fair first climb.',
    gravity: 1,
    base: 22,
    gain: 58,
    f1: 0.0024,
    f2: 0.0067,
    a2: 0.55,
    p2: 1.3,
    f3: 0.0151,
    a3: 0.25,
    p3: 0.7,
    day: { top: '#9fd0f5', mid: '#d8ecf8', bottom: '#fff1d6', far: '#c3dcec', near: '#a8cfa6', sun: '#fff6d8' },
    dusk: { top: '#5d6fb8', mid: '#f2b3a2', bottom: '#ffd49a', far: '#b3a6cf', near: '#86ad8c', sun: '#ffc98a' },
    dirtTop: '#a9794a',
    dirtBottom: '#6d4a2f',
    grass: '#5fae4e',
    edge: '#8fd47a',
    clouds: true,
    stars: false,
    weather: 'petals',
    far: 'hills',
    accent: '#5fae4e',
    scoreFactor: 0.9,
  },
  {
    id: 1,
    name: 'Sun Dunes',
    blurb: 'Long soft dunes. Fast and floaty.',
    gravity: 1,
    base: 30,
    gain: 70,
    f1: 0.0018,
    f2: 0.0045,
    a2: 0.5,
    p2: 0.4,
    f3: 0.0112,
    a3: 0.18,
    p3: 2.1,
    day: { top: '#f6c98a', mid: '#fde3b8', bottom: '#fff0d2', far: '#ecc994', near: '#e0b06f', sun: '#fffbe6' },
    dusk: { top: '#a8527a', mid: '#f08f6c', bottom: '#ffc27a', far: '#c97f7f', near: '#b9715a', sun: '#ffd89a' },
    dirtTop: '#d9a85c',
    dirtBottom: '#a8743a',
    grass: '#e8c27a',
    edge: '#f6dc9c',
    clouds: false,
    stars: false,
    weather: 'sand',
    far: 'mesas',
    accent: '#e0a24c',
    scoreFactor: 0.8,
  },
  {
    id: 2,
    name: 'Frozen Peaks',
    blurb: 'Steep and choppy. Grip your nerve.',
    gravity: 1,
    base: 20,
    gain: 52,
    f1: 0.003,
    f2: 0.0083,
    a2: 0.6,
    p2: 0.9,
    f3: 0.0125,
    a3: 0.14,
    p3: 1.8,
    day: { top: '#a9c9ee', mid: '#e3eefa', bottom: '#f6fbff', far: '#cfdcf0', near: '#b4c8e2', sun: '#ffffff' },
    dusk: { top: '#4a5fa0', mid: '#bda6d6', bottom: '#f3d6e0', far: '#9a95c4', near: '#8493bd', sun: '#ffe4ee' },
    dirtTop: '#9fb4c8',
    dirtBottom: '#6f86a0',
    grass: '#f2f7fc',
    edge: '#ffffff',
    clouds: true,
    stars: false,
    weather: 'snow',
    far: 'peaks',
    accent: '#7fa6d6',
    scoreFactor: 0.95,
  },
  {
    id: 3,
    name: 'Moon Craters',
    blurb: 'Low gravity. Big air, soft landings.',
    gravity: 0.62,
    base: 26,
    gain: 70,
    f1: 0.0014,
    f2: 0.005,
    a2: 0.45,
    p2: 2.4,
    f3: 0.0125,
    a3: 0.3,
    p3: 0.3,
    day: { top: '#0b1630', mid: '#1b2a52', bottom: '#2f3f6e', far: '#3a4770', near: '#4a557a', sun: '#bcd8ff' },
    dusk: { top: '#140f2e', mid: '#2c2250', bottom: '#4a3a7a', far: '#40396a', near: '#4e4878', sun: '#d7c6ff' },
    dirtTop: '#9aa0ae',
    dirtBottom: '#5b6173',
    grass: '#b9bfcc',
    edge: '#e2e6ee',
    clouds: false,
    stars: true,
    weather: 'stardust',
    far: 'lunar',
    accent: '#8c97b8',
    scoreFactor: 1,
  },
]

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

export function terrainFor(m: MapDef, x: number): number {
  const ramp = smooth(520, 1300, x)
  const difficulty = Math.min(1, Math.max(0, x / DIFFICULTY_PX))
  const amp = (m.base + m.gain * difficulty) * ramp
  return 430 + amp * (Math.sin(x * m.f1) + m.a2 * Math.sin(x * m.f2 + m.p2) + m.a3 * Math.sin(x * m.f3 + m.p3))
}

let active: MapDef = MAPS[0]

export function setActiveMap(id: number) {
  active = MAPS[id] ?? MAPS[0]
}

export function scoreFor(mapId: number, distance: number): number {
  const m = MAPS[mapId] ?? MAPS[0]
  return Math.max(0, Math.floor(distance * m.scoreFactor))
}

export function getActiveMap(): MapDef {
  return active
}
