import { useState, type ReactNode } from 'react'
import { useAccount } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { ArrowRight, Check, Loader2, Lock, Wallet } from 'lucide-react'
import { BikeArt } from '@/components/BikeArt'
import { Confetti } from '@/components/Confetti'
import { BIKES, MAX_BIKE_LEVEL, statBars } from '@/game/bikes'
import { formatUsdc } from '@/onchain-money'
import { glass } from '@/lib/hillclimb'
import type { GarageBike, GarageData } from '@/hooks/useGarage'

interface Props {
  garage: GarageData
  selectedId: number
  onSelect: (id: number) => void
  onNext: () => void
  /** Wallet USDC balance in raw units, for affordability hints. */
  balance: bigint | undefined
}

const BAR_LABELS = [
  ['power', 'Power'],
  ['speed', 'Top speed'],
  ['fuel', 'Fuel use'],
  ['air', 'Air control'],
  ['stability', 'Stability'],
] as const

function StatBars({ id, level }: { id: number; level: number }) {
  const bars = statBars(id, level)
  return (
    <div className="space-y-1.5">
      {BAR_LABELS.map(([key, label]) => (
        <div key={key} className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--subtle)' }}>
            {label}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'rgba(18,45,69,0.09)' }}>
            <motion.div
              className="h-full origin-left rounded-full"
              style={{ background: 'var(--accent)' }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: Math.max(0.06, bars[key]) }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function Pips({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Upgrade level ${level} of ${MAX_BIKE_LEVEL}`}>
      {Array.from({ length: MAX_BIKE_LEVEL }, (_, i) => (
        <motion.span
          key={`${i}-${i < level}`}
          className="h-1.5 w-5 rounded-full"
          style={{ background: i < level ? 'var(--success)' : 'rgba(18,45,69,0.12)' }}
          initial={i < level ? { scaleX: 0.3, scaleY: 2.4 } : false}
          animate={{ scaleX: 1, scaleY: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 16 }}
        />
      ))}
      <span className="ml-1 text-[10px] font-bold tabular-nums" style={{ color: 'var(--muted)' }}>
        Lv {level}
      </span>
    </div>
  )
}

function ActionButton(props: { onClick: () => void; disabled?: boolean; tone?: 'primary' | 'ghost'; children: ReactNode }) {
  const primary = props.tone !== 'ghost'
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      className={`${primary ? 'cta' : ''} min-h-11 w-full rounded-2xl px-4 text-sm font-semibold transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100`}
      style={primary ? { background: 'var(--accent)', color: '#fff' } : { ...glass.pill, color: 'var(--ink)' }}
    >
      {props.children}
    </button>
  )
}

function BikeCard({
  bike,
  index,
  selected,
  garage,
  balance,
  onSelect,
}: {
  bike: GarageBike
  index: number
  selected: boolean
  garage: GarageData
  balance: bigint | undefined
  onSelect: (id: number) => void
}) {
  const { isConnected } = useAccount()
  const def = BIKES[bike.id]

  // 3D tilt that follows the pointer.
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const sx = useSpring(px, { stiffness: 220, damping: 20 })
  const sy = useSpring(py, { stiffness: 220, damping: 20 })
  const rotY = useTransform(sx, (v) => v * 7)
  const rotX = useTransform(sy, (v) => v * -7)

  const [hov, setHov] = useState(false)

  // Celebrate the moment a purchase lands.
  const [wasOwned, setWasOwned] = useState(bike.owned)
  const [unlock, setUnlock] = useState(0)
  if (bike.owned !== wasOwned) {
    setWasOwned(bike.owned)
    if (bike.owned && !wasOwned) setUnlock((u) => u + 1)
  }

  const mine = garage.action?.bikeId === bike.id ? garage.action : null
  const busyText = mine
    ? mine.phase === 'wallet'
      ? 'Confirm in wallet...'
      : mine.kind === 'approve'
        ? 'Approving USDC...'
        : 'Confirming...'
    : null
  const spinner = (text: string) => (
    <span className="flex items-center justify-center gap-2">
      <Loader2 className="size-4 animate-spin" /> {text}
    </span>
  )

  const buyCost = bike.price
  const needBuy = !bike.owned && buyCost !== undefined
  const cantAffordBuy = needBuy && balance !== undefined && balance < buyCost
  const cantAffordUp = bike.upgradeCost !== null && balance !== undefined && balance < bike.upgradeCost

  let primary: ReactNode
  if (!bike.owned) {
    primary = !isConnected ? (
      <ConnectKitButton.Custom>
        {({ show }) => (
          <ActionButton onClick={() => show?.()}>
            <span className="flex items-center justify-center gap-2">
              <Wallet className="size-4" /> Connect to buy
            </span>
          </ActionButton>
        )}
      </ConnectKitButton.Custom>
    ) : (
      <ActionButton onClick={() => buyCost !== undefined && void garage.buy(bike.id, buyCost)} disabled={garage.busy || buyCost === undefined || cantAffordBuy}>
        {busyText && garage.action?.kind !== 'upgrade'
          ? spinner(busyText)
          : cantAffordBuy
            ? `Need ${formatUsdc(buyCost ?? 0n)} USDC`
            : buyCost === undefined
              ? 'Loading...'
              : `Buy for ${formatUsdc(buyCost)} USDC`}
      </ActionButton>
    )
  } else if (selected) {
    primary = (
      <div className="flex min-h-11 items-center justify-center gap-1.5 rounded-2xl text-sm font-bold" style={{ background: 'rgba(26,128,71,0.13)', color: 'var(--success)' }}>
        <Check className="size-4" /> Selected
      </div>
    )
  } else {
    primary = (
      <ActionButton onClick={() => onSelect(bike.id)} disabled={garage.busy}>
        Select this bike
      </ActionButton>
    )
  }

  return (
    <motion.article
      className="relative flex flex-col gap-3 overflow-hidden rounded-3xl p-4"
      style={{ ...glass.card, outline: selected ? '2px solid var(--accent)' : 'none', outlineOffset: -2, rotateX: rotX, rotateY: rotY, transformPerspective: 900 }}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6 }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        px.set(((e.clientX - r.left) / r.width - 0.5) * 2)
        py.set(((e.clientY - r.top) / r.height - 0.5) * 2)
      }}
      onPointerEnter={() => setHov(true)}
      onPointerLeave={() => {
        px.set(0)
        py.set(0)
        setHov(false)
      }}
    >
      {unlock > 0 && (
        <>
          <Confetti key={`c${unlock}`} count={34} />
          <motion.div
            key={`b${unlock}`}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-10 z-10 mx-auto w-fit rounded-full px-4 py-1.5 text-sm font-bold"
            style={{ background: 'var(--success)', color: '#fff', boxShadow: '0 8px 24px rgba(26,128,71,0.4)' }}
            initial={{ scale: 0, rotate: -12, opacity: 0 }}
            animate={{ scale: [0, 1.25, 1, 1], rotate: [-12, 4, 0, 0], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 2.4, times: [0, 0.18, 0.3, 1] }}
          >
            Unlocked!
          </motion.div>
        </>
      )}
      <div className="relative overflow-hidden rounded-2xl px-2 py-3" style={{ ...glass.inner, background: `linear-gradient(160deg, rgba(255,255,255,0.7), ${def.look.tank}22)` }}>
        <BikeArt bikeId={bike.id} spin={selected || hov} className="mx-auto h-24 w-full" />
        {!bike.owned && (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ ...glass.pill, color: 'var(--muted)' }}>
            <Lock className="size-3" /> Locked
          </span>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="display text-lg font-bold" style={{ color: 'var(--ink)' }}>
            {def.name}
          </h3>
          {bike.owned ? <Pips level={bike.level} /> : (
            <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
              {buyCost !== undefined ? `${formatUsdc(buyCost)} USDC` : '...'}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-pretty" style={{ color: 'var(--muted)' }}>
          {def.tagline}
        </p>
      </div>

      <StatBars id={bike.id} level={bike.level} />

      <div className="mt-auto space-y-2 pt-1">
        {primary}
        {bike.owned && bike.upgradeCost !== null && (
          <ActionButton tone="ghost" onClick={() => bike.upgradeCost !== null && void garage.upgrade(bike.id, bike.upgradeCost)} disabled={garage.busy || cantAffordUp}>
            {busyText && garage.action?.kind !== 'buy'
              ? spinner(busyText)
              : cantAffordUp
                ? `Need ${formatUsdc(bike.upgradeCost)} USDC to upgrade`
                : `Upgrade to Lv ${bike.level + 1} for ${formatUsdc(bike.upgradeCost)} USDC`}
          </ActionButton>
        )}
        {bike.owned && bike.upgradeCost === null && bike.level >= MAX_BIKE_LEVEL && (
          <div className="text-center text-[11px] font-semibold" style={{ color: 'var(--success)' }}>
            Fully upgraded
          </div>
        )}
      </div>
    </motion.article>
  )
}

export function Garage({ garage, selectedId, onSelect, onNext, balance }: Props) {
  const { isConnected } = useAccount()
  const selected = garage.bikes[selectedId] ?? garage.bikes[0]
  const def = BIKES[selected.id]

  return (
    <div className="space-y-4">
      <motion.section
        className="relative overflow-hidden rounded-3xl p-5 sm:p-6"
        style={glass.card}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="h-[3px] absolute inset-x-0 top-0" style={{ background: 'linear-gradient(90deg, #5fbeff, #af8ff4, #f05c6b, #ffcd83, #7ef1b3)' }} />
        <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,260px)_1fr]">
          <div className="relative">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.span
                key={`${selected.id}-${i}`}
                aria-hidden
                className="pointer-events-none absolute bottom-[18%] left-[20%] rounded-full"
                style={{ width: 16 + i * 4, height: 16 + i * 4, background: 'rgba(255,255,255,0.8)', filter: 'blur(3px)' }}
                initial={{ opacity: 0.8, x: 0, y: 0, scale: 0.4 }}
                animate={{ opacity: 0, x: -50 - i * 14, y: -10 - i * 6, scale: 1.8 }}
                transition={{ duration: 0.8, delay: i * 0.04, ease: 'easeOut' }}
              />
            ))}
            <motion.div key={selected.id} initial={{ opacity: 0, x: -90, rotate: -6 }} animate={{ opacity: 1, x: 0, rotate: 0 }} transition={{ type: 'spring', stiffness: 190, damping: 17 }}>
              <BikeArt bikeId={selected.id} spin className="w-full" />
            </motion.div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--success)' }}>
              <Check className="size-4" /> {def.name} selected
            </div>
            <h2 className="display mt-1 text-3xl font-bold text-balance sm:text-4xl" style={{ color: 'var(--ink)' }}>
              Step 1: pick your bike
            </h2>
            <p className="mt-1 max-w-md text-sm text-pretty" style={{ color: 'var(--muted)' }}>
              {isConnected
                ? 'Your garage is saved to your wallet address. Connect the same wallet anywhere and your bikes and upgrades are back.'
                : 'Connect a wallet to load your garage. The free ARC Bike is ready to ride either way.'}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Pips level={selected.level} />
            </div>
            <button
              onClick={onNext}
              className="cta mt-4 flex min-h-12 items-center gap-2 rounded-2xl px-6 text-sm font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'var(--accent)' }}
            >
              Next: choose a map <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </motion.section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {garage.bikes.map((b, i) => (
          <BikeCard key={b.id} bike={b} index={i} selected={b.id === selectedId} garage={garage} balance={balance} onSelect={onSelect} />
        ))}
      </div>

      {garage.error && (
        <p className="text-center text-xs font-semibold" style={{ color: 'var(--danger)' }}>
          {garage.error}
        </p>
      )}
    </div>
  )
}
