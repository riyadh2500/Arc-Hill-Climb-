import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { motion, useAnimationControls } from 'framer-motion'
import { ChevronsLeft, ChevronsRight, Coins, Fuel, Gauge } from 'lucide-react'
import { coinsOf, createGame, PPM, distanceMeters, step, type EndReason, type GameState, type Input } from '@/game/engine'
import { render, updateCamera, type Camera } from '@/game/renderer'
import { sfx } from '@/game/audio'
import { setActiveBike } from '@/game/bikes'
import { setActiveMap } from '@/game/maps'
import { createEffects, updateEffects, type Effects } from '@/game/effects'

interface Props {
  /** Increment to begin a fresh run. 0 shows the idle start line. */
  runKey: number
  /** Course for this round. A run in progress keeps the course it started on. */
  mapId: number
  bikeId: number
  bikeLevel: number
  /** Show the speed, coin and fuel readouts and the pedals. */
  hud: boolean
  onFinish: (distance: number, reason: EndReason, coins: number) => void
  children?: ReactNode
}

const DT = 1 / 120

const isOver = (s: GameState) => s.status === 'over'

export function GameCanvas({ runKey, mapId, bikeId, bikeLevel, hud: showHud, onFinish, children }: Props) {
  const mapRef = useRef(mapId)
  const bikeRef = useRef({ id: bikeId, level: bikeLevel })
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState>(createGame())
  const camRef = useRef<Camera>({ x: 0, y: 0, zoom: 1 })
  const fxRef = useRef<Effects>(createEffects())
  const inputRef = useRef<Input>({ gas: false, brake: false })
  const sizeRef = useRef({ w: 640, h: 400, dpr: 1 })
  const finishRef = useRef(onFinish)
  const [hud, setHud] = useState({ distance: 0, fuel: 100, coins: 0, speed: 0 })
  const distPulse = useAnimationControls()
  const fuelPulse = useAnimationControls()
  const stepRef = useRef(0)
  const fuelRef = useRef(100)
  const [pressed, setPressed] = useState({ gas: false, brake: false })

  useEffect(() => {
    finishRef.current = onFinish
  }, [onFinish])

  const setInput = useCallback((patch: Partial<Input>) => {
    inputRef.current = { ...inputRef.current, ...patch }
    setPressed((p) => ({ ...p, ...patch }))
  }, [])

  // HUD feedback tied to real game events: each 50 m, and picking up fuel.
  useEffect(() => {
    const step = Math.floor(hud.distance / 50)
    if (step > stepRef.current) void distPulse.start({ scale: [1, 1.14, 1], transition: { duration: 0.45 } })
    stepRef.current = step
    if (hud.fuel > fuelRef.current + 5) {
      void fuelPulse.start({
        scale: [1, 1.08, 1],
        boxShadow: ['0 0 0 0 rgba(255,205,131,0.9)', '0 0 0 12px rgba(255,205,131,0)'],
        transition: { duration: 0.6 },
      })
    }
    fuelRef.current = hud.fuel
  }, [hud, distPulse, fuelPulse])

  useEffect(() => {
    mapRef.current = mapId
    bikeRef.current = { id: bikeId, level: bikeLevel }
  }, [mapId, bikeId, bikeLevel])

  // Round rolled while idle or finished: show the new course. Never swap under a live run.
  useEffect(() => {
    if (stateRef.current.status === 'running') return
    setActiveMap(mapId)
    setActiveBike(bikeId, bikeLevel)
    const s = createGame()
    stateRef.current = s
    updateCamera(camRef.current, s, sizeRef.current.w, sizeRef.current.h, true)
  }, [mapId, bikeId, bikeLevel])

  // New run
  useEffect(() => {
    setActiveMap(mapRef.current)
    setActiveBike(bikeRef.current.id, bikeRef.current.level)
    const s = createGame()
    if (runKey > 0) s.status = 'running'
    stateRef.current = s
    updateCamera(camRef.current, s, sizeRef.current.w, sizeRef.current.h, true)
  }, [runKey])

  // Resize
  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      sizeRef.current = { w, h, dpr }
      updateCamera(camRef.current, stateRef.current, w, h, true)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  // Keyboard
  useEffect(() => {
    const map = (e: KeyboardEvent): keyof Input | null => {
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' || e.key === 'ArrowUp') return 'gas'
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'ArrowDown') return 'brake'
      return null
    }
    const down = (e: KeyboardEvent) => {
      const k = map(e)
      if (!k) return
      e.preventDefault()
      setInput({ [k]: true })
    }
    const up = (e: KeyboardEvent) => {
      const k = map(e)
      if (!k) return
      setInput({ [k]: false })
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [setInput])

  // Never leave the engine humming when the canvas goes away or the tab is hidden.
  useEffect(() => {
    const quiet = () => {
      if (document.hidden) sfx.engineStop()
    }
    document.addEventListener('visibilitychange', quiet)
    return () => {
      document.removeEventListener('visibilitychange', quiet)
      sfx.engineStop()
    }
  }, [])

  // Game loop
  useEffect(() => {
    const raf = { id: 0 }
    let last = performance.now()
    let acc = 0
    let hudAt = 0
    const loop = (now: number) => {
      raf.id = requestAnimationFrame(loop)
      const frame = Math.min(0.05, (now - last) / 1000)
      last = now
      const s = stateRef.current
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const { w, h, dpr } = sizeRef.current

      if (s.status === 'running') {
        acc += frame
        while (acc >= DT && s.status === 'running') {
          step(s, inputRef.current, DT)
          acc -= DT
        }
        if (isOver(s) && s.reason) {
          setHud({ distance: distanceMeters(s), fuel: s.fuel, coins: coinsOf(s), speed: Math.round((Math.hypot(s.a.vx, s.a.vy) / PPM) * 3.6) })
          finishRef.current(distanceMeters(s), s.reason, coinsOf(s))
        }
      }
      updateCamera(camRef.current, s, w, h, false)
      updateEffects(fxRef.current, s, frame, inputRef.current.gas, inputRef.current.brake)
      render(ctx, s, camRef.current, w, h, dpr, fxRef.current, now / 1000)

      if (now - hudAt > 90 && s.status === 'running') {
        hudAt = now
        setHud({ distance: distanceMeters(s), fuel: s.fuel, coins: coinsOf(s), speed: Math.round((Math.hypot(s.a.vx, s.a.vy) / PPM) * 3.6) })
      }
    }
    raf.id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf.id)
  }, [])

  const hold = (key: keyof Input) => ({
    onPointerDown: (e: PointerEvent) => {
      e.preventDefault()
      setInput({ [key]: true })
    },
    onPointerUp: () => setInput({ [key]: false }),
    onPointerLeave: () => setInput({ [key]: false }),
    onPointerCancel: () => setInput({ [key]: false }),
  })

  const low = hud.fuel < 25

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 touch-none select-none overflow-hidden"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* HUD */}
      {showHud && (
      <div className="pointer-events-none absolute left-4 right-4 top-[max(1rem,env(safe-area-inset-top))] flex items-start justify-between gap-3">
        <motion.div
          animate={distPulse}
          className="flex items-center gap-2 rounded-2xl px-3.5 py-2"
          style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(12px)', transformOrigin: 'left center' }}
        >
          <Gauge size={16} style={{ color: 'var(--subtle)' }} />
          <span className="display text-2xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
            {hud.distance}
          </span>
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--subtle)' }}>
            m
          </span>
          <span className="mx-1 h-4 w-px" style={{ background: 'rgba(18,45,69,0.15)' }} />
          <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--ink-2)' }}>
            {hud.speed} km/h
          </span>
          <span className="mx-1 h-4 w-px" style={{ background: 'rgba(18,45,69,0.15)' }} />
          <Coins size={16} style={{ color: '#d9a21b' }} />
          <span className="display text-lg font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
            {hud.coins}
          </span>
        </motion.div>
        <motion.div
          animate={fuelPulse}
          className="flex w-40 items-center gap-2 rounded-2xl px-3.5 py-2.5"
          style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(12px)', transformOrigin: 'right center' }}
        >
          <Fuel size={16} className={low ? 'animate-pulse' : ''} style={{ color: low ? 'var(--danger)' : 'var(--ink-2)' }} />
          <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'rgba(18,45,69,0.12)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(0, Math.min(100, hud.fuel))}%`,
                background: low ? 'var(--danger)' : 'var(--accent)',
                transition: 'width 90ms linear',
              }}
            />
          </div>
        </motion.div>
      </div>
      )}

      {/* Touch controls */}
      {showHud && (
      <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 right-4 flex items-end justify-between">
        <motion.button
          aria-label="Brake"
          {...hold('brake')}
          animate={{ scale: pressed.brake ? 0.93 : 1, boxShadow: pressed.brake ? '0 0 0 6px rgba(18,45,69,0.18)' : '0 0 0 0 rgba(18,45,69,0)' }}
          transition={{ type: 'spring', stiffness: 520, damping: 26 }}
          className="flex h-16 w-28 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-bold uppercase tracking-widest sm:h-[72px] sm:w-32"
          style={{
            background: pressed.brake ? 'var(--accent)' : 'rgba(255,255,255,0.72)',
            color: pressed.brake ? '#fff' : 'var(--ink)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <ChevronsLeft className="size-5" />
          Brake
          <kbd className="mono hidden text-[9px] font-medium normal-case tracking-normal opacity-60 sm:block">A / Left</kbd>
        </motion.button>
        <motion.button
          aria-label="Gas"
          {...hold('gas')}
          animate={{ scale: pressed.gas ? 0.93 : 1, boxShadow: pressed.gas ? '0 0 0 6px rgba(18,45,69,0.18)' : '0 0 0 0 rgba(18,45,69,0)' }}
          transition={{ type: 'spring', stiffness: 520, damping: 26 }}
          className="flex h-20 w-32 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-bold uppercase tracking-widest sm:h-24 sm:w-40"
          style={{
            background: pressed.gas ? 'var(--accent)' : 'rgba(255,255,255,0.72)',
            color: pressed.gas ? '#fff' : 'var(--ink)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <ChevronsRight className="size-6" />
          Gas
          <kbd className="mono hidden text-[9px] font-medium normal-case tracking-normal opacity-60 sm:block">D / Right</kbd>
        </motion.button>
      </div>
      )}

      {children}
    </div>
  )
}
