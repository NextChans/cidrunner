import { useEffect } from 'react'
import { playSimSounds, stopSimSounds } from '@/audio/simSounds'
import { useGraphStore } from '@/store/useGraphStore'

/**
 * Bridges the store's simulation state to the audio layer (ADR 0058). One
 * mount point covers every way a simulation starts (Start button, chaos AZ
 * toggles) and stops; muting mid-pass silences immediately.
 */
export function SimAudio() {
  const simulation = useGraphStore((s) => s.simulation)
  const soundOn = useGraphStore((s) => s.soundOn)

  useEffect(() => {
    if (simulation && soundOn) playSimSounds(simulation)
    else stopSimSounds()
    return () => stopSimSounds()
  }, [simulation, soundOn])

  return null
}
