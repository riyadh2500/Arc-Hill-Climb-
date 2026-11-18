import { useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { sfx } from '@/game/audio'
import { glass } from '@/lib/hillclimb'

export function SoundButton() {
  const [muted, setMuted] = useState(sfx.isMuted())
  return (
    <button
      onClick={() => {
        sfx.setMuted(!muted)
        setMuted(!muted)
      }}
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      aria-pressed={muted}
      className="flex size-11 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95"
      style={{ ...glass.pill, background: 'rgba(255,255,255,0.78)', color: 'var(--ink)' }}
    >
      {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
    </button>
  )
}
