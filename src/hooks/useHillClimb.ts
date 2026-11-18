import { useAccount, useReadContracts } from 'wagmi'
import { erc20Abi, type Address } from 'viem'
import { CHAIN_ID, HILL_CLIMB_ADDRESS, USDC_ADDRESS, hillClimbAbi } from '@/lib/hillclimb'

const ZERO = '0x0000000000000000000000000000000000000000'
const HISTORY_LEN = 5n

export interface RoundInfo {
  id: bigint
  endTime: bigint
  pot: bigint
  bestScore: number
  leader: Address | null
}

/** Live pool, wallet, and history state, all read from the contract. */
export function useHillClimb() {
  const { address } = useAccount()
  const pot = { address: HILL_CLIMB_ADDRESS, abi: hillClimbAbi, chainId: CHAIN_ID } as const

  const pool = useReadContracts({
    contracts: [
      { ...pot, functionName: 'ENTRY_FEE' },
      { ...pot, functionName: 'currentRound' },
      { ...pot, functionName: 'timeLeft' },
      { ...pot, functionName: 'ROUND_DURATION' },
    ],
    query: { refetchInterval: 4000 },
  })

  const me = useReadContracts({
    contracts: address
      ? [
          { address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [address], chainId: CHAIN_ID },
          {
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [address, HILL_CLIMB_ADDRESS],
            chainId: CHAIN_ID,
          },
          { ...pot, functionName: 'runs', args: [address] },
          { ...pot, functionName: 'winningsOf', args: [address] },
        ]
      : [],
    query: { enabled: !!address, refetchInterval: 4000 },
  })

  const fee = pool.data?.[0]?.result
  const cur = pool.data?.[1]?.result
  const timeLeft = pool.data?.[2]?.result
  const roundDuration = pool.data?.[3]?.result

  const round: RoundInfo | undefined = cur
    ? {
        id: cur[0],
        endTime: cur[1],
        pot: cur[2],
        bestScore: cur[3],
        leader: cur[4] === ZERO ? null : cur[4],
      }
    : undefined

  const currentId = round?.id ?? 0n
  const first = currentId > HISTORY_LEN ? currentId - HISTORY_LEN : 1n
  const ids: bigint[] = []
  for (let id = currentId - 1n; id >= first; id--) ids.push(id)

  const past = useReadContracts({
    contracts: ids.map((id) => ({ ...pot, functionName: 'rounds' as const, args: [id] as const })),
    query: { enabled: ids.length > 0, refetchInterval: 12000 },
  })

  const history: RoundInfo[] = []
  ids.forEach((id, i) => {
    const r = past.data?.[i]?.result
    if (r) history.push({ id, endTime: r[0], pot: r[1], bestScore: r[2], leader: r[3] === ZERO ? null : r[3] })
  })

  const balance = me.data?.[0]?.result
  const allowance = me.data?.[1]?.result
  const run = me.data?.[2]?.result
  const winnings = me.data?.[3]?.result

  return {
    address,
    fee,
    round,
    /** Seconds left in the round at the moment of the last read. */
    timeLeft: timeLeft === undefined ? undefined : Number(timeLeft),
    roundDuration: roundDuration === undefined ? undefined : Number(roundDuration),
    fetchedAt: pool.dataUpdatedAt,
    balance,
    allowance,
    winnings,
    hasOpenRun: !!run && run[1] > 0n && run[0] === currentId,
    history,
    loading: pool.isLoading,
    failed: pool.isError,
    refetch: async () => {
      await Promise.all([pool.refetch(), me.refetch(), past.refetch()])
    },
  }
}

export type HillClimbData = ReturnType<typeof useHillClimb>
