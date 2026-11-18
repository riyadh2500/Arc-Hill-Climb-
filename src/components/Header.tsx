import { ConnectKitButton } from 'connectkit'
import { motion } from 'framer-motion'
import { Coins, Mountain } from 'lucide-react'
import { SoundButton } from '@/components/SoundButton'
import { TokenUSDC } from '@web3icons/react'
import { formatUsdc } from '@/lib/usdc'
import { glass, shortAddress } from '@/lib/hillclimb'
import { RollingNumber } from '@/components/RollingNumber'

export function Header({ balance, coins, onHome }: { balance?: bigint; coins: number; onHome: () => void }) {
  return (
    <header className="flex items-center justify-between gap-3">
      <button onClick={onHome} aria-label="Back to the start screen" className="flex items-center gap-2.5 text-left">
        <motion.div
          className="flex size-9 items-center justify-center rounded-xl"
          style={{ background: 'var(--accent)', color: '#fff' }}
          whileHover={{ rotate: -8, scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
        >
          <Mountain className="size-5" />
        </motion.div>
        <div className="leading-tight">
          <div className="display text-lg font-bold" style={{ color: 'var(--ink)' }}>
            Arc Climb
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: 'var(--muted)' }}>
            <span className="live-dot size-1.5 rounded-full" style={{ background: 'var(--success)' }} />
            Arc Testnet
          </div>
        </div>
      </button>

      <div className="flex items-center gap-2">
        <SoundButton />
        <div className="flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold tabular-nums" style={{ ...glass.pill, color: 'var(--ink)' }} title="Coins you collected while riding">
          <Coins className="size-4" style={{ color: '#d9a21b' }} />
          <RollingNumber value={coins} decimals={0} />
        </div>
      <ConnectKitButton.Custom>
        {({ isConnected, isConnecting, show, address }) => (
          <motion.button
            onClick={show}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex min-h-11 items-center gap-2 rounded-full px-4 text-xs font-semibold"
            style={isConnected ? { ...glass.pill, color: 'var(--ink)' } : { background: 'var(--accent)', color: '#fff' }}
          >
            {isConnected && address ? (
              <>
                {balance !== undefined && (
                  <span className="flex items-center gap-1 tabular-nums">
                    <TokenUSDC variant="branded" size={16} />
                    <RollingNumber value={Number(formatUsdc(balance))} decimals={2} />
                  </span>
                )}
                <span className="mono" style={{ color: 'var(--muted)' }}>
                  {shortAddress(address)}
                </span>
              </>
            ) : isConnecting ? (
              'Connecting...'
            ) : (
              'Connect wallet'
            )}
          </motion.button>
        )}
      </ConnectKitButton.Custom>
      </div>
    </header>
  )
}
