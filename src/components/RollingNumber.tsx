import { useEffect, useRef, type CSSProperties } from 'react'
import { animate, motion, useAnimationControls, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'

interface Props {
  value: number
  decimals?: number
  /** Start from this number on first render instead of snapping to value. */
  from?: number
  className?: string
  style?: CSSProperties
}

/** Counts to a new value and gives it a small pulse. Only animates real changes. */
export function RollingNumber({ value, decimals = 2, from, className, style }: Props) {
  const reduce = useReducedMotion()
  const mv = useMotionValue(from ?? value)
  const text = useTransform(mv, (v) => v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }))
  const pulse = useAnimationControls()
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      if (from === undefined || reduce) {
        mv.set(value)
        return
      }
    }
    if (reduce) {
      mv.set(value)
      return
    }
    const count = animate(mv, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1] })
    void pulse.start({ scale: [1, 1.05, 1], transition: { duration: 0.5 } })
    return () => count.stop()
  }, [value, from, mv, pulse, reduce])

  return (
    <motion.span animate={pulse} className={className} style={{ display: 'inline-block', transformOrigin: 'left center', ...style }}>
      {text}
    </motion.span>
  )
}
