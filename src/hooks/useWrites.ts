import { useCallback, useState } from 'react'
import { usePublicClient, useWriteContract } from 'wagmi'
import { erc20Abi, type Hash } from 'viem'
import { toast } from 'sonner'
import {
  ALLOWANCE_RUNS,
  CHAIN_ID,
  HILL_CLIMB_ADDRESS,
  USDC_ADDRESS,
  hillClimbAbi,
  parseOnchainError,
} from '@/lib/hillclimb'

export type TxPhase = 'idle' | 'wallet' | 'confirming'
export type TxLabel = 'approve' | 'start' | 'submit' | 'claim' | 'finalize'

/** One transaction at a time: wallet prompt, then a real receipt wait. */
export function useWrites(onSettled: () => Promise<void>) {
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient({ chainId: CHAIN_ID })
  const [phase, setPhase] = useState<TxPhase>('idle')
  const [label, setLabel] = useState<TxLabel | null>(null)
  const [hash, setHash] = useState<Hash | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async (kind: TxLabel, send: () => Promise<Hash>): Promise<Hash | null> => {
      setError(null)
      setLabel(kind)
      setPhase('wallet')
      try {
        const h = await send()
        setPhase('confirming')
        const receipt = await publicClient?.waitForTransactionReceipt({ hash: h })
        if (!receipt) throw new Error('RPC client unavailable')
        if (receipt.status !== 'success') throw new Error('Transaction reverted')
        setHash(h)
        await onSettled()
        return h
      } catch (e) {
        const msg = parseOnchainError(e)
        if (msg) {
          setError(msg)
          toast.error(msg)
        }
        return null
      } finally {
        setPhase('idle')
        setLabel(null)
      }
    },
    [publicClient, onSettled],
  )

  const base = { address: HILL_CLIMB_ADDRESS, abi: hillClimbAbi, chainId: CHAIN_ID } as const

  return {
    phase,
    label,
    hash,
    error,
    busy: phase !== 'idle',
    clearError: () => setError(null),
    approve: (fee: bigint) =>
      run('approve', () =>
        writeContractAsync({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: 'approve',
          args: [HILL_CLIMB_ADDRESS, fee * ALLOWANCE_RUNS],
          chainId: CHAIN_ID,
        }),
      ),
    startRun: () => run('start', () => writeContractAsync({ ...base, functionName: 'startRun' })),
    submitScore: (meters: number) =>
      run('submit', () => writeContractAsync({ ...base, functionName: 'submitScore', args: [meters] })),
    claim: () => run('claim', () => writeContractAsync({ ...base, functionName: 'claim' })),
    finalizeRound: () => run('finalize', () => writeContractAsync({ ...base, functionName: 'finalizeRound' })),
  }
}

export type Writes = ReturnType<typeof useWrites>
