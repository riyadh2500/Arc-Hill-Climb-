import { arcTestnet } from 'viem/chains'

/** USDC has 6 decimals as an ERC-20. Balances, fees and prices in this app are raw 6-decimal units. */
export const USDC_DECIMALS = 6

/** Formats raw USDC units as an exact decimal string without trailing zeros, e.g. 100000n -> "0.1". */
export function formatUsdc(raw: bigint): string {
  const negative = raw < 0n
  const abs = negative ? -raw : raw
  const unit = 10n ** BigInt(USDC_DECIMALS)
  const whole = abs / unit
  const fraction = (abs % unit).toString().padStart(USDC_DECIMALS, '0').replace(/0+$/, '')
  return `${negative ? '-' : ''}${whole.toString()}${fraction ? `.${fraction}` : ''}`
}

/** Link to a transaction on the Arc Testnet explorer. */
export function buildTxExplorerUrl(hash: string): string {
  return `${arcTestnet.blockExplorers.default.url}/tx/${hash}`
}
