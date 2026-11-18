import { getActiveBike } from './bikes'
import { PPM } from './engine-constants'
import { getActiveMap, terrainFor } from './maps'

// Hill climb physics: two spring-free wheels joined by a rigid rod, solved with
// position-based constraints against a deterministic procedural terrain.

export { PPM }
export const WHEEL_R = 15
export const WHEELBASE = 64
export const START_X = 120
export const COIN_VALUE = 10

const GRAVITY = 1500
const ENGINE = 1250
const BRAKE = 1900
const AIR_TORQUE = 1100
const GROUND_TORQUE = 260
const FUEL_START = 100
const FUEL_CAN = 32
const FUEL_BURN_GAS = 6
const FUEL_BURN_IDLE = 2
const HEAD_R = 9

export interface Wheel {
  x: number
  y: number
  vx: number
  vy: number
  contact: boolean
}

export interface FuelCan {
  x: number
  taken: boolean
}

export type GameStatus = 'ready' | 'running' | 'over'
export type EndReason = 'crash' | 'fuel' | 'stuck'

export interface GameState {
  status: GameStatus
  reason: EndReason | null
  a: Wheel // rear
  b: Wheel // front
  wheelSpin: number
  fuel: number
  time: number
  maxX: number
  stillTime: number
  cans: FuelCan[]
  lastCanX: number
  coins: Coin[]
  lastCoinX: number
  coinCursor: number
  coinsCollected: number
  /** Smoothed throttle, 0..1. */
  throttle: number
  headTime: number
  prevAngle: number
  flipAcc: number
  flips: number
  bonusCoins: number
  lastFlipDir: number
}

export interface Input {
  gas: boolean
  brake: boolean
}

export function terrainY(x: number): number {
  return terrainFor(getActiveMap(), x)
}

function slope(x: number): number {
  return (terrainY(x + 1) - terrainY(x - 1)) / 2
}

function hash(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

export interface Coin {
  x: number
  y: number
  taken: boolean
}

/** Arcs of five coins floating above the track. Sorted by x, so the pickup scan stays cheap. */
export function ensureCoins(s: GameState, upToX: number) {
  while (s.lastCoinX < upToX) {
    const cluster = Math.floor(s.coins.length / 5)
    const startX = s.lastCoinX + 650 + hash(cluster + 400) * 700
    for (let k = 0; k < 5; k++) {
      const x = startX + k * 46
      const bump = Math.sin(((k + 0.5) / 5) * Math.PI) * 34
      s.coins.push({ x, y: terrainY(x) - 52 - bump, taken: false })
    }
    s.lastCoinX = startX + 4 * 46
  }
}

export function ensureCans(s: GameState, upToX: number) {
  while (s.lastCanX < upToX) {
    const i = s.cans.length
    s.lastCanX += 2300 + hash(i + 1) * 1900
    s.cans.push({ x: s.lastCanX, taken: false })
  }
}

export function createGame(): GameState {
  const ax = START_X
  const bx = START_X + WHEELBASE
  const s: GameState = {
    status: 'ready',
    reason: null,
    a: { x: ax, y: terrainY(ax) - WHEEL_R, vx: 0, vy: 0, contact: true },
    b: { x: bx, y: terrainY(bx) - WHEEL_R, vx: 0, vy: 0, contact: true },
    wheelSpin: 0,
    fuel: FUEL_START,
    time: 0,
    maxX: ax,
    stillTime: 0,
    cans: [],
    lastCanX: START_X,
    coins: [],
    lastCoinX: START_X + 500,
    coinCursor: 0,
    coinsCollected: 0,
    throttle: 0,
    headTime: 0,
    prevAngle: 0,
    flipAcc: 0,
    flips: 0,
    bonusCoins: 0,
    lastFlipDir: 0,
  }
  ensureCans(s, START_X + 8000)
  ensureCoins(s, START_X + 8000)
  return s
}

/** Coins earned so far: pickups plus flip bonuses. */
export function coinsOf(s: GameState): number {
  return s.coinsCollected * COIN_VALUE + s.bonusCoins
}

const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function distanceMeters(s: GameState): number {
  return Math.max(0, Math.floor((s.maxX - START_X) / PPM))
}

export interface BikePose {
  midX: number
  midY: number
  angle: number
  headX: number
  headY: number
}

export function pose(s: GameState): BikePose {
  const dx = s.b.x - s.a.x
  const dy = s.b.y - s.a.y
  const len = Math.hypot(dx, dy) || 1
  const dirX = dx / len
  const dirY = dy / len
  const upX = dirY
  const upY = -dirX
  const midX = (s.a.x + s.b.x) / 2
  const midY = (s.a.y + s.b.y) / 2
  return {
    midX,
    midY,
    angle: Math.atan2(dy, dx),
    headX: midX + upX * 40 - dirX * 8,
    headY: midY + upY * 40 - dirY * 8,
  }
}

/** Hard speed cap for the active bike. Every bike stays below the contract's 30 m/s plausibility cap. */
export function maxSpeedPx(): number {
  return getActiveBike().topSpeedPx
}

function capSpeed(w: Wheel) {
  const sp = Math.hypot(w.vx, w.vy)
  const cap = maxSpeedPx()
  if (sp > cap) {
    w.vx = (w.vx / sp) * cap
    w.vy = (w.vy / sp) * cap
  }
}

function solveDistance(a: Wheel, b: Wheel) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const d = Math.hypot(dx, dy) || 1
  const diff = (d - WHEELBASE) / d / 2
  a.x += dx * diff
  a.y += dy * diff
  b.x -= dx * diff
  b.y -= dy * diff
}

function solveTerrain(w: Wheel): boolean {
  const h = terrainY(w.x)
  const m = slope(w.x)
  const norm = Math.sqrt(1 + m * m)
  const dist = (h - w.y) / norm
  if (dist < WHEEL_R) {
    const push = WHEEL_R - dist
    w.x += (m / norm) * push
    w.y += (-1 / norm) * push
    return true
  }
  return false
}

function drive(w: Wheel, input: Input, share: number, dt: number, throttle: number) {
  if (!w.contact) return
  const m = slope(w.x)
  const norm = Math.sqrt(1 + m * m)
  const tx = 1 / norm
  const ty = m / norm
  const vt = w.vx * tx + w.vy * ty
  if (throttle > 0.02) {
    const force = ENGINE * getActiveBike().power * throttle
    w.vx += tx * force * share * dt
    w.vy += ty * force * share * dt
  } else if (input.brake) {
    const target = Math.max(vt - BRAKE * dt, -140)
    const delta = target - vt
    w.vx += tx * delta
    w.vy += ty * delta
  } else {
    const drag = vt * 0.35 * dt
    w.vx -= tx * drag
    w.vy -= ty * drag
  }
}

function end(s: GameState, reason: EndReason) {
  s.status = 'over'
  s.reason = reason
}

export function step(s: GameState, input: Input, dt: number) {
  if (s.status !== 'running') return
  const { a, b } = s

  // forces
  const g = GRAVITY * getActiveMap().gravity
  a.vy += g * dt
  b.vy += g * dt
  // smooth throttle: eases in and cuts off quicker, so the bike never lurches
  s.throttle = input.gas ? Math.min(1, s.throttle + dt * 5) : Math.max(0, s.throttle - dt * 8)
  // traction control: with only the rear wheel down and the nose high, ease the power so it cannot loop over
  const tAngle = Math.atan2(b.y - a.y, b.x - a.x)
  const tc = a.contact && !b.contact ? clamp(1 - (-tAngle - 0.35) / 0.6, 0.2, 1) : 1
  drive(a, input, 1, dt, s.throttle * tc)
  drive(b, input, 0.55, dt, s.throttle * tc)

  const bike = getActiveBike()
  const stab = bike.stability
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const px = dy / len
  const py = -dx / len
  const angle = Math.atan2(dy, dx) // negative: nose up
  const airborne = !a.contact && !b.contact
  /** Rotate the bike: positive lifts the nose, negative drops it. */
  const kick = (amount: number) => {
    b.vx += px * amount
    b.vy += py * amount
    a.vx -= px * amount
    a.vy -= py * amount
  }

  // lean: gas tips the nose up, brake tips it down
  const lean = input.gas ? Math.max(0.4, s.throttle) : input.brake ? -1 : 0
  if (lean !== 0) {
    const grounded = a.contact || b.contact
    // on the ground the tilt fades out as the nose lifts, so holding gas does not flip you backwards
    const noseUp = clamp((-angle - 0.12) / 0.4, 0, 1)
    const groundTorque = GROUND_TORQUE * (lean > 0 ? 1 - noseUp : 1)
    kick((grounded ? groundTorque : AIR_TORQUE * bike.air) * lean * dt)
  }

  const relPerp = (b.vx - a.vx) * px + (b.vy - a.vy) * py // positive: nose rising
  if (airborne) {
    // spin damping: hands off and the bike settles, hands on and you keep fine control
    const k = (input.gas || input.brake ? 0.7 : 2.6) * stab
    kick((-relPerp * Math.min(1, k * dt)) / 2)
    // and a hard ceiling on spin speed
    const cap = 8.4 * len
    if (Math.abs(relPerp) > cap) kick(-(relPerp - Math.sign(relPerp) * cap) / 2)

    // landing assist: close to the ground and falling, line the wheels up with the slope
    const gap = Math.min(terrainY(a.x) - a.y, terrainY(b.x) - b.y) - WHEEL_R
    if (a.vy + b.vy > 0 && gap < 120) {
      const midX = (a.x + b.x) / 2
      const err = clamp(wrapPi(Math.atan(slope(midX)) - angle), -1.2, 1.2)
      const w = clamp(1 - gap / 120, 0, 1)
      const hands = input.gas || input.brake ? 0.4 : 1
      kick(-err * 700 * stab * w * hands * dt)
    }
  } else if (a.contact && !b.contact) {
    // anti-wheelie: only the rear wheel down and the nose too high, push the front back down
    if (angle < -0.3) kick(-(-0.3 - angle) * 620 * stab * dt)
  } else if (!a.contact && b.contact) {
    // front-wheel-only nose dive
    if (angle > 0.5) kick((angle - 0.5) * 560 * stab * dt)
  }

  capSpeed(a)
  capSpeed(b)

  const ox = [a.x, b.x]
  const oy = [a.y, b.y]
  a.x += a.vx * dt
  a.y += a.vy * dt
  b.x += b.vx * dt
  b.y += b.vy * dt

  a.contact = false
  b.contact = false
  for (let i = 0; i < 6; i++) {
    solveDistance(a, b)
    if (solveTerrain(a)) a.contact = true
    if (solveTerrain(b)) b.contact = true
  }

  a.vx = (a.x - ox[0]) / dt
  a.vy = (a.y - oy[0]) / dt
  b.vx = (b.x - ox[1]) / dt
  b.vy = (b.y - oy[1]) / dt
  capSpeed(a)
  capSpeed(b)

  // flips: count full rotations while both wheels are off the ground
  const ang2 = Math.atan2(b.y - a.y, b.x - a.x)
  if (!a.contact && !b.contact) {
    s.flipAcc += wrapPi(ang2 - s.prevAngle)
    if (Math.abs(s.flipAcc) >= 5.0) {
      s.flips++
      s.bonusCoins += 50
      s.lastFlipDir = Math.sign(s.flipAcc)
      s.flipAcc -= Math.sign(s.flipAcc) * Math.PI * 2
    }
  } else {
    s.flipAcc = 0
  }
  s.prevAngle = ang2

  // wheel spin (visual)
  if (a.contact) s.wheelSpin += (a.vx / WHEEL_R) * dt
  else s.wheelSpin += (input.gas ? 14 : 3) * dt

  s.time += dt
  s.maxX = Math.max(s.maxX, a.x)
  ensureCans(s, s.maxX + 9000)
  ensureCoins(s, s.maxX + 9000)

  // coin pickups: only scan the window around the bike
  const midX = (a.x + b.x) / 2
  const midY = (a.y + b.y) / 2
  while (s.coinCursor < s.coins.length && s.coins[s.coinCursor].x < midX - 120) s.coinCursor++
  for (let i = s.coinCursor; i < s.coins.length && s.coins[i].x < midX + 80; i++) {
    const c = s.coins[i]
    if (!c.taken && Math.abs(c.x - midX) < 36 && Math.abs(c.y - midY) < 52) {
      c.taken = true
      s.coinsCollected++
    }
  }

  // fuel
  s.fuel = Math.max(0, s.fuel - (input.gas ? FUEL_BURN_GAS : FUEL_BURN_IDLE) * getActiveBike().fuelBurn * dt)
  const p = pose(s)
  for (const can of s.cans) {
    if (!can.taken && Math.abs(can.x - p.midX) < 46 && Math.abs(terrainY(can.x) - 30 - p.midY) < 70) {
      can.taken = true
      s.fuel = Math.min(100, s.fuel + FUEL_CAN)
    }
  }

  // end conditions
  // a head touching the ground for a moment is a crash, a graze is not
  if (p.headY + HEAD_R > terrainY(p.headX)) {
    s.headTime += dt
    if (s.headTime > 0.06) {
      end(s, 'crash')
      return
    }
  } else {
    s.headTime = 0
  }
  const speed = Math.hypot(a.vx, a.vy)
  if (speed < 18 && (a.contact || b.contact)) s.stillTime += dt
  else s.stillTime = 0
  if (s.fuel <= 0 && speed < 40) {
    end(s, 'fuel')
  } else if (s.stillTime > 4) {
    end(s, 'stuck')
  }
}
