// Per-map scenery: far silhouettes, sky features, trackside props and ground texture.
// Everything is a pure function of position and time, so it never touches physics or scoring.
import { START_X, terrainY } from './engine'
import type { MapDef } from './maps'

const hash = (i: number) => {
  const v = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return v - Math.floor(v)
}

interface Cam {
  x: number
  y: number
}

const smooth01 = (t: number) => {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}

/** Far horizon silhouette. `color` already includes the day/dusk mix. */
export function drawFar(ctx: CanvasRenderingContext2D, cam: Cam, w: number, h: number, m: MapDef, color: string, t: number) {
  const factor = 0.12
  const off = cam.x * factor
  const baseY = h * 0.55 - cam.y * factor * 0.5

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, h)

  if (m.far === 'hills') {
    for (let sx = 0; sx <= w + 8; sx += 8) {
      const wx = sx + off
      ctx.lineTo(sx, baseY + Math.sin(wx * 0.004) * 46 + Math.sin(wx * 0.011 + 2) * 18)
    }
  } else if (m.far === 'mesas') {
    for (let sx = 0; sx <= w + 6; sx += 6) {
      const wx = sx + off
      const idx = Math.floor(wx / 170)
      const u = (wx - idx * 170) / 170
      const e = smooth01(Math.min(u, 1 - u) / 0.16)
      const top = 36 + hash(idx + 11) * 78
      ctx.lineTo(sx, baseY + 54 - top * Math.pow(e, 0.55))
    }
  } else if (m.far === 'peaks') {
    for (let sx = 0; sx <= w + 6; sx += 6) {
      const wx = sx + off
      const idx = Math.floor(wx / 250)
      const u = (wx - idx * 250) / 250
      const tri = 1 - Math.abs(u * 2 - 1)
      const amp = 90 + hash(idx + 5) * 90
      ctx.lineTo(sx, baseY + 40 - amp * Math.pow(tri, 1.15))
    }
  } else {
    for (let sx = 0; sx <= w + 6; sx += 6) {
      const wx = sx + off
      const idx = Math.floor(wx / 210)
      const u = (wx - idx * 210) / 210
      const tri = 1 - Math.abs(u * 2 - 1)
      ctx.lineTo(sx, baseY + 36 - (26 + hash(idx + 9) * 48) * Math.pow(tri, 0.8))
    }
  }
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fill()

  if (m.far === 'peaks') {
    // snow caps: the same outline, clipped to the high part only
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, w, baseY + 40 - 118)
    ctx.clip()
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.beginPath()
    ctx.moveTo(0, h)
    for (let sx = 0; sx <= w + 6; sx += 6) {
      const wx = sx + off
      const idx = Math.floor(wx / 250)
      const u = (wx - idx * 250) / 250
      const tri = 1 - Math.abs(u * 2 - 1)
      const amp = 90 + hash(idx + 5) * 90
      ctx.lineTo(sx, baseY + 40 - amp * Math.pow(tri, 1.15))
    }
    ctx.lineTo(w, h)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  if (m.far === 'hills') {
    // a windmill every so often, blades turning
    for (let k = Math.floor(off / 1100) - 1; k < Math.floor((off + w) / 1100) + 2; k++) {
      const wx = k * 1100 + 420 + hash(k + 3) * 300
      const sx = wx - off
      if (sx < -60 || sx > w + 60) continue
      const gy = baseY + Math.sin(wx * 0.004) * 46 + Math.sin(wx * 0.011 + 2) * 18
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.beginPath()
      ctx.moveTo(sx - 9, gy + 4)
      ctx.lineTo(sx - 5, gy - 44)
      ctx.lineTo(sx + 5, gy - 44)
      ctx.lineTo(sx + 9, gy + 4)
      ctx.closePath()
      ctx.fill()
      ctx.save()
      ctx.translate(sx, gy - 44)
      ctx.rotate(t * 0.9 + k)
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      for (let b = 0; b < 4; b++) {
        ctx.rotate(Math.PI / 2)
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(0, -30)
        ctx.stroke()
      }
      ctx.restore()
    }
  }
}

/** Sky-level features: aurora over the peaks, Earth over the moon. Screen space. */
export function drawSkyFeatures(ctx: CanvasRenderingContext2D, w: number, h: number, m: MapDef, dusk: number, t: number) {
  if (m.far === 'peaks') {
    const strength = 0.25 + dusk * 0.75
    const bands = [
      { y: 0.16, hue: '120,255,200', ph: 0 },
      { y: 0.24, hue: '140,160,255', ph: 1.7 },
      { y: 0.31, hue: '255,150,220', ph: 3.1 },
    ]
    ctx.save()
    ctx.lineCap = 'round'
    for (const b of bands) {
      const g = ctx.createLinearGradient(0, h * (b.y - 0.1), 0, h * (b.y + 0.12))
      g.addColorStop(0, `rgba(${b.hue},0)`)
      g.addColorStop(0.5, `rgba(${b.hue},${(0.34 * strength).toFixed(3)})`)
      g.addColorStop(1, `rgba(${b.hue},0)`)
      ctx.strokeStyle = g
      ctx.lineWidth = 46
      ctx.beginPath()
      for (let sx = -20; sx <= w + 20; sx += 16) {
        const y = h * b.y + Math.sin(sx * 0.008 + t * 0.55 + b.ph) * 22 + Math.sin(sx * 0.02 - t * 0.9 + b.ph) * 7
        if (sx === -20) ctx.moveTo(sx, y)
        else ctx.lineTo(sx, y)
      }
      ctx.stroke()
    }
    ctx.restore()
  } else if (m.far === 'lunar') {
    const ex = w * 0.2
    const ey = h * 0.22
    const r = 30
    ctx.save()
    ctx.beginPath()
    ctx.arc(ex, ey, r, 0, Math.PI * 2)
    ctx.clip()
    const sea = ctx.createRadialGradient(ex - 8, ey - 8, 4, ex, ey, r)
    sea.addColorStop(0, '#7fc3ff')
    sea.addColorStop(1, '#2a62b8')
    ctx.fillStyle = sea
    ctx.fillRect(ex - r, ey - r, r * 2, r * 2)
    ctx.fillStyle = 'rgba(98,190,120,0.9)'
    for (let i = 0; i < 4; i++) {
      const px = ((((ex - r + i * 26 + t * 3) - (ex - r)) % (r * 2 + 26)) + (r * 2 + 26)) % (r * 2 + 26) + (ex - r) - 13
      ctx.beginPath()
      ctx.ellipse(px, ey + (i - 1.5) * 9, 11, 6 + (i % 2) * 3, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.beginPath()
    ctx.ellipse(ex - 6, ey - 10, 14, 4, -0.3, 0, Math.PI * 2)
    ctx.fill()
    // night side
    ctx.fillStyle = 'rgba(6,10,28,0.55)'
    ctx.beginPath()
    ctx.arc(ex + r * 0.7, ey + r * 0.2, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

const SPACING = 170

/** Trackside props, drawn in world space sitting on the terrain. */
export function drawProps(ctx: CanvasRenderingContext2D, m: MapDef, cam: Cam, viewW: number, t: number) {
  const first = Math.floor((cam.x - 120) / SPACING)
  const last = Math.floor((cam.x + viewW + 120) / SPACING)
  for (let i = first; i <= last; i++) {
    if (hash(i * 3 + m.id * 17) < 0.36) continue
    const x = i * SPACING + hash(i * 5 + 1) * 120
    if (x < START_X + 320) continue
    const y = terrainY(x)
    const s = 0.8 + hash(i * 11 + 4) * 0.55
    const sway = Math.sin(t * 1.3 + i) * 0.025
    const kind = Math.floor(hash(i * 7 + 2) * 5)
    ctx.save()
    ctx.translate(x, y + 2)
    ctx.scale(s, s)
    ctx.rotate(sway)
    if (m.id === 0) meadowProp(ctx, kind, i, t)
    else if (m.id === 1) dunesProp(ctx, kind, i)
    else if (m.id === 2) peaksProp(ctx, kind, i, t)
    else moonProp(ctx, kind, i, t)
    ctx.restore()
  }
}

function tri(ctx: CanvasRenderingContext2D, cx: number, y: number, hw: number, ht: number, fill: string) {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.moveTo(cx - hw, y)
  ctx.lineTo(cx, y - ht)
  ctx.lineTo(cx + hw, y)
  ctx.closePath()
  ctx.fill()
}

function meadowProp(ctx: CanvasRenderingContext2D, kind: number, i: number, t: number) {
  if (kind === 0) {
    ctx.fillStyle = '#7a5230'
    ctx.fillRect(-3, -14, 6, 14)
    tri(ctx, 0, -10, 24, 34, '#2f7d3a')
    tri(ctx, 0, -32, 19, 30, '#3f9a4a')
    tri(ctx, 0, -52, 14, 26, '#58b45c')
  } else if (kind === 1) {
    ctx.fillStyle = '#7a5230'
    ctx.fillRect(-4, -34, 8, 34)
    ctx.fillStyle = '#4aa64f'
    ctx.beginPath()
    ctx.arc(0, -52, 24, 0, Math.PI * 2)
    ctx.arc(-16, -42, 15, 0, Math.PI * 2)
    ctx.arc(16, -42, 15, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.beginPath()
    ctx.arc(-6, -58, 9, 0, Math.PI * 2)
    ctx.fill()
  } else if (kind === 2) {
    ctx.fillStyle = '#3c8f45'
    ctx.beginPath()
    ctx.ellipse(0, -8, 22, 12, 0, 0, Math.PI * 2)
    ctx.ellipse(-14, -5, 12, 8, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (kind === 3) {
    for (let f = -1; f <= 1; f++) {
      ctx.strokeStyle = '#3c8f45'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(f * 10, 0)
      ctx.quadraticCurveTo(f * 10 + Math.sin(t * 2 + f + i) * 3, -12, f * 10, -20)
      ctx.stroke()
      ctx.fillStyle = ['#ff7aa8', '#ffd24a', '#ffffff'][(f + 1 + i) % 3]
      ctx.beginPath()
      ctx.arc(f * 10, -22, 5, 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    ctx.fillStyle = '#9b6b3f'
    ctx.fillRect(-26, -22, 5, 24)
    ctx.fillRect(21, -22, 5, 24)
    ctx.fillRect(-26, -19, 52, 4)
    ctx.fillRect(-26, -10, 52, 4)
  }
}

function dunesProp(ctx: CanvasRenderingContext2D, kind: number, i: number) {
  if (kind === 0 || kind === 4) {
    ctx.fillStyle = '#3f8a4d'
    ctx.beginPath()
    ctx.roundRect(-5, -46, 10, 46, 5)
    ctx.roundRect(-20, -34, 8, 22, 4)
    ctx.roundRect(-20, -16, 20, 7, 3)
    ctx.roundRect(12, -40, 8, 24, 4)
    ctx.roundRect(0, -20, 20, 7, 3)
    ctx.fill()
    ctx.fillStyle = '#ff9fb8'
    ctx.beginPath()
    ctx.arc(0, -48, 4, 0, Math.PI * 2)
    ctx.fill()
  } else if (kind === 1) {
    ctx.strokeStyle = '#8a5a30'
    ctx.lineWidth = 6
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(10, -30, 4, -58)
    ctx.stroke()
    ctx.strokeStyle = '#3f9a55'
    ctx.lineWidth = 4
    for (let f = 0; f < 5; f++) {
      const a = -Math.PI / 2 + (f - 2) * 0.62
      ctx.beginPath()
      ctx.moveTo(4, -58)
      ctx.quadraticCurveTo(4 + Math.cos(a) * 18, -58 + Math.sin(a) * 18 - 4, 4 + Math.cos(a) * 32, -58 + Math.sin(a) * 26 + 12)
      ctx.stroke()
    }
  } else if (kind === 2) {
    ctx.fillStyle = '#b98a5a'
    ctx.beginPath()
    ctx.moveTo(-22, 0)
    ctx.lineTo(-14, -20)
    ctx.lineTo(4, -26)
    ctx.lineTo(22, -8)
    ctx.lineTo(24, 0)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.fillRect(-12, -14, 18, 3)
  } else {
    ctx.strokeStyle = '#b79a52'
    ctx.lineWidth = 2
    for (let f = -3; f <= 3; f++) {
      ctx.beginPath()
      ctx.moveTo(f * 4, 0)
      ctx.lineTo(f * 7 + Math.sin(i + f) * 3, -16 - (3 - Math.abs(f)) * 3)
      ctx.stroke()
    }
  }
}

function peaksProp(ctx: CanvasRenderingContext2D, kind: number, i: number, t: number) {
  if (kind === 0 || kind === 4) {
    ctx.fillStyle = '#5b4030'
    ctx.fillRect(-3, -12, 6, 12)
    tri(ctx, 0, -8, 24, 32, '#2f6b55')
    tri(ctx, 0, -28, 19, 28, '#3a7f66')
    tri(ctx, 0, -46, 14, 24, '#4a9478')
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.beginPath()
    ctx.moveTo(-9, -48)
    ctx.lineTo(0, -70)
    ctx.lineTo(9, -48)
    ctx.quadraticCurveTo(0, -42, -9, -48)
    ctx.fill()
  } else if (kind === 1) {
    for (const [dx, hgt, w] of [[-10, 30, 7], [0, 44, 9], [11, 26, 6]] as const) {
      ctx.fillStyle = 'rgba(170,225,255,0.75)'
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(dx - w, 0)
      ctx.lineTo(dx, -hgt)
      ctx.lineTo(dx + w, 0)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4 + i)
    ctx.beginPath()
    ctx.arc(2, -46, 2.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  } else if (kind === 2) {
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = 'rgba(18,45,69,0.25)'
    ctx.lineWidth = 1.5
    for (const [cy, r] of [[-12, 14], [-34, 10.5], [-50, 7.5]] as const) {
      ctx.beginPath()
      ctx.arc(0, cy, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    ctx.fillStyle = '#122d45'
    ctx.fillRect(-3, -52, 2, 2)
    ctx.fillRect(2, -52, 2, 2)
    ctx.fillStyle = '#ff8a3c'
    ctx.fillRect(-1, -49, 6, 2)
  } else {
    ctx.fillStyle = '#7f93a8'
    ctx.beginPath()
    ctx.moveTo(-20, 0)
    ctx.lineTo(-10, -18)
    ctx.lineTo(8, -22)
    ctx.lineTo(22, 0)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(-10, -18)
    ctx.lineTo(8, -22)
    ctx.lineTo(14, -12)
    ctx.quadraticCurveTo(0, -16, -10, -10)
    ctx.fill()
  }
}

function moonProp(ctx: CanvasRenderingContext2D, kind: number, i: number, t: number) {
  if (kind === 0 || kind === 4) {
    ctx.fillStyle = '#7d8498'
    ctx.beginPath()
    ctx.moveTo(-18, 0)
    ctx.lineTo(-12, -16)
    ctx.lineTo(2, -22)
    ctx.lineTo(16, -12)
    ctx.lineTo(20, 0)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    ctx.beginPath()
    ctx.moveTo(-12, -16)
    ctx.lineTo(2, -22)
    ctx.lineTo(0, -12)
    ctx.closePath()
    ctx.fill()
  } else if (kind === 1) {
    ctx.strokeStyle = '#aeb6c8'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, -52)
    ctx.moveTo(-10, -40)
    ctx.lineTo(10, -40)
    ctx.moveTo(-7, -48)
    ctx.lineTo(7, -48)
    ctx.stroke()
    const on = Math.sin(t * 5 + i) > 0
    ctx.fillStyle = on ? '#ff4d5e' : '#7a2a35'
    ctx.beginPath()
    ctx.arc(0, -54, 3.2, 0, Math.PI * 2)
    ctx.fill()
  } else if (kind === 2) {
    ctx.strokeStyle = '#d8dce8'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, -54)
    ctx.stroke()
    ctx.fillStyle = '#4f7cff'
    ctx.beginPath()
    ctx.moveTo(0, -52)
    for (let f = 0; f <= 20; f += 4) ctx.lineTo(f + 2, -52 + Math.sin(t * 4 + f * 0.4 + i) * 2.5 + f * 0.1)
    for (let f = 20; f >= 0; f -= 4) ctx.lineTo(f + 2, -38 + Math.sin(t * 4 + f * 0.4 + i) * 2.5 + f * 0.1)
    ctx.closePath()
    ctx.fill()
  } else {
    ctx.fillStyle = '#6b7186'
    ctx.beginPath()
    ctx.ellipse(-10, -5, 11, 6, 0, 0, Math.PI * 2)
    ctx.ellipse(8, -7, 14, 8, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Texture on and just under the ground surface. */
export function drawGroundDetail(ctx: CanvasRenderingContext2D, m: MapDef, cam: Cam, viewW: number, t: number) {
  const x0 = Math.floor(cam.x / 20) * 20 - 40
  const x1 = cam.x + viewW + 40

  if (m.id === 0) {
    ctx.lineCap = 'round'
    for (let x = x0; x < x1; x += 14) {
      const k = Math.floor(x / 14)
      const y = terrainY(x)
      const lean = Math.sin(t * 2 + k * 0.7) * 2.2
      ctx.strokeStyle = k % 2 ? '#7cc765' : '#4f9a42'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, y + 1)
      ctx.lineTo(x + lean, y - 5 - hash(k) * 6)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(0,0,0,0.1)'
    for (let x = x0; x < x1; x += 70) {
      const k = Math.floor(x / 70)
      ctx.beginPath()
      ctx.ellipse(x + hash(k) * 40, terrainY(x) + 34 + hash(k + 8) * 40, 6 + hash(k + 3) * 6, 3.5, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (m.id === 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'
    ctx.lineWidth = 2
    for (const dy of [16, 34]) {
      ctx.beginPath()
      for (let x = x0; x <= x1; x += 12) {
        const y = terrainY(x) + dy + Math.sin(x * 0.06 + dy) * 2
        if (x === x0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    for (let x = x0; x < x1; x += 40) {
      const k = Math.floor(x / 40)
      ctx.fillStyle = `rgba(255,248,220,${(0.3 + 0.5 * Math.abs(Math.sin(t * 3 + k))).toFixed(2)})`
      ctx.fillRect(x + hash(k) * 30, terrainY(x) - 2 - hash(k + 5) * 2, 2, 2)
    }
  } else if (m.id === 2) {
    for (let x = x0; x < x1; x += 28) {
      const k = Math.floor(x / 28)
      const y = terrainY(x)
      ctx.fillStyle = `rgba(255,255,255,${(0.35 + 0.65 * Math.abs(Math.sin(t * 2.4 + k * 1.3))).toFixed(2)})`
      ctx.fillRect(x + hash(k) * 20, y - 2 - hash(k + 4) * 3, 2.4, 2.4)
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'
    ctx.lineWidth = 1.5
    for (let x = x0; x < x1; x += 120) {
      const k = Math.floor(x / 120)
      const y = terrainY(x) + 24 + hash(k) * 30
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + 18, y + 8)
      ctx.lineTo(x + 30, y - 2)
      ctx.stroke()
    }
  } else {
    for (let x = x0; x < x1; x += 90) {
      const k = Math.floor(x / 90)
      if (hash(k + 20) < 0.35) continue
      const cx = x + hash(k) * 50
      const cy = terrainY(cx) + 16 + hash(k + 2) * 26
      const rx = 16 + hash(k + 6) * 26
      ctx.fillStyle = 'rgba(0,0,0,0.16)'
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, rx * 0.26, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.ellipse(cx, cy - 1.5, rx, rx * 0.26, 0, Math.PI * 1.05, Math.PI * 1.95)
      ctx.stroke()
    }
  }
}
