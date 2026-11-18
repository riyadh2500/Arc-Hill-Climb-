import { ArrowLeft, Coins, Maximize2, Minimize2 } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { BikeArt } from '@/components/BikeArt'
import { SoundButton } from '@/components/SoundButton'
import { BIKES } from '@/game/bikes'
import { MAPS } from '@/game/maps'
import { exitFullscreen, enterFullscreen, useIsFullscreen } from '@/lib/fullscreen'
import { glass } from '@/lib/hillclimb'
import { formatUsdc } from '@/lib/usdc'

const chip = { ...glass.pill, background: 'rgba(255,255,255,0.78)', color: 'var(--ink)' }

export function FullscreenButton() {
  const on = useIsFullscreen()
  return (
    <button
      onClick={() => void (on ? exitFullscreen() : enterFullscreen())}
      aria-label={on ? 'Exit full screen' : 'Enter full screen'}
      className="flex size-11 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95"
      style={chip}
    >
      {on ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
    </button>
  )
}

interface Props {
  bike: { id: number; level: number }
  mapId: number
  best: number
  coins: number
  balance: bigint | undefined
  onBack: () => void
  onChangeBike: () => void
}

/** Slim bar over the game while you are not riding. Hidden during the countdown and the run. */
export function TopBar({ bike, mapId, best, coins, balance, onBack, onChangeBike }: Props) {
  return (
    <div className="absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-[max(1rem,env(safe-area-inset-top))] pb-0">
      <div className="flex min-w-0 items-center gap-2">
        <button onClick={onBack} className="flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold" style={chip}>
          <ArrowLeft className="size-4" /> Maps
        </button>
        <button onClick={onChangeBike} className="flex min-h-11 min-w-0 items-center gap-2 rounded-full py-1 pl-2 pr-4 text-left" style={chip}>
          <BikeArt bikeId={bike.id} className="h-8 w-14 shrink-0" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-xs font-bold">
              {BIKES[bike.id].name} <span style={{ color: 'var(--success)' }}>Lv {bike.level}</span>
            </span>
            <span className="block truncate text-[11px]" style={{ color: 'var(--muted)' }}>
              {MAPS[mapId].name}
              {best > 0 ? ` - best ${best}` : ''}
            </span>
          </span>
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden min-h-11 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold tabular-nums sm:flex" style={chip}>
          <Coins className="size-4" style={{ color: '#d9a21b' }} />
          {coins}
        </span>
        {balance !== undefined && (
          <span className="hidden min-h-11 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold tabular-nums sm:flex" style={chip}>
            <TokenUSDC variant="branded" size={16} />
            {Number(formatUsdc(balance)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        )}
        <SoundButton />
        <FullscreenButton />
      </div>
    </div>
  )
}
