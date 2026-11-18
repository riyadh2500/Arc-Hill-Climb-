import { useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { ArrowRight, Mountain } from 'lucide-react'
import { sfx } from '@/game/audio'
import { BikeArt } from '@/components/BikeArt'

interface Props {
  onEnter: () => void
}

const LINES = [
  { top: '34%', delay: 0, w: 180 },
  { top: '41%', delay: 0.35, w: 120 },
  { top: '48%', delay: 0.7, w: 220 },
  { top: '55%', delay: 0.2, w: 150 },
  { top: '30%', delay: 0.9, w: 100 },
]

const COINS = [
  { left: '23%', top: '26%', d: 0 },
  { left: '74%', top: '22%', d: 0.6 },
  { left: '80%', top: '42%', d: 1.1 },
  { left: '18%', top: '46%', d: 0.3 },
]

const TITLE = 'Arc Climb'
const DUST = [0, 1, 2, 3, 4, 5]

/** First screen: the bike launches off the ramp and hangs in the air. One click rides it out of the frame. */
export function Landing({ onEnter }: Props) {
  const [leaving, setLeaving] = useState(false)

  // Mouse parallax: far layers move less than near ones.
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, { stiffness: 70, damping: 18 })
  const sy = useSpring(my, { stiffness: 70, damping: 18 })
  const bikeX = useTransform(sx, (v) => v * 26)
  const bikeY = useTransform(sy, (v) => v * 16)
  const coinX = useTransform(sx, (v) => v * -18)
  const coinY = useTransform(sy, (v) => v * -10)
  const sceneX = useTransform(sx, (v) => v * -8)

  const enter = () => {
    if (leaving) return
    setLeaving(true)
    sfx.whoosh()
    window.setTimeout(onEnter, 720)
  }

  return (
    <div
      className="relative min-h-dvh overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #7fb8ee 0%, #ffd9a8 62%, #ffefd6 100%)' }}
      onPointerMove={(e) => {
        mx.set((e.clientX / window.innerWidth - 0.5) * 2)
        my.set((e.clientY / window.innerHeight - 0.5) * 2)
      }}
    >
      {/* scenery */}
      <motion.svg style={{ x: sceneX }} className="absolute -inset-x-6 inset-y-0 h-full w-[calc(100%+3rem)]" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMax slice" aria-hidden>
        <defs>
          <radialGradient id="landing-sun">
            <stop offset="0" stopColor="#fff6d8" stopOpacity="0.95" />
            <stop offset="1" stopColor="#fff6d8" stopOpacity="0" />
          </radialGradient>
        </defs>
        <motion.circle
          cx="900"
          cy="230"
          r="150"
          fill="url(#landing-sun)"
          animate={{ r: [150, 170, 150] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <circle cx="900" cy="230" r="56" fill="#fff3c9" />
        <path d="M0 520 L140 400 L260 480 L420 330 L580 470 L720 380 L880 490 L1040 360 L1200 470 L1200 700 L0 700 Z" fill="#c4b3dc" opacity="0.8" />
        <path d="M0 560 Q150 470 320 540 T640 530 T980 520 T1200 545 L1200 700 L0 700 Z" fill="#a8cfa6" />
        <path d="M0 610 Q200 570 420 600 T860 595 T1200 600 L1200 700 L0 700 Z" fill="#5fae4e" />
        <path d="M0 640 Q300 625 600 640 T1200 636 L1200 700 L0 700 Z" fill="#a9794a" />
        {/* launch ramp */}
        <path d="M60 640 L360 560 L420 548 L420 640 Z" fill="#8a5e3a" />
        <path d="M60 640 L360 560 L420 548" fill="none" stroke="#c99466" strokeWidth="6" strokeLinecap="round" />
      </motion.svg>

      {/* drifting clouds */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          aria-hidden
          className="absolute h-10 rounded-full bg-white/70 blur-[1px]"
          style={{ top: `${12 + i * 9}%`, width: 150 + i * 50 }}
          initial={{ x: '-30vw' }}
          animate={{ x: '120vw' }}
          transition={{ duration: 46 + i * 14, repeat: Infinity, ease: 'linear', delay: -i * 14 }}
        />
      ))}

      {/* floating coins */}
      {COINS.map((c) => (
        <motion.div
          key={c.left}
          aria-hidden
          className="absolute"
          style={{ left: c.left, top: c.top, x: coinX, y: coinY }}
        >
        <motion.div
          className="size-7 rounded-full"
          style={{ background: 'radial-gradient(circle at 35% 30%, #ffe28a, #f5b82e 60%, #b97d10)', boxShadow: '0 4px 10px rgba(185,125,16,0.35)' }}
          animate={leaving ? { scale: 0, opacity: 0, x: 80, y: -60 } : { y: [0, -12, 0], rotateY: [0, 180, 360] }}
          transition={leaving ? { duration: 0.4 } : { duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: c.d }}
        />
        </motion.div>
      ))}

      {/* speed lines */}
      {LINES.map((l) => (
        <motion.span
          key={l.top}
          aria-hidden
          className="absolute right-0 h-[3px] rounded-full bg-white/70"
          style={{ top: l.top, width: l.w }}
          initial={{ x: 0, opacity: 0 }}
          animate={{ x: ['0vw', '-95vw'], opacity: [0, 0.9, 0] }}
          transition={{ duration: leaving ? 0.5 : 1.6, repeat: Infinity, ease: 'easeIn', delay: l.delay }}
        />
      ))}

      {/* the stunt: launch off the ramp once, then hover; on click it rides out of frame */}
      <motion.div className="pointer-events-none absolute left-1/2 top-[30%] w-[min(88vw,620px)] -translate-x-1/2" style={{ x: bikeX, y: bikeY }}>
        <motion.div
          initial={{ x: '-62vw', y: '34vh', rotate: 12, opacity: 0 }}
          animate={
            leaving
              ? { x: '85vw', y: '-24vh', rotate: -32, opacity: 1, transition: { duration: 0.7, ease: [0.5, 0, 0.9, 0.4] } }
              : {
                  x: ['-62vw', '-30vw', '0vw'],
                  y: ['34vh', '-12vh', '0vh'],
                  rotate: [12, -30, -18],
                  opacity: 1,
                  transition: { duration: 1.35, ease: 'easeOut', times: [0, 0.55, 1], opacity: { duration: 0.2 } },
                }
          }
        >
          <motion.div
            animate={leaving ? undefined : { y: [0, -22, 0], rotate: [-2, 6, -2] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut', delay: 1.4 }}
          >
            <BikeArt bikeId={4} spin className="w-full drop-shadow-[0_24px_30px_rgba(18,45,69,0.3)]" />
          </motion.div>
          {/* dust and exhaust trailing behind the bike */}
          {DUST.map((i) => (
            <motion.span
              key={i}
              aria-hidden
              className="absolute left-[14%] top-[62%] rounded-full"
              style={{ width: 10 + i * 3, height: 10 + i * 3, background: 'rgba(255,255,255,0.55)', filter: 'blur(2px)' }}
              animate={{ x: [0, -140 - i * 18], y: [0, 14 + i * 4], opacity: [0.7, 0], scale: [0.6, 1.8] }}
              transition={{ duration: 1.3, repeat: Infinity, ease: 'easeOut', delay: 1.4 + i * 0.2 }}
            />
          ))}
        </motion.div>
      </motion.div>
      <motion.div
        aria-hidden
        className="absolute bottom-[19%] left-1/2 h-4 w-[min(52vw,360px)] -translate-x-1/2 rounded-[50%] bg-black/25 blur-md"
        initial={{ opacity: 0, scaleX: 0.3 }}
        animate={leaving ? { opacity: 0 } : { scaleX: [0.3, 1, 0.72, 1], opacity: [0, 0.5, 0.28, 0.5] }}
        transition={leaving ? { duration: 0.25 } : { duration: 3.4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />

      {/* copy */}
      <div className="pointer-events-none relative z-10 flex min-h-dvh flex-col items-center justify-between px-6 pb-12 pt-14 text-center">
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl" style={{ background: 'var(--accent)', color: '#fff' }}>
            <Mountain className="size-6" />
          </div>
          <h1 className="display text-6xl font-bold sm:text-8xl" style={{ color: '#fff', textShadow: '0 6px 30px rgba(18,45,69,0.35)' }} aria-label={TITLE}>
            {TITLE.split('').map((ch, i) => (
              <motion.span
                key={i}
                aria-hidden
                className="inline-block"
                initial={{ y: 60, opacity: 0, rotate: i % 2 ? 8 : -8 }}
                animate={{ y: 0, opacity: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.5 + i * 0.05 }}
              >
                {ch === ' ' ? '\u00a0' : ch}
              </motion.span>
            ))}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-pretty text-base font-medium sm:text-lg" style={{ color: '#122d45' }}>
            Ride the hills. Beat the clock. Take the USDC pot.
          </p>
        </motion.div>

        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.span
            className="cta flex min-h-14 items-center gap-2 rounded-full px-8 text-base font-bold text-white"
            style={{ background: 'var(--accent)', boxShadow: '0 12px 32px rgba(18,45,69,0.35)' }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            Tap to ride <ArrowRight className="size-5" />
          </motion.span>
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(18,45,69,0.6)' }}>
            Arc Testnet
          </span>
        </motion.div>
      </div>

      {/* wipe into the app */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-30"
        style={{ background: '#fffcf7' }}
        initial={{ clipPath: 'circle(0% at 72% 38%)' }}
        animate={{ clipPath: leaving ? 'circle(150% at 72% 38%)' : 'circle(0% at 72% 38%)' }}
        transition={{ duration: 0.55, delay: leaving ? 0.2 : 0, ease: [0.65, 0, 0.35, 1] }}
      />

      {/* one click anywhere */}
      <button type="button" onClick={enter} aria-label="Enter Arc Climb" className="absolute inset-0 z-20 cursor-pointer" />
    </div>
  )
}
