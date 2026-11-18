import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import type { EndReason } from '@/game/engine'
import type { Writes } from '@/hooks/useWrites'

export type Phase = 'idle' | 'countdown' | 'playing' | 'finished' | 'submitted' | 'standings'

export interface RunResult {
  distance: number
  score: number
  reason: EndReason
  mapId: number
  coins: number
  newBest: boolean
}

export const REASONS: Record<EndReason, string> = {
  crash: 'You landed on your head',
  fuel: 'Out of fuel',
  stuck: 'Stuck on the hill',
}

export function PrimaryButton(props: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      className="cta min-h-12 w-full rounded-2xl px-5 text-sm font-semibold text-white transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
      style={{ background: 'var(--accent)' }}
    >
      {props.children}
    </button>
  )
}

export function GhostButton(props: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      className="min-h-11 text-xs font-semibold disabled:opacity-40"
      style={{ color: 'var(--accent-hover)' }}
    >
      {props.children}
    </button>
  )
}

export function SuccessMark() {
  return (
    <svg viewBox="0 0 52 52" className="mx-auto size-14" aria-hidden>
      <motion.circle
        cx="26"
        cy="26"
        r="22"
        fill="rgba(26,128,71,0.12)"
        stroke="var(--success)"
        strokeWidth="3"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
      <motion.path
        d="M15 27 l8 8 l15 -17"
        fill="none"
        stroke="var(--success)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, delay: 0.4, ease: 'easeOut' }}
      />
    </svg>
  )
}

export function Busy({ writes, idle }: { writes: Writes; idle: string }) {
  if (!writes.busy) return <>{idle}</>
  return (
    <span className="flex items-center justify-center gap-2">
      <Loader2 className="size-4 animate-spin" />
      {writes.phase === 'wallet' ? 'Confirm in wallet...' : 'Confirming...'}
    </span>
  )
}

export function Title({ title, sub, big }: { title: ReactNode; sub: string; big?: boolean }) {
  return (
    <div className="text-center">
      <div className={`display font-bold tabular-nums text-balance ${big ? 'text-5xl' : 'text-xl'}`} style={{ color: 'var(--ink)' }}>
        {title}
      </div>
      <p className="mt-1 text-pretty text-xs" style={{ color: 'var(--muted)' }}>
        {sub}
      </p>
    </div>
  )
}
