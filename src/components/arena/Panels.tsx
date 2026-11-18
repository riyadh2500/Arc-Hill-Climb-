import { ConnectKitButton } from 'connectkit'
import { useAccount, useSwitchChain } from 'wagmi'
import { ExternalLink, Trophy } from 'lucide-react'
import { Confetti } from '@/components/Confetti'
import { RollingNumber } from '@/components/RollingNumber'
import { MAPS } from '@/game/maps'
import type { HillClimbData } from '@/hooks/useHillClimb'
import type { Writes } from '@/hooks/useWrites'
import { ALLOWANCE_RUNS, CHAIN_ID, glass } from '@/lib/hillclimb'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { formatUsdc } from '@/onchain-money'
import { Busy, GhostButton, PrimaryButton, REASONS, SuccessMark, Title, type RunResult } from './parts'

interface StartProps {
  data: HillClimbData
  writes: Writes
  onStart: () => void
  onStandings: () => void
}

/** The card shown before a run: connect, switch network, allow, then start. */
export function StartCard({ data, writes, onStart, onStandings }: StartProps) {
  const { isConnected, chainId } = useAccount()
  const { switchChain, isPending: switching } = useSwitchChain()
  const { fee, allowance, balance, round, timeLeft, hasOpenRun } = data
  const wrongChain = isConnected && chainId !== CHAIN_ID
  const needsAllow = fee !== undefined && allowance !== undefined && allowance < fee
  const lowBalance = fee !== undefined && balance !== undefined && balance < fee
  const roundEnded = timeLeft === 0

  if (!isConnected) {
    return (
      <>
        <Title title="Ride for the pot" sub="Connect a wallet to enter. Every run goes into the prize pot." />
        <ConnectKitButton.Custom>{({ show }) => <PrimaryButton onClick={() => show?.()}>Connect wallet</PrimaryButton>}</ConnectKitButton.Custom>
      </>
    )
  }
  if (wrongChain) {
    return (
      <>
        <Title title="Wrong network" sub="Arc Climb runs on Arc Testnet." />
        <PrimaryButton onClick={() => switchChain({ chainId: CHAIN_ID })} disabled={switching}>
          {switching ? 'Switching...' : 'Switch to Arc Testnet'}
        </PrimaryButton>
      </>
    )
  }
  return (
    <>
      <Title
        title={fee !== undefined ? `${formatUsdc(fee)} USDC per run` : 'Ride for the pot'}
        sub={roundEnded ? `Round ${round?.id.toString() ?? ''} has ended. Your next run opens the next round.` : 'Ride the farthest before the clock ends and take the whole pot.'}
      />
      {hasOpenRun && (
        <p className="rounded-xl px-3 py-2 text-center text-[11px]" style={{ ...glass.inner, color: 'var(--danger)' }}>
          You have an unsubmitted run. Starting a new one forfeits it.
        </p>
      )}
      {lowBalance ? (
        <PrimaryButton onClick={() => undefined} disabled>
          Not enough USDC. Use Get test USDC
        </PrimaryButton>
      ) : needsAllow && fee !== undefined ? (
        <>
          <PrimaryButton onClick={() => void writes.approve(fee)} disabled={writes.busy}>
            <Busy writes={writes} idle={`Allow ${ALLOWANCE_RUNS.toString()} runs`} />
          </PrimaryButton>
          <p className="text-center text-[11px]" style={{ color: 'var(--subtle)' }}>
            One-time approval of {formatUsdc(fee * ALLOWANCE_RUNS)} USDC for this game only.
          </p>
        </>
      ) : (
        <PrimaryButton onClick={onStart} disabled={writes.busy || fee === undefined}>
          <Busy writes={writes} idle={fee !== undefined ? `Start run for ${formatUsdc(fee)} USDC` : 'Loading...'} />
        </PrimaryButton>
      )}
      <p className="hidden text-center text-[11px] portrait:block sm:portrait:hidden" style={{ color: 'var(--subtle)' }}>
        Turn your phone sideways for the widest view.
      </p>
      <GhostButton onClick={onStandings}>
        <span className="inline-flex items-center gap-1.5">
          <Trophy className="size-3.5" /> Standings and winnings
        </span>
      </GhostButton>
    </>
  )
}

/** Shown when the bike stops: the score, then the one action that counts it onchain. */
export function ResultCard({ result, writes, onSubmit, onSkip }: { result: RunResult; writes: Writes; onSubmit: () => void; onSkip: () => void }) {
  const map = MAPS[result.mapId]
  return (
    <>
      <Title
        title={
          <>
            <RollingNumber value={result.score} from={0} decimals={0} /> pts
          </>
        }
        sub={`${REASONS[result.reason]}. ${result.distance} m on ${map.name}${map.scoreFactor < 1 ? `, x${map.scoreFactor.toFixed(2)}` : ''}. +${result.coins} coins${result.newBest ? '. New personal best!' : ''}`}
        big
      />
      <PrimaryButton onClick={onSubmit} disabled={writes.busy}>
        <Busy writes={writes} idle="Submit score onchain" />
      </PrimaryButton>
      <GhostButton onClick={onSkip} disabled={writes.busy}>
        <span style={{ color: 'var(--muted)' }}>Skip and forfeit this run</span>
      </GhostButton>
      <p className="text-center text-[11px]" style={{ color: 'var(--subtle)' }}>
        Submit before leaving the page. Your run is only counted once it is on chain.
      </p>
    </>
  )
}

interface DoneProps {
  result: RunResult
  data: HillClimbData
  hash: string | null
  youLead: boolean
  onAgain: () => void
}

export function SubmittedCard({ result, data, hash, youLead, onAgain }: DoneProps) {
  const best = data.round?.bestScore ?? result.score
  return (
    <>
      {youLead && <Confetti />}
      <SuccessMark />
      <Title
        title={youLead ? 'You lead the round' : `${result.score} pts recorded`}
        sub={youLead ? `Best so far: ${best} pts` : `Leader needs ${data.round?.bestScore ?? 0} pts to beat`}
        big
      />
      {hash && (
        <a
          href={buildTxExplorerUrl(CHAIN_ID, hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-xs font-semibold"
          style={{ color: 'var(--accent-hover)' }}
        >
          View on explorer <ExternalLink className="size-3" />
        </a>
      )}
      <PrimaryButton onClick={onAgain}>Ride again</PrimaryButton>
    </>
  )
}

export function StandingsCard({ onBack }: { onBack: () => void }) {
  return (
    <>
      <Title title="Round standings" sub="The pot, the leader, your winnings and past rounds." />
      <PrimaryButton onClick={onBack}>Back to the start</PrimaryButton>
    </>
  )
}
