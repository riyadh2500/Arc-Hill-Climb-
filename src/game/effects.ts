// Cosmetic feedback only. Nothing here touches physics or the score.
import { sfx } from './audio'
import { getActiveLook } from './bikes'
import { getActiveMap } from './maps'
import { maxSpeedPx, WHEEL_R, distanceMeters, pose, terrainY, type GameState } from './engine'

interface Ragdoll {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  g: number
  life: number
  max: number
  size: number
  rgb: string
  grow: number
}

export interface Effects {
  parts: Particle[]
  lastState: GameState | null
  canCount: number
  coinCount: number
  wasOver: boolean
  dustClock: number
  smokeClock: number
  shake: number
  flash: number
  flashRgb: string
  speed: number
  air: number
  milestone: { meters: number; age: number } | null
  /** Trick call-outs: flips and clean landings. */
  banner: { text: string; rgb: string; age: number } | null
  flips: number
  skidClock: number
  lowFuel: number
  lastStep: number
  /** Rider lean, -1 (braking, back) to 1 (on the gas, forward). */
  lean: number
  /** Suspension compression in pixels, driven by a spring. */
  squash: number
  squashV: number
  gas: boolean
  ragdoll: Ragdoll | null
}

const MILESTONE_STEP = 50
const MILESTONE_LIFE = 1.7

export function createEffects(): Effects {
  return {
    parts: [],
    lastState: null,
    canCount: 0,
    coinCount: 0,
    wasOver: false,
    dustClock: 0,
    smokeClock: 0,
    shake: 0,
    flash: 0,
    flashRgb: '186,43,76',
    speed: 0,
    air: 0,
    milestone: null,
    banner: null,
    flips: 0,
    skidClock: 0,
    lowFuel: 0,
    lastStep: 0,
    lean: 0,
    squash: 0,
    squashV: 0,
    gas: false,
    ragdoll: null,
  }
}

function burst(fx: Effects, x: number, y: number, n: number, rgb: string, speed: number, up: number, g = 520) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const v = speed * (0.35 + Math.random() * 0.65)
    fx.parts.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - up,
      g,
      life: 0,
      max: 0.5 + Math.random() * 0.5,
      size: 2 + Math.random() * 3.5,
      rgb,
      grow: 0,
    })
  }
}

function reset(fx: Effects, s: GameState) {
  fx.lastState = s
  fx.parts.length = 0
  fx.canCount = 0
  fx.coinCount = 0
  fx.wasOver = false
  fx.shake = 0
  fx.flash = 0
  fx.speed = 0
  fx.air = 0
  fx.milestone = null
  fx.banner = null
  fx.flips = 0
  fx.lowFuel = 0
  fx.lastStep = 0
  fx.lean = 0
  fx.squash = 0
  fx.squashV = 0
  fx.ragdoll = null
}

export function updateEffects(fx: Effects, s: GameState, dt: number, gas: boolean, brake = false) {
  if (fx.lastState !== s) reset(fx, s)
  const running = s.status === 'running'
  fx.gas = running && gas
  const leanTarget = running ? (gas ? 1 : brake ? -1 : 0) : 0
  fx.lean += (leanTarget - fx.lean) * Math.min(1, dt * 7)
  // suspension spring
  fx.squashV += (-220 * fx.squash - 15 * fx.squashV) * dt
  fx.squash += fx.squashV * dt
  sfx.engine(running, Math.min(1, Math.hypot(s.a.vx, s.a.vy) / maxSpeedPx()), gas)

  const target = running ? Math.min(1, Math.hypot(s.a.vx, s.a.vy) / maxSpeedPx()) : 0
  fx.speed += (target - fx.speed) * Math.min(1, dt * 4)

  if (running) {
    const speed = Math.hypot(s.a.vx, s.a.vy)

    // dust from the rear wheel
    fx.dustClock += dt
    if (s.a.contact && speed > 60 && fx.dustClock > (gas ? 0.03 : 0.09)) {
      fx.dustClock = 0
      fx.parts.push({
        x: s.a.x - 8,
        y: s.a.y + WHEEL_R - 2,
        vx: -speed * 0.12 - Math.random() * 30,
        vy: -10 - Math.random() * 40,
        g: 90,
        life: 0,
        max: 0.45 + Math.random() * 0.35,
        size: 3 + Math.random() * 3,
        rgb: '224,200,160',
        grow: 9,
      })
    }

    // skid: hard braking on the ground kicks up a spray from the rear tire
    fx.skidClock += dt
    if (brake && s.a.contact && speed > 180 && fx.skidClock > 0.025) {
      fx.skidClock = 0
      for (let i = 0; i < 2; i++) {
        fx.parts.push({
          x: s.a.x - 4,
          y: s.a.y + WHEEL_R - 1,
          vx: speed * 0.18 * (0.6 + Math.random() * 0.8),
          vy: -40 - Math.random() * 70,
          g: 380,
          life: 0,
          max: 0.35 + Math.random() * 0.3,
          size: 2 + Math.random() * 2.4,
          rgb: '230,205,165',
          grow: 5,
        })
      }
    }

    // exhaust smoke while on the gas
    fx.smokeClock += dt
    if (gas && fx.smokeClock > 0.05) {
      fx.smokeClock = 0
      const p = pose(s)
      fx.parts.push({
        x: p.midX - 40,
        y: p.midY - 4,
        vx: -60 - Math.random() * 40,
        vy: -18 - Math.random() * 14,
        g: -30,
        life: 0,
        max: 0.6 + Math.random() * 0.3,
        size: 2.5,
        rgb: getActiveLook().smoke,
        grow: 14,
      })
    }

    // landing thump after real air time
    const airborne = !s.a.contact && !s.b.contact
    if (airborne) {
      fx.air += dt
    } else {
      if (fx.air > 0.35) {
      const lp = pose(s)
      const slopeAt = (terrainY(lp.midX + 1) - terrainY(lp.midX - 1)) / 2
      const err = Math.abs(Math.atan2(Math.sin(lp.angle - Math.atan(slopeAt)), Math.cos(lp.angle - Math.atan(slopeAt))))
      if (fx.air > 0.6 && err < 0.14) {
        fx.banner = { text: 'PERFECT LANDING', rgb: '126,241,179', age: 0 }
        sfx.chime()
      }
        fx.shake = Math.max(fx.shake, Math.min(9, fx.air * 10))
        sfx.land(fx.air * 10)
        fx.squashV += 120 + Math.min(260, fx.air * 260)
        burst(fx, s.a.x, s.a.y + WHEEL_R, 10, '224,200,160', 140, 60, 120)
        burst(fx, s.b.x, s.b.y + WHEEL_R, 10, '224,200,160', 140, 60, 120)
      }
      fx.air = 0
    }

    // fuel can sparkle and a small kick
    let taken = 0
    for (const c of s.cans) if (c.taken) taken++
    if (taken > fx.canCount) {
      const p = pose(s)
      burst(fx, p.midX, p.midY - 20, 22, '255,205,131', 240, 90)
      fx.shake = Math.max(fx.shake, 2.5)
      sfx.fuel()
    }
    fx.canCount = taken

    // flips
    if (s.flips > fx.flips) {
      fx.flips = s.flips
      fx.banner = { text: `${s.lastFlipDir > 0 ? 'FRONTFLIP' : 'BACKFLIP'}  +50`, rgb: '255,214,102', age: 0 }
      const fp = pose(s)
      burst(fx, fp.midX, fp.midY - 30, 26, '255,214,102', 280, 120)
      fx.shake = Math.max(fx.shake, 3)
      sfx.chime()
    }

    // coin sparkle
    if (s.coinsCollected > fx.coinCount) {
      const p = pose(s)
      burst(fx, p.midX + 10, p.midY - 36, 7, '255,214,102', 150, 70, 380)
      sfx.coin()
    }
    fx.coinCount = s.coinsCollected

    // distance milestone banner
    const step = Math.floor(distanceMeters(s) / MILESTONE_STEP)
    if (step > fx.lastStep) {
      fx.lastStep = step
      fx.milestone = { meters: step * MILESTONE_STEP, age: 0 }
      sfx.chime()
    }
  }

  // run-end impact, once
  if (s.status === 'over' && !fx.wasOver) {
    fx.wasOver = true
    const p = pose(s)
    const crash = s.reason === 'crash'
    if (crash) sfx.crash()
    if (crash) {
      fx.ragdoll = {
        x: p.headX,
        y: p.headY,
        vx: Math.max(60, s.a.vx * 0.55),
        vy: -280 - Math.random() * 120,
        rot: p.angle,
        vr: 5 + Math.random() * 4,
      }
    }
    const y = Math.min(p.headY, terrainY(p.headX) - 4)
    burst(fx, p.headX, y, crash ? 34 : 14, crash ? '186,43,76' : '138,132,156', 340, 130)
    if (crash) {
      fx.shake = 16
      fx.flash = 1
      fx.flashRgb = '186,43,76'
    } else {
      fx.flash = 0.35
      fx.flashRgb = '18,45,69'
    }
  }

  const r = fx.ragdoll
  if (r) {
    r.vy += 1500 * dt
    r.x += r.vx * dt
    r.y += r.vy * dt
    r.rot += r.vr * dt
    const ground = terrainY(r.x) - 12
    if (r.y > ground) {
      r.y = ground
      r.vy = Math.abs(r.vy) > 60 ? -r.vy * 0.35 : 0
      r.vx *= 0.7
      r.vr *= 0.6
    }
  }

  fx.shake *= Math.exp(-dt * 8)
  if (fx.shake < 0.05) fx.shake = 0
  fx.flash = Math.max(0, fx.flash - dt * 2.2)
  fx.lowFuel += ((running && s.fuel < 25 ? 1 : 0) - fx.lowFuel) * Math.min(1, dt * 4)
  if (fx.banner) {
    fx.banner.age += dt
    if (fx.banner.age > 1.6) fx.banner = null
  }
  if (fx.milestone) {
    fx.milestone.age += dt
    if (fx.milestone.age > MILESTONE_LIFE) fx.milestone = null
  }

  for (const p of fx.parts) {
    p.life += dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += p.g * dt
    p.size += p.grow * dt
  }
  fx.parts = fx.parts.filter((p) => p.life < p.max)
}

/** World-space particles. */
export function drawEffects(ctx: CanvasRenderingContext2D, fx: Effects) {
  for (const p of fx.parts) {
    const k = 1 - p.life / p.max
    ctx.fillStyle = `rgba(${p.rgb},${(k * 0.85).toFixed(3)})`
    ctx.beginPath()
    ctx.arc(p.x, p.y, Math.max(0.5, p.size * (0.4 + 0.6 * k)), 0, Math.PI * 2)
    ctx.fill()
  }
}

const hash = (i: number) => {
  const v = Math.sin(i * 127.1 + 31.7) * 43758.5453
  return v - Math.floor(v)
}

function drawWeather(ctx: CanvasRenderingContext2D, kind: string, w: number, h: number, t: number, speed: number) {
  const wrap = (v: number, m: number) => ((v % m) + m) % m
  if (kind === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    for (let i = 0; i < 70; i++) {
      const x = wrap(hash(i + 300) * w - t * (14 + speed * 160) + Math.sin(t * 0.9 + i) * 16, w + 20) - 10
      const y = wrap(hash(i + 350) * h + t * (34 + hash(i + 390) * 56), h + 10) - 5
      ctx.beginPath()
      ctx.arc(x, y, 1 + hash(i + 420) * 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (kind === 'petals') {
    for (let i = 0; i < 20; i++) {
      const x = wrap(hash(i + 500) * w - t * (30 + hash(i + 530) * 40 + speed * 140), w + 40) - 20
      const y = wrap(hash(i + 560) * h + Math.sin(t * 1.3 + i) * 26 + t * 14, h + 20) - 10
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(t * (0.8 + hash(i + 590)) + i)
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255,184,208,0.8)' : 'rgba(176,226,140,0.75)'
      ctx.beginPath()
      ctx.ellipse(0, 0, 5, 2.4, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  } else if (kind === 'sand') {
    ctx.lineCap = 'round'
    for (let i = 0; i < 26; i++) {
      const x = w + 40 - wrap(t * (240 + hash(i + 600) * 320 + speed * 400) + hash(i + 630) * w, w + 160)
      const y = hash(i + 660) * h
      ctx.strokeStyle = `rgba(255,232,190,${(0.12 + hash(i + 690) * 0.2).toFixed(2)})`
      ctx.lineWidth = 1 + hash(i + 720) * 1.6
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + 28 + hash(i + 750) * 40, y)
      ctx.stroke()
    }
  } else {
    for (let i = 0; i < 36; i++) {
      const x = wrap(hash(i + 800) * w - t * (6 + speed * 80), w)
      const y = (hash(i + 830) * h * 0.85 + Math.sin(t * 0.4 + i) * 8) % h
      ctx.fillStyle = `rgba(210,222,255,${(0.2 + 0.4 * Math.abs(Math.sin(t * 0.8 + i))).toFixed(2)})`
      ctx.beginPath()
      ctx.arc(x, y, 0.9 + hash(i + 860) * 1.2, 0, Math.PI * 2)
      ctx.fill()
    }
    // shooting star roughly every seven seconds
    const ph = (t % 7) / 1.1
    if (ph < 1) {
      const sx = w * 0.92 - ph * w * 0.55
      const sy = h * 0.06 + ph * h * 0.3
      const g = ctx.createLinearGradient(sx, sy, sx + 90, sy - 36)
      g.addColorStop(0, 'rgba(255,255,255,0.95)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.strokeStyle = g
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(sx + 90, sy - 36)
      ctx.stroke()
    }
  }
}

/** Screen-space layers: speed lines, vignette, impact flash, milestone banner. */
export function drawScreenFx(ctx: CanvasRenderingContext2D, fx: Effects, w: number, h: number, t: number) {
  // speed lines
  const strength = Math.max(0, fx.speed - 0.45) * 0.9
  if (strength > 0.02) {
    ctx.lineCap = 'round'
    ctx.lineWidth = 2
    ctx.strokeStyle = `rgba(255,255,255,${(strength * 0.55).toFixed(3)})`
    for (let i = 0; i < 16; i++) {
      const lane = hash(i + 1)
      const speed = 900 + hash(i + 40) * 700
      const x = w + 60 - ((t * speed + hash(i + 80) * (w + 300)) % (w + 300))
      const y = h * 0.08 + lane * h * 0.7
      const len = 40 + fx.speed * 110
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + len, y)
      ctx.stroke()
    }
  }

  drawWeather(ctx, getActiveMap().weather, w, h, t, fx.speed)

  // vignette tightens with speed
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75)
  v.addColorStop(0, 'rgba(18,45,69,0)')
  v.addColorStop(1, `rgba(18,45,69,${(0.1 + fx.speed * 0.16).toFixed(3)})`)
  ctx.fillStyle = v
  ctx.fillRect(0, 0, w, h)

  // impact flash
  if (fx.flash > 0.01) {
    ctx.fillStyle = `rgba(${fx.flashRgb},${(fx.flash * 0.32).toFixed(3)})`
    ctx.fillRect(0, 0, w, h)
  }

  // low fuel: red edges breathing
  if (fx.lowFuel > 0.02) {
    const pulse = 0.55 + 0.45 * Math.sin(t * 6)
    const lf = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.72)
    lf.addColorStop(0, 'rgba(186,43,76,0)')
    lf.addColorStop(1, `rgba(186,43,76,${(0.34 * pulse * fx.lowFuel).toFixed(3)})`)
    ctx.fillStyle = lf
    ctx.fillRect(0, 0, w, h)
  }

  // trick banner
  const b = fx.banner
  if (b) {
    const k = b.age / 1.6
    const pop = 1 + Math.max(0, 0.3 - b.age) * 2.2
    const alpha = k < 0.1 ? k / 0.1 : 1 - Math.max(0, (k - 0.6) / 0.4)
    ctx.save()
    ctx.translate(w / 2, h * 0.4 - b.age * 16)
    ctx.scale(pop, pop)
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha))
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '700 30px "Space Grotesk", sans-serif'
    ctx.shadowColor = 'rgba(18,45,69,0.55)'
    ctx.shadowBlur = 14
    ctx.fillStyle = `rgb(${b.rgb})`
    ctx.fillText(b.text, 0, 0)
    ctx.restore()
  }

  // milestone banner
  const m = fx.milestone
  if (m) {
    const k = m.age / MILESTONE_LIFE
    const pop = 1 + Math.max(0, 0.35 - m.age) * 1.6
    const alpha = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.55) / 0.45)
    ctx.save()
    ctx.translate(w / 2, h * 0.28 - m.age * 22)
    ctx.scale(pop, pop)
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha))
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '700 46px "Space Grotesk", sans-serif'
    ctx.shadowColor = 'rgba(18,45,69,0.45)'
    ctx.shadowBlur = 18
    ctx.fillStyle = '#ffffff'
    ctx.fillText(`${m.meters} m`, 0, 0)
    ctx.restore()
  }
}
