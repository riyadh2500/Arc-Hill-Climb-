import { useEffect, useState } from 'react'

/** Must be called from a user gesture (a click or tap). Quietly does nothing where the browser refuses. */
export async function enterFullscreen(): Promise<void> {
  try {
    const el = document.documentElement
    if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' })
    // On phones, landscape gives the widest view. Only works once fullscreen is active.
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
    await orientation?.lock?.('landscape')
  } catch {
    // fullscreen or orientation lock not allowed here
  }
}

export async function exitFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    screen.orientation?.unlock?.()
  } catch {
    // already out of fullscreen
  }
}

export function useIsFullscreen(): boolean {
  const [on, setOn] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement)
  useEffect(() => {
    const update = () => setOn(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [])
  return on
}
