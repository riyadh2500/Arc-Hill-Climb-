import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

const COLORS = ['#5fbeff', '#af8ff4', '#f05c6b', '#ffcd83', '#7ef1b3']

function rand(seed: number): number {
  const s = Math.sin(seed * 9301 + 49297) * 233280
  return s - Math.floor(s)
}

/** One-shot burst of confetti. Mount it when something real was won. */
export function Confetti({ count = 28 }: { count?: number }) {
  const reduce = useReducedMotion()
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: (rand(i + 1) - 0.5) * 340,
        y: -60 - rand(i + 50) * 150,
        fall: 120 + rand(i + 90) * 120,
        rot: (rand(i + 7) - 0.5) * 720,
        size: 5 + rand(i + 13) * 5,
        color: COLORS[i % COLORS.length],
        delay: rand(i + 31) * 0.12,
      })),
    [count],
  )
  if (reduce) return null

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-[2px]"
          style={{ width: p.size, height: p.size * 1.6, background: p.color }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
          animate={{ x: p.x, y: [0, p.y, p.y + p.fall], opacity: [1, 1, 0], rotate: p.rot, scale: 1 }}
          transition={{ duration: 1.5, delay: p.delay, ease: 'easeOut', times: [0, 0.4, 1] }}
        />
      ))}
    </div>
  )
}
