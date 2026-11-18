// Tiny WebAudio synth: no audio files. The context only starts after a real user gesture.

const KEY = 'arc-climb-muted'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = (() => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
})()

let engOsc: OscillatorNode | null = null
let engSub: OscillatorNode | null = null
let engGain: GainNode | null = null

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 1
    // a compressor keeps stacked effects from clipping while letting the mix stay loud
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 4
    master.connect(comp)
    comp.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

let primed = false

/** Runs on real user gestures: starts the context and plays one silent buffer (the iOS Safari unlock trick). */
function unlock() {
  const c = ensure()
  if (!c || primed) return
  primed = true
  const b = c.createBuffer(1, 1, 22050)
  const src = c.createBufferSource()
  src.buffer = b
  src.connect(c.destination)
  src.start(0)
}
if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'touchend', 'keydown', 'click'] as const) window.addEventListener(ev, unlock, { passive: true })
  // every button gets a soft tick, except the pedals which are pressed constantly
  document.addEventListener(
    'pointerdown',
    (e) => {
      const el = (e.target as Element | null)?.closest?.('button,a,[role="radio"]')
      if (!el || el.hasAttribute('disabled')) return
      const label = el.getAttribute('aria-label')
      if (label === 'Gas' || label === 'Brake') return
      sfx.tick()
    },
    true,
  )
}

const LOUD = 2.4

function tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, slideTo?: number) {
  const c = ctx
  if (!c || !master || muted) return
  const t = c.currentTime + when
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.min(0.9, gain * LOUD), t + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(master)
  o.start(t)
  o.stop(t + dur + 0.02)
}

function noise(dur: number, gain: number, cutoff: number) {
  const c = ctx
  if (!c || !master || muted) return
  const len = Math.floor(c.sampleRate * dur)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = c.createBufferSource()
  src.buffer = buf
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = cutoff
  const g = c.createGain()
  g.gain.value = Math.min(1, gain * LOUD)
  src.connect(f).connect(g).connect(master)
  src.start()
}

export const sfx = {
  isMuted: () => muted,
  /** 'running' once the browser has allowed sound. */
  state: () => ctx?.state ?? 'not-started',
  tick() {
    ensure()
    tone(1200, 0.04, 'square', 0.05)
    tone(800, 0.05, 'sine', 0.06, 0.012)
  },
  whoosh() {
    ensure()
    noise(0.6, 0.16, 2400)
    tone(180, 0.55, 'sawtooth', 0.08, 0, 720)
  },
  setMuted(next: boolean) {
    muted = next
    try {
      localStorage.setItem(KEY, next ? '1' : '0')
    } catch {
      // storage unavailable
    }
    if (master) master.gain.value = next ? 0 : 1
    if (next) {
      sfx.engineStop()
    } else {
      ensure()
      sfx.success()
    }
  },
  coin() {
    ensure()
    tone(988, 0.1, 'sine', 0.16)
    tone(1319, 0.16, 'sine', 0.14, 0.07)
  },
  fuel() {
    ensure()
    tone(330, 0.25, 'triangle', 0.18, 0, 760)
  },
  chime() {
    ensure()
    ;[523, 659, 784].forEach((f, i) => tone(f, 0.22, 'sine', 0.12, i * 0.08))
  },
  land(power: number) {
    ensure()
    tone(110, 0.18, 'sine', Math.min(0.3, 0.12 + power * 0.02), 0, 48)
    noise(0.12, 0.06, 700)
  },
  crash() {
    ensure()
    noise(0.55, 0.32, 1400)
    tone(140, 0.45, 'sawtooth', 0.2, 0, 38)
    try {
      navigator.vibrate?.(140)
    } catch {
      // vibration not available
    }
  },
  beep(final: boolean) {
    ensure()
    tone(final ? 1046 : 660, final ? 0.32 : 0.14, 'square', 0.1)
  },
  success() {
    ensure()
    ;[523, 659, 784, 1046].forEach((f, i) => tone(f, 0.26, 'triangle', 0.14, i * 0.09))
  },
  /** Call every frame while riding. speed is 0..1 of the bike's top speed. */
  engine(running: boolean, speed: number, gas: boolean) {
    const c = ensure()
    if (!c || !master || muted || !running) {
      sfx.engineStop()
      return
    }
    if (!engOsc || !engSub || !engGain) {
      engOsc = c.createOscillator()
      engSub = c.createOscillator()
      engOsc.type = 'sawtooth'
      engSub.type = 'square'
      engGain = c.createGain()
      engGain.gain.value = 0
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 900
      engOsc.connect(lp)
      engSub.connect(lp)
      lp.connect(engGain).connect(master)
      engOsc.start()
      engSub.start()
    }
    const f = 48 + speed * 110 + (gas ? 26 : 0)
    const t = c.currentTime
    engOsc.frequency.setTargetAtTime(f, t, 0.08)
    engSub.frequency.setTargetAtTime(f * 0.5, t, 0.08)
    engGain.gain.setTargetAtTime(gas ? 0.14 : 0.07, t, 0.1)
  },
  engineStop() {
    if (engGain && ctx) engGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05)
  },
}
