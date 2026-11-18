import type { CSSProperties } from 'react'
import { parseAbi, type Address } from 'viem'
import { arcTestnet } from 'viem/chains'
import { getUsdc } from '@/onchain-facts'

export const CHAIN_ID = arcTestnet.id

export const HILL_CLIMB_ADDRESS = import.meta.env.VITE_HILL_CLIMB_ADDRESS as Address

const usdcFact = getUsdc(CHAIN_ID)
if (!usdcFact) throw new Error(`USDC is not registered for chain ${CHAIN_ID}`)
export const USDC_ADDRESS = usdcFact.address as Address

/** How many runs one "Allow" covers. */
export const ALLOWANCE_RUNS = 10n

export const hillClimbAbi = parseAbi([
  'function ENTRY_FEE() view returns (uint256)',
  'function ROUND_DURATION() view returns (uint256)',
  'function currentRound() view returns (uint256 id, uint64 endTime, uint256 pot, uint32 bestScore, address leader)',
  'function rounds(uint256) view returns (uint64 endTime, uint256 pot, uint32 bestScore, address leader)',
  'function runs(address) view returns (uint64 roundId, uint64 startedAt)',
  'function winningsOf(address) view returns (uint256)',
  'function timeLeft() view returns (uint256)',
  'function startRun()',
  'function submitScore(uint32 distanceMeters)',
  'function claim()',
  'function finalizeRound()',
  'error RoundNotEnded()',
  'error NoActiveRun()',
  'error RunNotInCurrentRound()',
  'error RunExpired()',
  'error ImplausibleScore()',
  'error NothingToClaim()',
])

export const shortAddress = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

/** Returns a friendly message, or null when the user simply cancelled in their wallet. */
export function parseOnchainError(error: unknown): string | null {
  const raw = error instanceof Error ? error.message : String(error)
  const m = raw.toLowerCase()
  if (m.includes('user rejected') || m.includes('user denied') || (error as { code?: number })?.code === 4001) {
    return null
  }
  if (m.includes('runnotincurrentround')) return "The round ended before your score landed. Your fee stays in that round's pot."
  if (m.includes('runexpired')) return 'That run took too long to submit and has expired.'
  if (m.includes('implausiblescore')) return 'The contract rejected that distance as too fast for the elapsed time.'
  if (m.includes('noactiverun')) return 'No active run found. Start a new run.'
  if (m.includes('nothingtoclaim')) return 'Nothing to claim yet.'
  if (m.includes('roundnotended')) return 'The round is still running.'
  if (m.includes('insufficient funds') || m.includes('exceeds balance') || m.includes('transfer amount exceeds')) {
    return 'Not enough USDC. Use "Get test USDC" in the sidebar, then try again.'
  }
  if (m.includes('chain mismatch') || m.includes('does not match the target chain')) return 'Switch to Arc Testnet and try again.'
  if (m.includes('reverted')) return 'The transaction was reverted. Please try again.'
  if (m.includes('network') || m.includes('timeout') || m.includes('fetch')) return 'Network issue. Check your connection and retry.'
  return 'Something went wrong. Please try again.'
}

export const glass = {
  card: {
    background: 'rgba(255,255,255,0.64)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.68)',
    boxShadow: '0 8px 32px rgba(18,45,69,0.08), inset 0 1px 0 rgba(255,255,255,0.55)',
  } as CSSProperties,
  inner: {
    background: 'rgba(255,255,255,0.46)',
    border: '1px solid rgba(255,255,255,0.56)',
  } as CSSProperties,
  pill: {
    background: 'rgba(255,255,255,0.58)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.66)',
  } as CSSProperties,
}
