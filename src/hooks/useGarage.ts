import { useCallback, useState } from 'react'
import { useAccount, usePublicClient, useReadContracts, useWriteContract } from 'wagmi'
import { erc20Abi, parseAbi, type Address, type Hash } from 'viem'
import { toast } from 'sonner'
import { BIKES, MAX_BIKE_LEVEL } from '@/game/bikes'
import { CHAIN_ID, USDC_ADDRESS, parseOnchainError } from '@/lib/hillclimb'

export const GARAGE_ADDRESS = import.meta.env.VITE_ARC_CLIMB_GARAGE_ADDRESS as Address

export const garageAbi = parseAbi([
  'function priceOf(uint256 bikeId) view returns (uint256)',
  'function upgradeStepOf(uint256 bikeId) view returns (uint256)',
  'function garageOf(address player) view returns (bool[] owned, uint8[] levels)',
  'function buyBike(uint256 bikeId)',
  'function upgradeBike(uint256 bikeId)',
])

export interface GarageBike {
  id: number
  price: bigint | undefined
  step: bigint | undefined
  owned: boolean
  level: number
  /** Cost of the next upgrade, or null when maxed or unknown. */
  upgradeCost: bigint | null
}

type Action = { kind: 'buy' | 'upgrade' | 'approve'; bikeId: number }

/** Wallet-bound garage: whatever you bought stays with the address, on any device. */
export function useGarage() {
  const { address } = useAccount()
  const publicClient = usePublicClient({ chainId: CHAIN_ID })
  const { writeContractAsync } = useWriteContract()
  const base = { address: GARAGE_ADDRESS, abi: garageAbi, chainId: CHAIN_ID } as const

  const catalogue = useReadContracts({
    contracts: BIKES.flatMap((b) => [
      { ...base, functionName: 'priceOf' as const, args: [BigInt(b.id)] as const },
      { ...base, functionName: 'upgradeStepOf' as const, args: [BigInt(b.id)] as const },
    ]),
    query: { staleTime: Infinity },
  })

  const mine = useReadContracts({
    contracts: address
      ? [
          { ...base, functionName: 'garageOf', args: [address] },
          { address: USDC_ADDRESS, abi: erc20Abi, functionName: 'allowance', args: [address, GARAGE_ADDRESS], chainId: CHAIN_ID },
        ]
      : [],
    query: { enabled: !!address, refetchInterval: 8000 },
  })

  const garage = mine.data?.[0]?.result
  const allowance = mine.data?.[1]?.result

  const bikes: GarageBike[] = BIKES.map((b) => {
    const price = catalogue.data?.[b.id * 2]?.result
    const step = catalogue.data?.[b.id * 2 + 1]?.result
    const owned = b.id === 0 ? true : !!garage?.[0]?.[b.id]
    const level = owned ? Number(garage?.[1]?.[b.id] ?? 0) : 0
    const upgradeCost = owned && step !== undefined && level < MAX_BIKE_LEVEL ? step * BigInt(level + 1) : null
    return { id: b.id, price, step, owned, level, upgradeCost }
  })

  const [action, setAction] = useState<(Action & { phase: 'wallet' | 'confirming' }) | null>(null)
  const [error, setError] = useState<string | null>(null)

  const wait = useCallback(
    async (hash: Hash) => {
      const receipt = await publicClient?.waitForTransactionReceipt({ hash })
      if (!receipt || receipt.status !== 'success') throw new Error('Transaction reverted')
    },
    [publicClient],
  )

  /** Approve exactly what is needed if the allowance is short, then buy or upgrade. */
  const pay = useCallback(
    async (kind: 'buy' | 'upgrade', bikeId: number, amount: bigint): Promise<boolean> => {
      setError(null)
      try {
        if ((allowance ?? 0n) < amount) {
          setAction({ kind: 'approve', bikeId, phase: 'wallet' })
          const h = await writeContractAsync({
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: 'approve',
            args: [GARAGE_ADDRESS, amount],
            chainId: CHAIN_ID,
          })
          setAction({ kind: 'approve', bikeId, phase: 'confirming' })
          await wait(h)
        }
        setAction({ kind, bikeId, phase: 'wallet' })
        const h = await writeContractAsync({
          address: GARAGE_ADDRESS,
          abi: garageAbi,
          functionName: kind === 'buy' ? 'buyBike' : 'upgradeBike',
          args: [BigInt(bikeId)],
          chainId: CHAIN_ID,
        })
        setAction({ kind, bikeId, phase: 'confirming' })
        await wait(h)
        await mine.refetch()
        return true
      } catch (e) {
        const msg = parseOnchainError(e)
        if (msg) {
          setError(msg)
          toast.error(msg)
        }
        await mine.refetch()
        return false
      } finally {
        setAction(null)
      }
    },
    [allowance, mine, wait, writeContractAsync],
  )

  return {
    bikes,
    loading: catalogue.isLoading || (!!address && mine.isLoading),
    action,
    busy: action !== null,
    error,
    buy: (id: number, price: bigint) => pay('buy', id, price),
    upgrade: (id: number, cost: bigint) => pay('upgrade', id, cost),
  }
}

export type GarageData = ReturnType<typeof useGarage>
