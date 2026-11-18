import { useCallback, useState } from 'react'

const read = (key: string, fallback: number): number => {
  try {
    const n = Number(localStorage.getItem(key))
    return localStorage.getItem(key) !== null && Number.isFinite(n) ? n : fallback
  } catch {
    return fallback
  }
}

const write = (key: string, value: number) => {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // storage unavailable: the value just will not persist
  }
}

/** A number saved per key (we key it by wallet address). Re-reads when the key changes. */
export function useStoredNumber(key: string, fallback: number) {
  const [state, setState] = useState(() => ({ key, value: read(key, fallback) }))
  if (state.key !== key) setState({ key, value: read(key, fallback) })
  const value = state.key === key ? state.value : read(key, fallback)

  const set = useCallback(
    (next: number | ((prev: number) => number)) => {
      setState((prev) => {
        const resolved = typeof next === 'function' ? next(prev.value) : next
        write(prev.key, resolved)
        return { key: prev.key, value: resolved }
      })
    },
    [],
  )
  return [value, set] as const
}

export const walletKey = (prefix: string, address: string | undefined) => `${prefix}:${address ? address.toLowerCase() : 'guest'}`
