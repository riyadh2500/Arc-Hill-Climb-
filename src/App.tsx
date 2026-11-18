import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAccount } from 'wagmi'
import { Check } from 'lucide-react'
import { Header } from '@/components/Header'
import { Landing } from '@/components/Landing'
import { Garage } from '@/components/Garage'
import { MapStep } from '@/components/MapStep'
import { Arena } from '@/components/Arena'
import { useHillClimb } from '@/hooks/useHillClimb'
import { useWrites } from '@/hooks/useWrites'
import { useGarage } from '@/hooks/useGarage'
import { useStoredNumber, walletKey } from '@/hooks/useStored'
import { CHAIN_ID, glass } from '@/lib/hillclimb'
import { MAPS } from '@/game/maps'
import { exitFullscreen } from '@/lib/fullscreen'

type Screen = 'landing' | 'bike' | 'map' | 'ride'

const STEPS: { id: Exclude<Screen, 'landing'>; label: string }[] = [
  { id: 'bike', label: 'Bike' },
  { id: 'map', label: 'Map' },
  { id: 'ride', label: 'Ride' },
]

function Stepper({ screen, onGo }: { screen: Exclude<Screen, 'landing'>; onGo: (s: Screen) => void }) {
  const current = STEPS.findIndex((s) => s.id === screen)
  return (
    <nav aria-label="Progress" className="mt-4 flex items-center justify-center gap-2">
      {STEPS.map((s, i) => {
        const done = i < current
        const on = i === current
        return (
          <div key={s.id} className="flex items-center gap-2">
            <button
              onClick={() => done && onGo(s.id)}
              disabled={!done}
              aria-current={on ? 'step' : undefined}
              className="flex min-h-11 items-center gap-2 rounded-full px-3.5 text-xs font-bold transition-transform enabled:hover:scale-[1.04] disabled:cursor-default"
              style={
                on
                  ? { background: 'var(--accent)', color: '#fff' }
                  : done
                    ? { ...glass.pill, color: 'var(--success)' }
                    : { ...glass.pill, color: 'var(--subtle)' }
              }
            >
              <span className="flex size-5 items-center justify-center rounded-full text-[10px]" style={{ background: on ? 'rgba(255,255,255,0.2)' : 'rgba(18,45,69,0.07)' }}>
                {done ? <Check className="size-3" /> : i + 1}
              </span>
              {s.label}
            </button>
            {i < STEPS.length - 1 && <span className="h-px w-6 sm:w-10" style={{ background: done ? 'var(--success)' : 'rgba(18,45,69,0.15)' }} />}
          </div>
        )
      })}
    </nav>
  )
}

function Blob({ style, drift, duration }: { style: CSSProperties; drift: number; duration: number }) {
  return (
    <motion.div
      style={{ position: 'absolute', borderRadius: '50%', ...style }}
      animate={{ x: [0, drift, 0], y: [0, -drift * 0.6, 0] }}
      transition={{ duration, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

function Slide({ id, children }: { id: string; children: ReactNode }) {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, x: 36 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -36 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  const { address, isConnected, chainId } = useAccount()
  const data = useHillClimb()
  const writes = useWrites(data.refetch)
  const garage = useGarage()

  const [mapId, setMapId] = useStoredNumber('arc-climb-map', 0)
  const [storedBike, setStoredBike] = useStoredNumber(walletKey('arc-climb-bike', address), 0)
  const [coins, setCoins] = useStoredNumber(walletKey('arc-climb-coins', address), 0)
  const [best, setBest] = useStoredNumber(walletKey('arc-climb-best', address), 0)

  // A bike that this wallet does not own falls back to the free ARC Bike once the garage has loaded.
  const picked = garage.bikes[storedBike] ?? garage.bikes[0]
  const bike = picked.owned || garage.loading ? picked : garage.bikes[0]
  const safeMap = MAPS[mapId] ? mapId : 0

  const onRunEnd = useCallback(
    (earned: number, score: number) => {
      setCoins((c) => c + earned)
      setBest((b) => Math.max(b, score))
    },
    [setCoins, setBest],
  )

  useEffect(() => {
    if (screen !== 'ride') void exitFullscreen()
  }, [screen])

  if (screen === 'landing') return <Landing onEnter={() => setScreen('bike')} />

  const wrongChain = isConnected && chainId !== CHAIN_ID

  // The ride is full screen: no header, stepper or side panels. Pot, claim and standings show up after a run.
  if (screen === 'ride') {
    return (
      <Arena
        data={data}
        writes={writes}
        mapId={safeMap}
        bike={{ id: bike.id, level: bike.level }}
        coins={coins}
        best={best}
        wrongChain={wrongChain}
        onBack={() => setScreen('map')}
        onChangeBike={() => setScreen('bike')}
        onRunEnd={onRunEnd}
      />
    )
  }

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <Blob
          drift={40}
          duration={16}
          style={{ top: '6%', left: '3%', width: 340, height: 340, background: 'radial-gradient(circle, rgba(133,177,237,0.26) 0%, transparent 70%)', filter: 'blur(60px)' }}
        />
        <Blob
          drift={-36}
          duration={20}
          style={{ bottom: '6%', right: '4%', width: 320, height: 320, background: 'radial-gradient(circle, rgba(255,205,131,0.24) 0%, transparent 70%)', filter: 'blur(58px)' }}
        />
      </div>

      {/* light sweep every time the step changes */}
      <motion.div
        key={screen}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-40"
        style={{ background: 'linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.85) 50%, transparent 70%)' }}
        initial={{ x: '-110%' }}
        animate={{ x: '110%' }}
        transition={{ duration: 0.7, ease: [0.65, 0, 0.35, 1] }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-5 sm:px-6">
        <Header balance={data.balance} coins={coins} onHome={() => setScreen('landing')} />
        <Stepper screen={screen} onGo={setScreen} />

        <main className="mt-5">
          <AnimatePresence mode="wait" initial={false}>
            {screen === 'bike' && (
              <Slide id="bike">
                <Garage garage={garage} selectedId={bike.id} onSelect={setStoredBike} onNext={() => setScreen('map')} balance={data.balance} />
              </Slide>
            )}
            {screen === 'map' && (
              <Slide id="map">
                <MapStep mapId={safeMap} bikeId={bike.id} onChange={setMapId} onBack={() => setScreen('bike')} onNext={() => setScreen('ride')} />
              </Slide>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

