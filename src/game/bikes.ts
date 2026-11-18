// Bike catalogue. Ids and order match the ArcClimbGarage contract. Prices and ownership come
// from the contract; everything here is how a bike looks and rides.
import { PPM } from './engine-constants'

export const MAX_BIKE_LEVEL = 3

export type BikeKind = 'classic' | 'enduro' | 'hawk' | 'storm' | 'phantom'

export interface BikeLook {
  /** Body style: each bike has its own silhouette and fittings. */
  kind: BikeKind
  /** Neon accent for rims and underglow, or null. */
  neon: string | null
  frame: string
  tank: string
  suit: string
  helmet: string
  rim: string
  stripe: string
  /** Smoke tint (r,g,b) for the exhaust while on the gas. */
  smoke: string
  glow: string | null
}

export interface BikeBase {
  /** Multiplier on engine drive force. */
  power: number
  /** Top speed in meters per second at level 0. */
  topSpeed: number
  /** Multiplier on fuel burn (lower is better). */
  fuelBurn: number
  /** Multiplier on in-air tilt control. */
  air: number
  /** Strength of the balance assists: air damping, landing alignment, anti-wheelie. */
  stability: number
}

export interface BikeDef {
  id: number
  name: string
  tagline: string
  base: BikeBase
  look: BikeLook
}

export const BIKES: readonly BikeDef[] = [
  {
    id: 0,
    name: 'ARC Bike',
    tagline: 'The balanced starter. Free for every wallet.',
    base: { stability: 1.0, power: 1, topSpeed: 22, fuelBurn: 1, air: 1 },
    look: { kind: 'classic', neon: null, frame: '#122d45', tank: '#ba2b4c', suit: '#2f6fb5', helmet: '#ffcd83', rim: '#d6dde6', stripe: '#ffffff', smoke: '150,160,172', glow: null },
  },
  {
    id: 1,
    name: 'Trail Blazer',
    tagline: 'Light and eager. Sips fuel on long climbs.',
    base: { stability: 1.1, power: 1.12, topSpeed: 23, fuelBurn: 0.92, air: 1.05 },
    look: { kind: 'enduro', neon: null, frame: '#14532d', tank: '#22c55e', suit: '#166534', helmet: '#fde68a', rim: '#bbf7d0', stripe: '#f0fdf4', smoke: '134,170,150', glow: null },
  },
  {
    id: 2,
    name: 'Dune Hawk',
    tagline: 'Strong pull and sharp air control.',
    base: { stability: 1.2, power: 1.25, topSpeed: 24, fuelBurn: 0.85, air: 1.12 },
    look: { kind: 'hawk', neon: null, frame: '#7c2d12', tank: '#f97316', suit: '#9a3412', helmet: '#ffedd5', rim: '#fed7aa', stripe: '#fff7ed', smoke: '190,150,110', glow: null },
  },
  {
    id: 3,
    name: 'Storm Rider',
    tagline: 'Fast, frugal, and fearless in the air.',
    base: { stability: 1.35, power: 1.4, topSpeed: 25, fuelBurn: 0.78, air: 1.2 },
    look: { kind: 'storm', neon: '#818cf8', frame: '#1e1b4b', tank: '#6366f1', suit: '#312e81', helmet: '#e0e7ff', rim: '#c7d2fe', stripe: '#a5b4fc', smoke: '140,150,210', glow: 'rgba(99,102,241,0.55)' },
  },
  {
    id: 4,
    name: 'Apex Phantom',
    tagline: 'The flagship. Fastest, most efficient, unreal air.',
    base: { stability: 1.5, power: 1.6, topSpeed: 26, fuelBurn: 0.68, air: 1.3 },
    look: { kind: 'phantom', neon: '#fb7185', frame: '#0b0b12', tank: '#e11d48', suit: '#111827', helmet: '#f9fafb', rim: '#fda4af', stripe: '#fb7185', smoke: '255,120,150', glow: 'rgba(244,63,94,0.6)' },
  },
]

export interface BikeStats {
  power: number
  /** Speed cap in world pixels per second. */
  topSpeedPx: number
  fuelBurn: number
  air: number
  stability: number
}

// Level 3 on the best bike tops out near 27.2 m/s, safely under the contract's 30 m/s plausibility cap.
export function statsFor(id: number, level: number): BikeStats {
  const b = (BIKES[id] ?? BIKES[0]).base
  const lv = Math.max(0, Math.min(MAX_BIKE_LEVEL, level))
  return {
    power: b.power * (1 + 0.06 * lv),
    topSpeedPx: (b.topSpeed + 0.4 * lv) * PPM,
    fuelBurn: b.fuelBurn * (1 - 0.04 * lv),
    air: b.air * (1 + 0.05 * lv),
    stability: b.stability * (1 + 0.04 * lv),
  }
}

let activeId = 0
let active: BikeStats = statsFor(0, 0)

export function setActiveBike(id: number, level: number) {
  activeId = BIKES[id] ? id : 0
  active = statsFor(activeId, level)
}

export function getActiveBike(): BikeStats {
  return active
}

export function getActiveLook(): BikeLook {
  return BIKES[activeId].look
}

/** 0..1 bars for the garage cards, relative to the best possible bike. */
export function statBars(id: number, level: number) {
  const s = statsFor(id, level)
  return {
    power: Math.min(1, (s.power - 0.9) / (1.6 * 1.18 - 0.9)),
    speed: Math.min(1, (s.topSpeedPx / PPM - 20) / (27.2 - 20)),
    fuel: Math.min(1, (1.1 - s.fuelBurn) / (1.1 - 0.68 * 0.88)),
    air: Math.min(1, (s.air - 0.9) / (1.3 * 1.15 - 0.9)),
    stability: Math.min(1, (s.stability - 0.9) / (1.5 * 1.12 - 0.9)),
  }
}
