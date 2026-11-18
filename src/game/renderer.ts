import { drawEffects, drawScreenFx, type Effects } from './effects'
import { getActiveLook } from './bikes'
import { getActiveMap } from './maps'
import { drawFar, drawGroundDetail, drawProps, drawSkyFeatures } from './scenery'
import { maxSpeedPx, PPM, START_X, WHEEL_R, WHEELBASE, pose, terrainY, type GameState } from './engine'

export interface Camera {
  x: number
  y: number
  /** 1 = default framing; below 1 pulls back at speed so you see more track. */
  zoom: number
}

const VIEW_H = 560 // world pixels visible vertically

export function scaleFor(height: number): number {
  return height / VIEW_H
}

export function updateCamera(cam: Camera, s: GameState, width: number, height: number, snap: boolean) {
  const speed = s.status === 'running' ? Math.min(1, Math.hypot(s.a.vx, s.a.vy) / maxSpeedPx()) : 0
  const airborne = s.status === 'running' && !s.a.contact && !s.b.contact
  const targetZoom = 1 - speed * 0.13 - (airborne ? 0.04 : 0)
  cam.zoom = snap ? targetZoom : cam.zoom + (targetZoom - cam.zoom) * 0.035

  const scale = scaleFor(height) * cam.zoom
  const viewW = width / scale
  const viewH = VIEW_H / cam.zoom
  const p = pose(s)
  // look ahead of the bike as you speed up, and a touch higher when airborne to see the landing
  const targetX = p.midX - viewW * (0.34 - speed * 0.08)
  const targetY = p.midY - viewH * (airborne ? 0.5 : 0.55)
  if (snap) {
    cam.x = targetX
    cam.y = targetY
    return
  }
  cam.x += (targetX - cam.x) * 0.12
  cam.y += (targetY - cam.y) * 0.06
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mix(day: string, dusk: string, p: number): string {
  const a = hexToRgb(day)
  const b = hexToRgb(dusk)
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * p))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

/** 0 = midday, 1 = dusk. Cycles smoothly as you ride farther. */
function duskAt(distance: number): number {
  return (1 - Math.cos(distance / 420)) / 2
}

const starHash = (i: number) => {
  const v = Math.sin(i * 91.7 + 13.1) * 43758.5453
  return v - Math.floor(v)
}

function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, t: number) {
  const m = getActiveMap()
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, mix(m.day.top, m.dusk.top, p))
  g.addColorStop(0.6, mix(m.day.mid, m.dusk.mid, p))
  g.addColorStop(1, mix(m.day.bottom, m.dusk.bottom, p))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  if (m.stars) {
    for (let i = 0; i < 70; i++) {
      const tw = 0.45 + 0.55 * Math.abs(Math.sin(t * (0.6 + starHash(i + 200)) + i))
      ctx.fillStyle = `rgba(255,255,255,${(tw * 0.9).toFixed(2)})`
      ctx.beginPath()
      ctx.arc(starHash(i) * w, starHash(i + 70) * h * 0.62, 0.6 + starHash(i + 140) * 1.3, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // sun sinks toward the horizon as dusk arrives
  const sx = w * 0.76
  const sy = h * (0.2 + p * 0.38)
  const glow = ctx.createRadialGradient(sx, sy, 6, sx, sy, 90)
  glow.addColorStop(0, `rgba(255,236,190,${(0.95 - p * 0.15).toFixed(2)})`)
  glow.addColorStop(1, 'rgba(255,236,190,0)')
  ctx.fillStyle = glow
  ctx.fillRect(sx - 100, sy - 100, 200, 200)
  ctx.fillStyle = mix(m.day.sun, m.dusk.sun, p)
  ctx.beginPath()
  ctx.arc(sx, sy, 24, 0, Math.PI * 2)
  ctx.fill()
}

function drawClouds(ctx: CanvasRenderingContext2D, cam: Camera, w: number, h: number, t: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  for (let i = 0; i < 6; i++) {
    const span = w + 320
    const x = (((i * 260 + t * (6 + i * 2) - cam.x * 0.04) % span) + span) % span - 160
    const y = h * (0.1 + (i % 3) * 0.1) - cam.y * 0.02
    ctx.beginPath()
    ctx.ellipse(x, y, 54, 15, 0, 0, Math.PI * 2)
    ctx.ellipse(x - 28, y + 5, 34, 12, 0, 0, Math.PI * 2)
    ctx.ellipse(x + 30, y + 4, 38, 12, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawParallax(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  w: number,
  h: number,
  factor: number,
  base: number,
  amp: number,
  color: string,
) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, h)
  const off = cam.x * factor
  for (let sx = 0; sx <= w + 8; sx += 8) {
    const wx = sx + off
    const y = base + Math.sin(wx * 0.004) * amp + Math.sin(wx * 0.011 + 2) * amp * 0.4 - cam.y * factor * 0.5
    ctx.lineTo(sx, y)
  }
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fill()
}

function drawTerrain(ctx: CanvasRenderingContext2D, cam: Camera, viewW: number, viewH: number) {
  const x0 = Math.floor(cam.x / 10) * 10 - 20
  const x1 = cam.x + viewW + 20
  const bottom = cam.y + viewH + 40

  ctx.beginPath()
  ctx.moveTo(x0, bottom)
  for (let x = x0; x <= x1; x += 10) ctx.lineTo(x, terrainY(x))
  ctx.lineTo(x1, bottom)
  ctx.closePath()
  const dirt = ctx.createLinearGradient(0, cam.y + viewH * 0.3, 0, bottom)
  const m = getActiveMap()
  dirt.addColorStop(0, m.dirtTop)
  dirt.addColorStop(1, m.dirtBottom)
  ctx.fillStyle = dirt
  ctx.fill()

  // grass band
  ctx.beginPath()
  for (let x = x0; x <= x1; x += 10) {
    const y = terrainY(x)
    if (x === x0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  for (let x = x1; x >= x0; x -= 10) ctx.lineTo(x, terrainY(x) + 14)
  ctx.closePath()
  ctx.fillStyle = m.grass
  ctx.fill()

  ctx.beginPath()
  for (let x = x0; x <= x1; x += 10) {
    const y = terrainY(x)
    if (x === x0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.strokeStyle = m.edge
  ctx.lineWidth = 4
  ctx.stroke()
}

function drawMarkers(ctx: CanvasRenderingContext2D, cam: Camera, viewW: number) {
  const first = Math.ceil((cam.x - 120) / (PPM * 50)) * 50
  ctx.font = '600 14px "DM Sans", sans-serif'
  ctx.textAlign = 'center'
  for (let m = Math.max(50, first); m * PPM < cam.x + viewW + 100; m += 50) {
    const x = 120 + m * PPM
    if (x < cam.x - 60) continue
    const y = terrainY(x)
    ctx.strokeStyle = 'rgba(18,45,69,0.55)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x, y - 46)
    ctx.stroke()
    ctx.fillStyle = '#fffaf0'
    ctx.fillRect(x - 24, y - 70, 48, 24)
    ctx.strokeStyle = 'rgba(18,45,69,0.55)'
    ctx.lineWidth = 2
    ctx.strokeRect(x - 24, y - 70, 48, 24)
    ctx.fillStyle = '#122d45'
    ctx.fillText(`${m}m`, x, y - 53)
  }
}

function drawCan(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = '#ba2b4c'
  ctx.strokeStyle = '#7b1830'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(-14, -18, 28, 32, 5)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#7b1830'
  ctx.fillRect(-6, -24, 12, 7)
  ctx.fillStyle = '#fffaf0'
  ctx.beginPath()
  ctx.moveTo(2, -10)
  ctx.lineTo(-6, 2)
  ctx.lineTo(0, 2)
  ctx.lineTo(-2, 10)
  ctx.lineTo(7, -2)
  ctx.lineTo(1, -2)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const sx = Math.max(0.18, Math.abs(Math.cos(t * 4 + x * 0.05)))
  ctx.save()
  ctx.translate(x, y + Math.sin(t * 3 + x * 0.02) * 2.5)
  ctx.scale(sx, 1)
  ctx.fillStyle = '#f5b82e'
  ctx.strokeStyle = '#b97d10'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(0, 0, 11, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#ffe28a'
  ctx.beginPath()
  ctx.arc(-2, -2, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawWheel(ctx: CanvasRenderingContext2D, x: number, y: number, spin: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(spin)
  const look = getActiveLook()
  ctx.fillStyle = '#17212b'
  ctx.beginPath()
  ctx.arc(0, 0, WHEEL_R, 0, Math.PI * 2)
  ctx.fill()
  if (look.kind === 'enduro') {
    // knobby tread
    for (let i = 0; i < 14; i++) {
      ctx.save()
      ctx.rotate((i * Math.PI * 2) / 14)
      ctx.fillRect(-1.6, -WHEEL_R - 2.6, 3.2, 4)
      ctx.restore()
    }
  } else if (look.kind === 'hawk') {
    // paddle tread on a wide tire
    ctx.strokeStyle = '#2b3947'
    ctx.lineWidth = 2.4
    for (let i = 0; i < 12; i++) {
      ctx.save()
      ctx.rotate((i * Math.PI * 2) / 12)
      ctx.beginPath()
      ctx.moveTo(0, -WHEEL_R + 1)
      ctx.lineTo(0, -WHEEL_R + 4.5)
      ctx.stroke()
      ctx.restore()
    }
  }
  ctx.fillStyle = look.rim
  ctx.beginPath()
  ctx.arc(0, 0, WHEEL_R - 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#6b7a89'
  ctx.lineWidth = 2
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(a) * (WHEEL_R - 5), Math.sin(a) * (WHEEL_R - 5))
    ctx.stroke()
  }
  if (look.neon) {
    ctx.shadowColor = look.neon
    ctx.shadowBlur = 12
    ctx.strokeStyle = look.neon
    ctx.lineWidth = 2.6
    ctx.beginPath()
    ctx.arc(0, 0, WHEEL_R + 1.2, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

function poly(ctx: CanvasRenderingContext2D, pts: [number, number][], fill: string, stroke?: string, lw = 1.5) {
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = lw
    ctx.stroke()
  }
}

/** Fittings that make each bike its own machine, drawn in the bike's rotated frame. */
function drawExtras(ctx: CanvasRenderingContext2D, look: ReturnType<typeof getActiveLook>, k: number, t: number) {
  switch (look.kind) {
    case 'enduro': {
      ctx.strokeStyle = look.tank
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(20 * k, -6)
      ctx.quadraticCurveTo(34 * k, -32, 50 * k, -4)
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.roundRect(6 * k, -37, 14, 11, 3)
      ctx.fill()
      ctx.strokeStyle = look.frame
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.fillStyle = look.frame
      ctx.font = '800 9px "Space Grotesk", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('1', 6 * k + 7, -28.5)
      break
    }
    case 'hawk': {
      poly(ctx, [[16 * k, -20], [46 * k, -12], [38 * k, 4], [13 * k, -6]], look.tank, look.frame)
      ctx.strokeStyle = look.stripe
      ctx.lineWidth = 1.8
      ctx.beginPath()
      ctx.moveTo(22 * k, -15)
      ctx.lineTo(40 * k, -9)
      ctx.moveTo(20 * k, -9)
      ctx.lineTo(36 * k, -4)
      ctx.stroke()
      poly(ctx, [[38 * k, -2], [58 * k, 8], [36 * k, 4]], look.stripe, look.frame)
      poly(ctx, [[-34 * k, -10], [-52 * k, -26], [-44 * k, -8]], look.tank)
      break
    }
    case 'storm': {
      poly(ctx, [[12 * k, -22], [44 * k, -8], [36 * k, 5], [6 * k, -6]], look.tank, look.frame)
      poly(ctx, [[16 * k, -22], [30 * k, -38], [36 * k, -34], [22 * k, -20]], 'rgba(190,215,255,0.7)', '#ffffff', 1)
      poly(ctx, [[-40 * k, -12], [-56 * k, -26], [-50 * k, -10], [-34 * k, -8]], look.frame)
      ctx.globalAlpha = Math.sin(t * 28) > 0.82 ? 0.25 : 1
      poly(ctx, [[12 * k, -16], [21 * k, -16], [16 * k, -9], [24 * k, -9], [9 * k, 3], [13 * k, -5], [7 * k, -5]], '#fde047')
      ctx.globalAlpha = 1
      break
    }
    case 'phantom': {
      ctx.save()
      ctx.shadowColor = look.neon ?? '#fff'
      ctx.shadowBlur = 8
      poly(ctx, [[-36 * k, -4], [30 * k, -20], [50 * k, -6], [38 * k, 7], [-28 * k, 9]], look.frame, look.neon ?? look.stripe, 1.6)
      ctx.restore()
      ctx.strokeStyle = look.neon ?? look.stripe
      ctx.lineWidth = 2.4
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 5)
      ctx.beginPath()
      ctx.moveTo(-26 * k, -1)
      ctx.lineTo(36 * k, -11)
      ctx.stroke()
      ctx.globalAlpha = 1
      // boosters
      for (const y of [-9, 1]) {
        ctx.fillStyle = '#2b3947'
        ctx.strokeStyle = look.neon ?? '#fff'
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.roundRect(-52 * k, y, 18, 6, 3)
        ctx.fill()
        ctx.stroke()
      }
      // canopy
      ctx.beginPath()
      ctx.ellipse(-4 * k, -30, 26, 24, 0, Math.PI, Math.PI * 2)
      ctx.closePath()
      ctx.fillStyle = 'rgba(160,225,255,0.2)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      ctx.lineWidth = 1.2
      ctx.stroke()
      break
    }
    default:
      break
  }
}

function drawRagdoll(ctx: CanvasRenderingContext2D, r: { x: number; y: number; rot: number }) {
  const look = getActiveLook()
  ctx.save()
  ctx.translate(r.x, r.y)
  ctx.rotate(r.rot)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = look.suit
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, -20)
  ctx.stroke()
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(0, -18)
  ctx.lineTo(-14, -6)
  ctx.moveTo(0, -18)
  ctx.lineTo(14, -26)
  ctx.stroke()
  ctx.strokeStyle = look.frame
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-8, 16)
  ctx.moveTo(0, 0)
  ctx.lineTo(10, 14)
  ctx.stroke()
  ctx.fillStyle = look.helmet
  ctx.beginPath()
  ctx.arc(0, -31, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = look.frame
  ctx.beginPath()
  ctx.arc(3, -30, 6, -0.9, 0.9)
  ctx.lineTo(3, -30)
  ctx.fill()
  ctx.restore()
}

function drawBike(ctx: CanvasRenderingContext2D, s: GameState, fx?: Effects) {
  const { a, b } = s
  const look = getActiveLook()
  if (look.glow) {
    const gp = pose(s)
    const pulse = 0.85 + 0.15 * Math.sin(s.time * 6)
    const glow = ctx.createRadialGradient(gp.midX, gp.midY, 8, gp.midX, gp.midY, 110 * pulse)
    glow.addColorStop(0, look.glow)
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glow
    ctx.fillRect(gp.midX - 120, gp.midY - 120, 240, 240)
  }
  drawWheel(ctx, a.x, a.y, s.wheelSpin)
  drawWheel(ctx, b.x, b.y, s.wheelSpin)

  const p = pose(s)
  ctx.save()
  ctx.translate(p.midX, p.midY)
  ctx.rotate(p.angle)
  const k = WHEELBASE / 64
  const ragdolled = !!fx?.ragdoll
  // suspension: the body sinks toward the wheels on landings
  ctx.translate(0, fx?.squash ?? 0)

  // underglow for the neon bikes
  if (look.neon) {
    ctx.save()
    ctx.globalAlpha = 0.3 + 0.2 * Math.sin(s.time * 5)
    ctx.fillStyle = look.neon
    ctx.beginPath()
    ctx.ellipse(0, 24, 52, 6, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // exhaust flame while on the gas: one jet on most bikes, twin neon boosters on the Phantom
  if (fx?.gas) {
    const flick = 0.7 + 0.3 * Math.sin(s.time * 70)
    const jets: { y: number; len: number; color: string; core: boolean }[] =
      look.kind === 'phantom'
        ? [
            { y: -7, len: 34 * flick, color: look.neon ?? '#fb7185', core: true },
            { y: 3, len: 34 * flick, color: look.neon ?? '#fb7185', core: true },
          ]
        : [
            {
              y: 0,
              len: (look.kind === 'storm' ? 28 : look.kind === 'classic' ? 12 : 18) * flick,
              color: look.kind === 'storm' ? 'rgba(165,180,252,0.92)' : 'rgba(255,190,100,0.85)',
              core: look.kind !== 'classic',
            },
          ]
    const x0 = (look.kind === 'phantom' ? -48 : -36) * k
    for (const j of jets) {
      ctx.fillStyle = j.color
      ctx.beginPath()
      ctx.moveTo(x0, j.y - 3)
      ctx.lineTo(x0 - j.len, j.y)
      ctx.lineTo(x0, j.y + 3)
      ctx.closePath()
      ctx.fill()
      if (j.core) {
        ctx.fillStyle = 'rgba(255,248,215,0.95)'
        ctx.beginPath()
        ctx.moveTo(x0, j.y - 1.4)
        ctx.lineTo(x0 - j.len * 0.55, j.y)
        ctx.lineTo(x0, j.y + 1.4)
        ctx.closePath()
        ctx.fill()
      }
    }
  }

  // frame
  ctx.strokeStyle = look.frame
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(-32 * k, 0)
  ctx.lineTo(-8 * k, -12)
  ctx.lineTo(20 * k, -12)
  ctx.lineTo(32 * k, 0)
  ctx.stroke()
  // front fork
  ctx.beginPath()
  ctx.moveTo(22 * k, -14)
  ctx.lineTo(32 * k, 0)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(18 * k, -18)
  ctx.lineTo(28 * k, -18)
  ctx.stroke()
  // tank + engine
  ctx.fillStyle = look.tank
  ctx.beginPath()
  ctx.roundRect(-6 * k, -22, 24 * k, 12, 4)
  ctx.fill()
  ctx.fillStyle = '#5f6f80'
  ctx.fillRect(-12 * k, -9, 16 * k, 9)
  ctx.fillStyle = look.stripe
  ctx.fillRect(-4 * k, -17, 18 * k, 2)
  drawExtras(ctx, look, k, s.time)
  // seat
  ctx.fillStyle = '#17212b'
  ctx.beginPath()
  ctx.roundRect(-24 * k, -17, 16 * k, 6, 3)
  ctx.fill()

  // rider (leans with the throttle; detaches in a crash)
  if (!ragdolled) {
    ctx.lineWidth = 7
    ctx.strokeStyle = look.frame
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(-14 * k, -19)
    ctx.lineTo(0, -8)
    ctx.lineTo(-6 * k, 4)
    ctx.stroke()
    ctx.save()
    ctx.translate(-14 * k, -19)
    ctx.rotate((fx?.lean ?? 0) * 0.32)
    ctx.translate(14 * k, 19)
    ctx.strokeStyle = look.suit
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.moveTo(-14 * k, -19)
    ctx.lineTo(-6 * k, -38)
    ctx.stroke()
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(-6 * k, -36)
    ctx.lineTo(16 * k, -22)
    ctx.stroke()
    ctx.fillStyle = look.helmet
    ctx.beginPath()
    ctx.arc(-4 * k, -48, 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = look.frame
    ctx.beginPath()
    ctx.arc(-1 * k, -47, 6, -0.9, 0.9)
    ctx.lineTo(-1 * k, -47)
    ctx.fill()
    ctx.restore()
  }
  ctx.restore()
}

export function render(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  cam: Camera,
  width: number,
  height: number,
  dpr: number,
  fx?: Effects,
  t = 0,
) {
  const scale = scaleFor(height) * cam.zoom
  const dusk = duskAt(Math.max(0, (s.maxX - START_X) / PPM))
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const map = getActiveMap()
  drawSky(ctx, width, height, dusk, t)
  drawSkyFeatures(ctx, width, height, map, dusk, t)
  if (map.clouds) drawClouds(ctx, cam, width, height, t)
  drawFar(ctx, cam, width, height, map, mix(map.day.far, map.dusk.far, dusk), t)
  drawParallax(ctx, cam, width, height, 0.28, height * 0.68, 34, mix(map.day.near, map.dusk.near, dusk))

  const shake = fx?.shake ?? 0
  const sx = Math.sin(t * 83) * shake
  const sy = Math.cos(t * 67) * shake * 0.8
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, (-cam.x * scale + sx) * dpr, (-cam.y * scale + sy) * dpr)
  const viewW = width / scale
  const viewH = height / scale
  drawProps(ctx, map, cam, viewW, t)
  drawTerrain(ctx, cam, viewW, viewH)
  drawGroundDetail(ctx, map, cam, viewW, t)
  drawMarkers(ctx, cam, viewW)
  for (const can of s.cans) {
    if (can.taken || can.x < cam.x - 60 || can.x > cam.x + viewW + 60) continue
    drawCan(ctx, can.x, terrainY(can.x) - 28 + Math.sin(t * 3 + can.x) * 3)
  }
  for (let i = s.coinCursor; i < s.coins.length; i++) {
    const c = s.coins[i]
    if (c.x > cam.x + viewW + 60) break
    if (!c.taken && c.x > cam.x - 60) drawCoin(ctx, c.x, c.y, t)
  }
  drawBike(ctx, s, fx)
  if (fx?.ragdoll) drawRagdoll(ctx, fx.ragdoll)
  if (fx) {
    drawEffects(ctx, fx)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawScreenFx(ctx, fx, width, height, t)
  }
}
