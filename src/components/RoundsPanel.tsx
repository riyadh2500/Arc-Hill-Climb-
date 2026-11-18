import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, Trophy } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { Confetti } from '@/components/Confetti'
import { RollingNumber } from '@/components/RollingNumber'
import { formatUsdc } from '@/lib/usdc'
import { glass, shortAddress } from '@/lib/hillclimb'
import type { HillClimbData } from '@/hooks/useHillClimb'
import type { Writes } from '@/hooks/useWrites'

export function RoundsPanel({ data, writes, onWrongChain }: { data: HillClimbData; writes: Writes; onWrongChain: boolean }) {
  const { winnings, history, address } = data
  const claimable = winnings !== undefined && winnings > 0n
  const claiming = writes.label === 'claim' && writes.busy

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {claimable && (
          <motion.section
            key="claim"
            className="relative overflow-hidden rounded-3xl"
            style={glass.card}
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          >
            <Confetti count={22} />
            <div className="h-1" style={{ background: 'linear-gradient(90deg, #5fbeff, #af8ff4, #f05c6b, #ffcd83, #7ef1b3)' }} />
            <div className="flex items-center justify-between gap-3 p-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--success)' }}>
              You won
            </div>
            <div className="display text-3xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
              <RollingNumber value={Number(formatUsdc(winnings))} from={0} decimals={2} />{' '}
              <span className="text-base font-medium" style={{ color: 'var(--subtle)' }}>
                USDC
              </span>
            </div>
          </div>
          <button
            disabled={writes.busy || onWrongChain}
            onClick={() => void writes.claim()}
            className="min-h-11 rounded-2xl px-5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'var(--accent)' }}
          >
            {claiming ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> {writes.phase === 'wallet' ? 'Confirm in wallet' : 'Confirming'}
              </span>
            ) : (
              'Claim'
            )}
          </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <section className="rounded-3xl p-4" style={glass.card}>
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
          <Trophy className="size-3.5" /> Past rounds
        </div>
        {history.length === 0 ? (
          <p className="py-3 text-sm" style={{ color: 'var(--subtle)' }}>
            No finished rounds yet. The first winner lands here.
          </p>
        ) : (
          <ul className="space-y-1.5">
            <AnimatePresence initial={false}>
              {history.map((r, i) => {
                const mine = !!address && !!r.leader && r.leader.toLowerCase() === address.toLowerCase()
                return (
                  <motion.li
                    key={r.id.toString()}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.25 }}
                    className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
                    style={mine ? { background: 'rgba(26,128,71,0.1)', border: '1px solid rgba(26,128,71,0.22)' } : glass.inner}
                  >
                    {r.leader ? (
                      <Avatar address={r.leader} size={30} />
                    ) : (
                      <span className="size-[30px] shrink-0 rounded-full" style={{ background: 'rgba(18,45,69,0.08)' }} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                        {r.leader ? (mine ? 'You won' : shortAddress(r.leader)) : 'No winner'}
                      </div>
                      <div className="text-[11px]" style={{ color: 'var(--subtle)' }}>
                        Round {r.id.toString()}
                        {r.leader ? ` - ${r.bestScore} pts` : ', pot carried over'}
                      </div>
                    </div>
                    <span className="display text-sm font-bold tabular-nums" style={{ color: r.leader ? 'var(--success)' : 'var(--subtle)' }}>
                      {formatUsdc(r.pot)}
                      <span className="ml-1 text-[10px] font-semibold" style={{ color: 'var(--subtle)' }}>
                        USDC
                      </span>
                    </span>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </div>
  )
}
