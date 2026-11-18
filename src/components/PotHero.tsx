import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Crown, Timer } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { formatUsdc } from '@/onchain-money'
import { formatClock, glass, shortAddress } from '@/lib/hillclimb'
import { Avatar } from '@/components/Avatar'
import { RollingNumber } from '@/components/RollingNumber'
import type { HillClimbData } from '@/hooks/useHillClimb'

const SPECTRAL = 'linear-gradient(90deg, #5fbeff, #af8ff4, #f05c6b, #ffcd83, #7ef1b3)'

function useSecondsLeft(timeLeft: number | undefined, fetchedAt: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  if (timeLeft === undefined) return undefined
  return Math.max(0, timeLeft - Math.floor((now - fetchedAt) / 1000))
}

/** Decimals worth showing for this pot, never fewer than 2. */
function decimalsFor(fee: bigint | undefined): number {
  if (fee === undefined) return 2
  const frac = formatUsdc(fee).split('.')[1] ?? ''
  return Math.min(6, Math.max(2, frac.length))
}

export function PotHero({ data }: { data: HillClimbData }) {
  const { round, fee, timeLeft, roundDuration, fetchedAt, loading, failed, address } = data
  const pot = round?.pot ?? 0n
  const [prevPot, setPrevPot] = useState(pot)
  const [gain, setGain] = useState<{ id: number; amount: bigint } | null>(null)
  if (pot !== prevPot) {
    setPrevPot(pot)
    if (pot > prevPot && prevPot > 0n) setGain((g) => ({ id: (g?.id ?? 0) + 1, amount: pot - prevPot }))
  }

  const left = useSecondsLeft(timeLeft, fetchedAt)
  const ended = left === 0
  const urgent = left !== undefined && left > 0 && left <= 60
  const youLead = !!address && !!round?.leader && round.leader.toLowerCase() === address.toLowerCase()
  const leaderKey = round?.leader ? `${round.leader}-${round.bestScore}` : 'none'
  const frac = left !== undefined && roundDuration ? Math.min(1, left / roundDuration) : 0
  const waiting = !round && loading

  return (
    <section className="relative overflow-hidden rounded-3xl" style={glass.card}>
      <div className="h-[3px]" style={{ background: SPECTRAL }} />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-10 top-0 size-44 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(133,177,237,0.35) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest" style={{ ...glass.pill, color: 'var(--ink-2)' }}>
              {round ? `Round ${round.id.toString()}` : 'Round'}
            </span>
            {!ended && round && (
              <span className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'var(--success)' }}>
                <span className="live-dot size-1.5 rounded-full" style={{ background: 'var(--success)' }} />
                Live
              </span>
            )}
          </div>

          <motion.div
            className="flex items-center gap-2 rounded-full px-3 py-1.5"
            style={glass.pill}
            animate={urgent ? { boxShadow: ['0 0 0 0 rgba(186,43,76,0.35)', '0 0 0 8px rgba(186,43,76,0)'] } : { boxShadow: '0 0 0 0 rgba(186,43,76,0)' }}
            transition={urgent ? { duration: 1.2, repeat: Infinity, ease: 'easeOut' } : { duration: 0.2 }}
          >
            <Timer className="size-3.5" style={{ color: ended || urgent ? 'var(--danger)' : 'var(--subtle)' }} />
            <span className="display text-base font-bold tabular-nums" style={{ color: ended || urgent ? 'var(--danger)' : 'var(--ink)' }}>
              {left === undefined ? '--:--' : ended ? 'Ended' : formatClock(left)}
            </span>
          </motion.div>
        </div>

        <div className="mt-5 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
          Prize pot
        </div>
        <div className="mt-1.5 flex items-center gap-2.5">
          <TokenUSDC variant="branded" size={34} />
          {waiting ? (
            <div className="skeleton h-12 w-40" />
          ) : round ? (
            <RollingNumber
              value={Number(formatUsdc(round.pot))}
              decimals={decimalsFor(fee)}
              className="display text-5xl font-bold tabular-nums sm:text-6xl"
              style={{ color: 'var(--ink)' }}
            />
          ) : (
            <span className="display text-5xl font-bold tabular-nums" style={{ color: 'var(--subtle)' }}>
              0
            </span>
          )}
          <span className="mt-3 text-lg font-medium" style={{ color: 'var(--subtle)' }}>
            USDC
          </span>
          <AnimatePresence>
            {gain && (
              <motion.span
                key={gain.id}
                className="mt-1 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums"
                style={{ background: 'rgba(26,128,71,0.14)', color: 'var(--success)' }}
                initial={{ opacity: 0, y: 6, scale: 0.8 }}
                animate={{ opacity: [0, 1, 1, 0], y: [6, -4, -10, -22], scale: 1 }}
                transition={{ duration: 2.2, times: [0, 0.15, 0.7, 1] }}
              >
                +{formatUsdc(gain.amount)}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <p className="mt-1.5 text-xs text-pretty" style={{ color: failed ? 'var(--danger)' : 'var(--muted)' }}>
          {failed
            ? 'Could not reach the contract. Retrying.'
            : fee !== undefined
              ? `${formatUsdc(fee)} USDC per run. The farthest rider takes the whole pot.`
              : 'Reading the contract...'}
        </p>

        {/* Real remaining share of the round, from the contract's own clock */}
        <div className="mt-4 h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(18,45,69,0.09)' }} aria-hidden>
          <motion.div
            className="h-full w-full origin-left rounded-full"
            style={{ background: urgent || ended ? 'var(--danger)' : 'var(--accent)' }}
            animate={{ scaleX: frac }}
            transition={{ duration: 1, ease: 'linear' }}
          />
        </div>

        <div className="relative mt-4 overflow-hidden rounded-2xl px-4 py-3" style={glass.inner}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={leaderKey}
              className="flex w-full items-center justify-between gap-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <span className="flex min-w-0 items-center gap-2.5 text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>
                {round?.leader ? (
                  <Avatar address={round.leader} size={26} />
                ) : (
                  <span className="flex size-[26px] items-center justify-center rounded-full" style={{ background: 'rgba(18,45,69,0.07)' }}>
                    <Crown className="size-3.5" style={{ color: 'var(--subtle)' }} />
                  </span>
                )}
                <span className="truncate">
                  {round?.leader ? (youLead ? 'You are leading' : `Leader ${shortAddress(round.leader)}`) : 'No leader yet. Be first.'}
                </span>
              </span>
              <span className="display flex items-center gap-1 text-lg font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                {round?.leader && <Crown className="size-4" style={{ color: '#d9a21b' }} />}
                {round?.leader ? `${round.bestScore} pts` : '-'}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
