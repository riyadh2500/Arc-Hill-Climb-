import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { sfx } from '@/game/audio'
import { scoreFor } from '@/game/maps'
import type { EndReason } from '@/game/engine'
import type { HillClimbData } from '@/hooks/useHillClimb'
import type { Writes } from '@/hooks/useWrites'
import { enterFullscreen } from '@/lib/fullscreen'
import { glass } from '@/lib/hillclimb'
import { GameCanvas } from '@/components/GameCanvas'
import { PotHero } from '@/components/PotHero'
import { RoundsPanel } from '@/components/RoundsPanel'
import { SoundButton } from '@/components/SoundButton'
import { ResultCard, StandingsCard, StartCard, SubmittedCard } from '@/components/arena/Panels'
import { FullscreenButton, TopBar } from '@/components/arena/TopBar'
import type { Phase, RunResult } from '@/components/arena/parts'

interface ArenaProps {
  data: HillClimbData
  writes: Writes
  mapId: number
  bike: { id: number; level: number }
  coins: number
  best: number
  wrongChain: boolean
  /** Back to the map step. */
  onBack: () => void
  onChangeBike: () => void
  /** Called once per finished run with the coins picked up and the score. */
  onRunEnd: (coins: number, score: number) => void
}

const sheetCard = { ...glass.card, background: 'rgba(255,255,255,0.9)' }

/** The ride step: the game owns the whole screen. Pot, claim and standings only appear once a run is over. */
export function Arena({ data, writes, mapId, bike, coins, best, wrongChain, onBack, onChangeBike, onRunEnd }: ArenaProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [runKey, setRunKey] = useState(0)
  const [result, setResult] = useState<RunResult | null>(null)
  const [submitHash, setSubmitHash] = useState<string | null>(null)
  const [count, setCount] = useState(3)

  const { round, address } = data
  const youLead = !!address && !!round?.leader && round.leader.toLowerCase() === address.toLowerCase()

  // Map and bike stay fixed through a run, so these are what was ridden.
  const onFinish = useCallback(
    (distance: number, reason: EndReason, earned: number) => {
      const score = scoreFor(mapId, distance)
      setResult({ distance, score, reason, mapId, coins: earned, newBest: score > best && score > 0 })
      setPhase('finished')
      onRunEnd(earned, score)
    },
    [mapId, onRunEnd, best],
  )

  const start = async () => {
    const h = await writes.startRun()
    if (!h) return
    setResult(null)
    setSubmitHash(null)
    setCount(3)
    setPhase('countdown')
  }

  // 3-2-1 before the bike is released. Pure feel: the run was already paid for onchain.
  useEffect(() => {
    if (phase !== 'countdown') return
    sfx.beep(false)
    const t = setTimeout(() => {
      if (count > 1) {
        setCount(count - 1)
      } else {
        sfx.beep(true)
        setRunKey((k) => k + 1)
        setPhase('playing')
      }
    }, 750)
    return () => clearTimeout(t)
  }, [phase, count])

  const submit = async () => {
    if (!result) return
    const h = await writes.submitScore(result.score)
    if (!h) return
    setSubmitHash(h)
    setPhase('submitted')
    sfx.success()
  }

  useEffect(() => {
    document.documentElement.dataset.ride = '1'
    return () => {
      delete document.documentElement.dataset.ride
    }
  }, [])

  const riding = phase === 'countdown' || phase === 'playing'
  const sheet = phase === 'finished' || phase === 'submitted' || phase === 'standings'

  return (
    <div className="fixed inset-0 z-40 overflow-hidden" style={{ background: '#9fd0f5' }}>
      <GameCanvas runKey={runKey} mapId={mapId} bikeId={bike.id} bikeLevel={bike.level} hud={phase === 'playing'} onFinish={onFinish}>
        {(phase === 'idle' || phase === 'submitted' || phase === 'standings') && (
          <TopBar bike={bike} mapId={mapId} best={best} coins={coins} balance={data.balance} onBack={onBack} onChangeBike={onChangeBike} />
        )}
        {riding && (
          <div className="absolute left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-20 flex -translate-x-1/2 gap-2">
            <SoundButton />
            <FullscreenButton />
          </div>
        )}

        <AnimatePresence>
          {phase === 'idle' && (
            <motion.div
              key="start"
              className="absolute inset-0 z-10 flex items-center justify-center p-4"
              style={{ background: 'rgba(18,45,69,0.18)', backdropFilter: 'blur(3px)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="flex w-full max-w-sm flex-col gap-3 rounded-3xl p-5"
                style={sheetCard}
                initial={{ y: 16, scale: 0.98 }}
                animate={{ y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              >
                <div className="stagger flex flex-col gap-3">
                  <StartCard
                    data={data}
                    writes={writes}
                    onStart={() => {
                      void enterFullscreen()
                      void start()
                    }}
                    onStandings={() => setPhase('standings')}
                  />
                </div>
              </motion.div>
            </motion.div>
          )}

          {sheet && (
            <motion.div
              key="sheet"
              className="absolute inset-0 z-20 overflow-y-auto"
              style={{ background: 'rgba(18,45,69,0.38)', backdropFilter: 'blur(6px)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mx-auto flex min-h-full max-w-5xl items-start p-4 pb-10 pt-[5.5rem] md:items-center">
                <div className="grid w-full gap-4 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
                  <motion.div
                    className="flex flex-col gap-3 self-start rounded-3xl p-5 md:sticky md:top-24"
                    style={sheetCard}
                    initial={{ y: 24, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                  >
                    <div key={phase} className={`stagger flex flex-col gap-3 ${phase === 'finished' && result?.reason === 'crash' ? 'shake-once' : ''}`}>
                      {phase === 'finished' && result ? (
                        <ResultCard result={result} writes={writes} onSubmit={() => void submit()} onSkip={() => setPhase('idle')} />
                      ) : phase === 'submitted' && result ? (
                        <SubmittedCard result={result} data={data} hash={submitHash} youLead={youLead} onAgain={() => setPhase('idle')} />
                      ) : (
                        <StandingsCard onBack={() => setPhase('idle')} />
                      )}
                    </div>
                  </motion.div>
                  <motion.div
                    className="min-w-0 space-y-4"
                    initial={{ y: 24, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.08 }}
                  >
                    <PotHero data={data} />
                    <RoundsPanel data={data} writes={writes} onWrongChain={wrongChain} />
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === 'countdown' && (
            <motion.div
              key="countdown"
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              style={{ background: 'rgba(18,45,69,0.12)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={count}
                  className="display text-9xl font-bold tabular-nums"
                  style={{ color: '#fff', textShadow: '0 6px 30px rgba(18,45,69,0.45)' }}
                  initial={{ scale: 1.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 24 }}
                >
                  {count}
                </motion.span>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </GameCanvas>
    </div>
  )
}
